import express from 'express';
import { body, param, query } from 'express-validator';
import { verifyToken, verifyWalletSignature, generateToken } from '../middleware/authMiddleware.js';
import { asyncHandler, ValidationError, NotFoundError, ConflictError } from '../middleware/errorMiddleware.js';
import User from '../models/User.js';
import Grievance from '../models/Grievance.js';
import WorkerBid from '../models/WorkerBid.js';
import TaskAssignment from '../models/TaskAssignment.js';
import { validateRequest } from '../utils/validation.js';

const router = express.Router();

// @desc    Authenticate user with wallet signature
// @route   POST /api/users/auth
// @access  Public
router.post('/auth', [
  body('walletAddress')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid wallet address format'),
  body('signature')
    .notEmpty()
    .withMessage('Signature is required'),
  body('message')
    .notEmpty()
    .withMessage('Message is required'),
  body('timestamp')
    .custom((value, { req }) => {
      // More lenient timestamp validation for DAO users
      if (req.body.userType === 'dao') {
        // Accept any valid date format for DAO
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error('Valid timestamp is required for DAO users');
        }
        return true;
      }
      // Strict ISO8601 validation for other users
      if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
        throw new Error('Valid ISO8601 timestamp is required');
      }
      return true;
    })
    .withMessage('Valid timestamp is required'),
  body('userType')
    .optional()
    .isIn(['citizen', 'worker', 'dao'])
    .withMessage('Invalid user type')
], (req, res, next) => {
  console.log('🔍 AUTH REQUEST - Body:', req.body);
  console.log('🔍 AUTH REQUEST - UserType:', req.body.userType);
  console.log('🔍 AUTH REQUEST - Headers:', req.headers);
  next();
}, validateRequest, verifyWalletSignature, asyncHandler(async (req, res) => {
  console.log('🎉 Authentication successful for user:', req.user.wallet_address);
  
  // Generate JWT token
  const token = generateToken(req.user);

  // Prepare user response data with DAO-specific handling
  const userData = {
    id: req.user._id,
    wallet_address: req.user.wallet_address,
    user_type: req.user.user_type || req.user.primary_role || req.user.user_types?.[0] || 'citizen',
    display_name: req.user.display_name,
    reputation: req.user.reputation,
    verification: req.user.verification
  };

  // For DAO users, add additional fields if they exist
  if (req.user.user_types?.includes('dao') || req.user.primary_role === 'dao') {
    userData.user_types = req.user.user_types;
    userData.primary_role = req.user.primary_role;
    userData.profile = req.user.profile;
  }

  res.json({
    success: true,
    message: 'Authentication successful',
    data: {
      user: userData,
      token
    }
  });
}));

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', verifyToken, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: req.user
  });
}));

// @desc    Get user profile by wallet address
// @route   GET /api/users/:walletAddress
// @access  Public
router.get('/:walletAddress', [
  param('walletAddress').matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid wallet address')
], validateRequest, asyncHandler(async (req, res) => {
  const user = await User.findByWallet(req.params.walletAddress)
    .select('-blockchain.nonce -settings');

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Get user statistics
  const stats = await getUserStats(user.wallet_address, user.user_type);

  res.json({
    success: true,
    data: {
      ...user.toObject(),
      stats
    }
  });
}));

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', [
  verifyToken,
  body('display_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Display name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required'),
  body('profile.bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must be less than 500 characters'),
  body('profile.location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must be less than 100 characters'),
  body('profile.phone')
    .optional()
    .trim()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Invalid phone number format')
], validateRequest, asyncHandler(async (req, res) => {
  const allowedUpdates = [
    'display_name',
    'email',
    'profile.bio',
    'profile.location',
    'profile.phone',
    'profile.avatar_url'
  ];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        if (!req.user[parent]) req.user[parent] = {};
        req.user[parent][child] = req.body[field];
      } else {
        req.user[field] = req.body[field];
      }
    }
  });

  await req.user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: req.user
  });
}));

