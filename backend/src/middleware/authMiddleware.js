import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AuthenticationError, AuthorizationError } from './errorMiddleware.js';

// Verify wallet signature middleware
export const verifyWalletSignature = async (req, res, next) => {
  try {
    console.log('🔍 verifyWalletSignature - Full request body:', req.body);
    const { walletAddress, signature, message, timestamp } = req.body;

    if (!walletAddress || !signature || !message) {
      throw new AuthenticationError('Wallet address, signature, and message are required');
    }

    // Check timestamp to prevent replay attacks (message should be recent)
    const messageTimestamp = new Date(timestamp).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

    if (!messageTimestamp || isNaN(messageTimestamp) || (now - messageTimestamp) > fiveMinutes) {
      throw new AuthenticationError('Message timestamp is too old or invalid');
    }

    // Verify the signature
    const messageHash = ethers.hashMessage(message);
    const recoveredAddress = ethers.recoverAddress(messageHash, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new AuthenticationError('Invalid signature');
    }

    // Find or create user
    let user = await User.findByWallet(walletAddress);
    if (!user) {
      // Auto-create user if they don't exist
      try {
        const userType = req.body.userType || 'citizen';
        const userData = {
          wallet_address: walletAddress,
          user_types: [userType], // Default to citizen
          primary_role: userType
        };
        
        // For DAO users, don't set email at all to avoid unique constraint issues
        if (userType !== 'dao') {
          userData.email = null; // Only set for non-DAO users
        }
        
        user = new User(userData);
        
        // For DAO users, add required profile fields
        if (userType === 'dao') {
          user.profile = {
            dao_role: 'member',
            voting_power: 1
          };
        }
        
        await user.save();
        console.log(`✅ New ${userType} user created:`, walletAddress);
      } catch (saveError) {
        // Handle duplicate key error for email
        if (saveError.code === 11000) {
          console.log('🔧 Duplicate key error, trying alternative approach...');
          console.log('Error details:', saveError.keyPattern);
          
          // Try creating without email field entirely
          const userType = req.body.userType || 'citizen';
          const userData = {
            wallet_address: walletAddress,
            user_types: [userType],
            primary_role: userType
          };
          
          user = new User(userData);
          
          // For DAO users, add required profile fields
          if (userType === 'dao') {
            user.profile = {
              dao_role: 'member',
              voting_power: 1
            };
          }
          
          // For non-DAO users, remove email field completely
          if (userType !== 'dao') {
            user.email = undefined;
          }
          await user.save();
          console.log(`✅ New ${userType} user created (no email):`, walletAddress);
        } else {
          console.error('❌ User creation failed:', saveError);
          throw saveError;
        }
      }
    }

    // Update user activity
    await user.incrementActivity('total_logins');

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

// Generate JWT token for authenticated user
export const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user._id,
      walletAddress: user.wallet_address,
      userType: user.primary_role || user.user_type, // Backwards compatibility
      userTypes: user.user_types || [user.user_type], // All roles array
      primaryRole: user.primary_role || user.user_type
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Verify JWT token middleware
export const verifyToken = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new AuthenticationError('Access token is required');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AuthenticationError('User no longer exists');
    }

    if (user.status !== 'active') {
      throw new AuthenticationError('User account is not active');
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(new AuthenticationError('Invalid or expired token'));
    } else {
      next(error);
    }
  }
};

// Authorization middleware for specific user types
export const authorize = (...userTypes) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    // Check if user has any of the required roles
    const hasRequiredRole = userTypes.some(role => req.user.user_types.includes(role));
    
    if (!hasRequiredRole) {
      return next(new AuthorizationError(`Access denied. Required role: ${userTypes.join(' or ')}. User has: ${req.user.user_types.join(', ')}`));
    }

    next();
  };
};

// Check if user owns the resource (for wallet-based ownership)
export const checkOwnership = (resourceField = 'citizen_id') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    // The resource should be attached to req.resource by previous middleware
    if (!req.resource) {
      return next(new Error('Resource not found in request'));
    }

    const resourceOwnerId = req.resource[resourceField];
    if (!resourceOwnerId) {
      return next(new Error(`Resource field ${resourceField} not found`));
    }

    if (resourceOwnerId.toLowerCase() !== req.user.wallet_address.toLowerCase()) {
      return next(new AuthorizationError('Not authorized to access this resource'));
    }

    next();
  };
};

// DAO member verification with minimum voting power
export const requireDAOMember = (minVotingPower = 1) => {
  return async (req, res, next) => {
    try {
      // Debug logging (can be removed in production)
      console.log('🔍 DAO permission check for:', req.user?.wallet_address);

      if (!req.user) {
          return next(new AuthenticationError('Authentication required'));
      }

      // Check if user has 'dao' role in multiple ways
      const hasDAORole = req.user.user_types?.includes('dao') || 
                        req.user.primary_role === 'dao' || 
                        req.user.user_type === 'dao' ||
                        (req.user.profile?.dao_role && ['member', 'moderator', 'admin'].includes(req.user.profile.dao_role)); // Check for valid dao_role in profile

      if (!hasDAORole) {
        return next(new AuthorizationError('DAO membership required'));
      }

      // Check voting power (with fallback to default of 1)
      const votingPower = req.user.profile?.voting_power ?? 1;
      if (votingPower < minVotingPower) {
        return next(new AuthorizationError(`Minimum voting power of ${minVotingPower} required`));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Verification status check
export const requireVerified = (verificationType = 'identity_verified') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (!req.user.verification[verificationType]) {
      return next(new AuthorizationError(`${verificationType.replace('_', ' ')} required`));
    }

    next();
  };
};

// Rate limiting per user
export const userRateLimit = (maxRequests = 100, windowMinutes = 15) => {
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    if (!userRequests.has(userId)) {
      userRequests.set(userId, []);
    }

    const userRequestList = userRequests.get(userId);
    
    // Remove old requests outside the window
    const validRequests = userRequestList.filter(time => (now - time) < windowMs);
    userRequests.set(userId, validRequests);

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMinutes} minutes.`
        }
      });
    }

    // Add current request
    validRequests.push(now);
    next();
  };
};