// @desc    Add or update worker skills
// @route   POST /api/users/skills
// @access  Private (Workers only)
router.post('/skills', [
  verifyToken,
  body('skills')
    .isArray({ min: 1 })
    .withMessage('Skills array is required'),
  body('skills.*.name')
    .trim()
    .notEmpty()
    .withMessage('Skill name is required'),
  body('skills.*.level')
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('Invalid skill level')
], validateRequest, asyncHandler(async (req, res) => {
  if (req.user.user_type !== 'worker') {
    throw new ValidationError('Only workers can add skills');
  }

  req.user.profile.skills = req.body.skills.map(skill => ({
    name: skill.name,
    level: skill.level,
    verified: false
  }));

  await req.user.save();

  res.json({
    success: true,
    message: 'Skills updated successfully',
    data: req.user.profile.skills
  });
}));

// @desc    Get top workers by reputation
// @route   GET /api/users/workers/top
// @access  Public
router.get('/workers/top', [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
], validateRequest, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  const topWorkers = await User.getTopWorkers(limit);

  res.json({
    success: true,
    data: topWorkers
  });
}));

// @desc    Get user dashboard data
// @route   GET /api/users/dashboard/:userType
// @access  Private
router.get('/dashboard/:userType', [
  verifyToken,
  param('userType').isIn(['citizen', 'worker', 'dao']).withMessage('Invalid user type')
], asyncHandler(async (req, res) => {
  const { userType } = req.params;

  if (req.user.user_type !== userType) {
    throw new ValidationError('User type mismatch');
  }

  let dashboardData = {};

  switch (userType) {
    case 'citizen':
      dashboardData = await getCitizenDashboard(req.user.wallet_address);
      break;
    case 'worker':
      dashboardData = await getWorkerDashboard(req.user.wallet_address);
      break;
    case 'dao':
      dashboardData = await getDAODashboard(req.user.wallet_address);
      break;
  }

  res.json({
    success: true,
    data: dashboardData
  });
}));

// @desc    Register new user (alternative to auth for explicit registration)
// @route   POST /api/users/register
// @access  Public
router.post('/register', [
  body('walletAddress')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid wallet address format'),
  body('userType')
    .isIn(['citizen', 'worker', 'dao'])
    .withMessage('Invalid user type'),
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Display name must be between 2 and 50 characters')
], validateRequest, asyncHandler(async (req, res) => {
  const { walletAddress, userType, displayName } = req.body;

  // Check if user already exists
  const existingUser = await User.findByWallet(walletAddress);
  if (existingUser) {
    throw new ConflictError('User already exists');
  }

  const user = new User({
    wallet_address: walletAddress,
    user_type: userType,
    display_name: displayName || `${userType}_${walletAddress.slice(-6)}`
  });

  await user.save();

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      id: user._id,
      wallet_address: user.wallet_address,
      user_type: user.user_type,
      display_name: user.display_name
    }
  });
}));

// Helper functions for dashboard data
async function getCitizenDashboard(walletAddress) {
  const [
    totalGrievances,
    activeGrievances,
    resolvedGrievances,
    recentGrievances
  ] = await Promise.all([
    Grievance.countDocuments({ citizen_id: walletAddress }),
    Grievance.countDocuments({ 
      citizen_id: walletAddress, 
      status: { $in: ['pending', 'classified', 'active', 'assigned', 'in_progress'] }
    }),
    Grievance.countDocuments({ 
      citizen_id: walletAddress, 
      status: { $in: ['completed', 'verified'] }
    }),
    Grievance.find({ citizen_id: walletAddress })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('assignment', 'worker_id status')
  ]);

  return {
    stats: {
      total_grievances: totalGrievances,
      active_grievances: activeGrievances,
      resolved_grievances: resolvedGrievances,
      resolution_rate: totalGrievances > 0 ? Math.round((resolvedGrievances / totalGrievances) * 100) : 0
    },
    recent_grievances: recentGrievances
  };
}

async function getWorkerDashboard(walletAddress) {
  const [
    totalBids,
    acceptedBids,
    activeAssignments,
    completedTasks,
    earnings,
    recentAssignments
  ] = await Promise.all([
    WorkerBid.countDocuments({ worker_id: walletAddress }),
    WorkerBid.countDocuments({ worker_id: walletAddress, status: 'accepted' }),
    TaskAssignment.countDocuments({ 
      worker_id: walletAddress, 
      status: { $in: ['assigned', 'started', 'in_progress'] }
    }),
    TaskAssignment.countDocuments({ 
      worker_id: walletAddress, 
      status: { $in: ['completed', 'verified'] }
    }),
    TaskAssignment.aggregate([
      { $match: { worker_id: walletAddress, 'payment.escrow_released': true } },
      { $group: { _id: null, total: { $sum: '$payment.release_amount' } } }
    ]),
    TaskAssignment.find({ worker_id: walletAddress })
      .sort({ assigned_at: -1 })
      .limit(5)
      .populate('grievance', 'title category priority location')
  ]);

  return {
    stats: {
      total_bids: totalBids,
      accepted_bids: acceptedBids,
      active_assignments: activeAssignments,
      completed_tasks: completedTasks,
      success_rate: acceptedBids > 0 ? Math.round((completedTasks / acceptedBids) * 100) : 0,
      total_earnings: earnings[0]?.total || 0
    },
    recent_assignments: recentAssignments
  };
}

async function getDAODashboard(walletAddress) {
  // Implementation depends on DAO voting history and activities
  return {
    stats: {
      votes_cast: 0,
      proposals_created: 0,
      voting_power: 1
    },
    recent_votes: []
  };
}

async function getUserStats(walletAddress, userType) {
  switch (userType) {
    case 'citizen':
      return {
        grievances_submitted: await Grievance.countDocuments({ citizen_id: walletAddress }),
        active_grievances: await Grievance.countDocuments({ 
          citizen_id: walletAddress, 
          status: { $in: ['pending', 'classified', 'active', 'assigned', 'in_progress'] }
        })
      };
    
    case 'worker':
      return {
        bids_submitted: await WorkerBid.countDocuments({ worker_id: walletAddress }),
        tasks_completed: await TaskAssignment.countDocuments({ 
          worker_id: walletAddress, 
          status: { $in: ['completed', 'verified'] }
        })
      };
    
    case 'dao':
      return {
        voting_power: 1,
        votes_cast: 0
      };
    
    default:
      return {};
  }
}

// @desc    Add role to existing user
// @route   POST /api/users/add-role
// @access  Private
router.post('/add-role', [
  verifyToken,
  body('role').isIn(['citizen', 'worker', 'dao']).withMessage('Invalid role')
], validateRequest, asyncHandler(async (req, res) => {
  const { role } = req.body;
  const user = req.user;
  
  console.log(`Adding role ${role} to user ${user.wallet_address}`);
  
  // Add the role if not already present
  if (!user.user_types.includes(role)) {
    user.user_types.push(role);
    
    // For DAO role, ensure profile has required fields
    if (role === 'dao') {
      if (!user.profile) user.profile = {};
      if (!user.profile.dao_role) user.profile.dao_role = 'member';
      if (!user.profile.voting_power) user.profile.voting_power = 1;
    }
    
    await user.save();
    
    console.log(`✅ Role ${role} added to user ${user.wallet_address}`);
    console.log(`User now has roles: ${user.user_types.join(', ')}`);
    
    // Generate new token with updated roles
    const newToken = generateToken(user);
    
    res.json({
      success: true,
      message: `Role ${role} added successfully`,
      data: {
        user: {
          wallet_address: user.wallet_address,
          user_types: user.user_types,
          primary_role: user.primary_role
        },
        token: newToken
      }
    });
  } else {
    res.json({
      success: true,
      message: `User already has ${role} role`,
      data: {
        user: {
          wallet_address: user.wallet_address,
          user_types: user.user_types,
          primary_role: user.primary_role
        }
      }
    });
  }
}));

export default router;