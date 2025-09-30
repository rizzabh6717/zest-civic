import express from 'express';
import crypto from 'crypto';
import { body, param, query } from 'express-validator';
import { verifyToken, authorize, checkOwnership } from '../middleware/authMiddleware.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorMiddleware.js';
import Grievance from '../models/Grievance.js';
import User from '../models/User.js';
import { classifyGrievance } from '../services/aiService.js';
import { submitGrievanceToBlockchain } from '../services/blockchainService.js';
import { validateRequest } from '../utils/validation.js';

const router = express.Router();

// @desc    Get all grievances with filtering and pagination
// @route   GET /api/grievances
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const {
    status,
    category,
    priority,
    citizen_id,
    page = 1,
    limit = 20,
    sort = '-createdAt',
    search
  } = req.query;

  // Build filter object
  const filter = {};
  
  if (status) {
    filter.status = { $in: status.split(',') };
  }
  if (category) {
    filter.category = { $in: category.split(',') };
  }
  if (priority) {
    filter.priority = { $in: priority.split(',') };
  }
  if (citizen_id) {
    filter.citizen_id = citizen_id;
  }
  
  // Add text search
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } }
    ];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Execute query
  const grievances = await Grievance.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .populate('bids', 'bid_amount worker_id status')
    .populate('assignment', 'worker_id status');

  const total = await Grievance.countDocuments(filter);

  res.json({
    success: true,
    data: {
      grievances,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit)
      }
    }
  });
}));

// @desc    Get marketplace grievances (available for bidding)
// @route   GET /api/grievances/marketplace
// @access  Public
router.get('/marketplace', asyncHandler(async (req, res) => {
  const {
    category,
    priority,
    min_amount,
    max_amount,
    location,
    page = 1,
    limit = 20
  } = req.query;

  // Build filter for marketplace grievances
  const filter = {
    status: { $in: ['classified', 'active'] }
  };

  if (category) {
    filter.category = { $in: category.split(',') };
  }
  if (priority) {
    filter.priority = { $in: priority.split(',') };
  }
  if (location) {
    filter.location = { $regex: location, $options: 'i' };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  let grievances = await Grievance.find(filter)
    .populate({
      path: 'bids',
      populate: {
        path: 'worker',
        select: 'display_name reputation wallet_address'
      }
    })
    .sort({ priority: 1, createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Filter by bid amount range if specified
  if (min_amount || max_amount) {
    grievances = grievances.filter(grievance => {
      const bids = grievance.bids || [];
      if (bids.length === 0) return true; // No bids yet, include in results
      
      const bidAmounts = bids.map(bid => bid.bid_amount);
      const minBid = Math.min(...bidAmounts);
      const maxBid = Math.max(...bidAmounts);
      
      let include = true;
      if (min_amount && maxBid < parseFloat(min_amount)) include = false;
      if (max_amount && minBid > parseFloat(max_amount)) include = false;
      
      return include;
    });
  }

  const total = await Grievance.countDocuments(filter);

  res.json({
    success: true,
    data: {
      grievances,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit)
      }
    }
  });
}));

// @desc    Get single grievance by ID
// @route   GET /api/grievances/:id
// @access  Public
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid grievance ID')
], validateRequest, asyncHandler(async (req, res) => {
  const grievance = await Grievance.findById(req.params.id)
    .populate({
      path: 'bids',
      populate: {
        path: 'worker',
        select: 'display_name reputation wallet_address profile.skills'
      }
    })
    .populate('assignment');

  if (!grievance) {
    throw new NotFoundError('Grievance not found');
  }

  // Increment view count
  grievance.view_count += 1;
  await grievance.save();

  res.json({
    success: true,
    data: grievance
  });
}));

// @desc    Submit new grievance
// @route   POST /api/grievances
// @access  Private (Citizens only)
router.post('/', [
  verifyToken,
  authorize('citizen'),
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  body('location')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Location must be between 3 and 200 characters'),
  body('category')
    .optional()
    .isIn(['road', 'waste', 'sewage', 'lighting', 'water', 'public_safety', 'environment', 'other'])
    .withMessage('Invalid category'),
  body('image_url')
    .optional()
    .custom((value) => {
      // Allow data URLs (base64), blob URLs, and regular URLs
      if (!value) return true; // Optional field
      if (typeof value !== 'string') return false;
      
      // Check for data URL (base64)
      if (value.startsWith('data:image/')) return true;
      
      // Check for blob URL
      if (value.startsWith('blob:')) return true;
      
      // Check for regular URL
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    })
    .withMessage('Invalid image URL or data')
], validateRequest, asyncHandler(async (req, res) => {
  const { title, description, location, category, image_url } = req.body;

  // Create grievance
  const grievance = new Grievance({
    citizen_id: req.user.wallet_address,
    title,
    description,
    location,
    category: category || 'other',
    image_url,
    status: 'pending'
  });

  await grievance.save();

  // Update user activity
  await req.user.incrementActivity('grievances_submitted');

  // Trigger AI classification (async)
  classifyGrievance(grievance._id).then(result => {
    console.log('✅ AI classification completed successfully:', result);
  }).catch(error => {
    console.error('❌ AI classification failed:', error.message);
    console.error('Full error:', error);
  });

  // Submit to blockchain with database hash (async)
  
  // Create hash of grievance data for blockchain verification
  const grievanceData = {
    id: grievance._id.toString(),
    citizen_id: grievance.citizen_id,
    title: grievance.title,
    description: grievance.description,
    location: grievance.location,
    category: grievance.category,
    timestamp: grievance.createdAt.getTime()
  };
  
  const dataHash = crypto.createHash('sha256')
    .update(JSON.stringify(grievanceData))
    .digest('hex');
  
  submitGrievanceToBlockchain(grievance._id, dataHash).catch(error => {
    console.error('Blockchain submission failed:', error);
  });

  res.status(201).json({
    success: true,
    message: 'Grievance submitted successfully',
    data: grievance
  });
}));

// @desc    Update grievance (citizens can update their own)
// @route   PUT /api/grievances/:id
// @access  Private (Owner only)
router.put('/:id', [
  verifyToken,
  param('id').isMongoId().withMessage('Invalid grievance ID'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  body('location')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Location must be between 3 and 200 characters'),
  body('image_url')
    .optional()
    .isURL()
    .withMessage('Invalid image URL')
], validateRequest, asyncHandler(async (req, res) => {
  const grievance = await Grievance.findById(req.params.id);
  
  if (!grievance) {
    throw new NotFoundError('Grievance not found');
  }

  // Check ownership
  if (grievance.citizen_id.toLowerCase() !== req.user.wallet_address.toLowerCase()) {
    throw new AuthorizationError('Not authorized to update this grievance');
  }

  // Check if grievance can be updated (only pending or classified status)
  if (!['pending', 'classified'].includes(grievance.status)) {
    throw new ValidationError('Grievance cannot be updated in current status');
  }

  // Update allowed fields
  const allowedUpdates = ['title', 'description', 'location', 'image_url'];
  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      grievance[field] = req.body[field];
    }
  });

  await grievance.save();

  res.json({
    success: true,
    message: 'Grievance updated successfully',
    data: grievance
  });
}));

// @desc    Delete grievance (citizens can delete their own pending grievances)
// @route   DELETE /api/grievances/:id
// @access  Private (Owner only)
router.delete('/:id', [
  verifyToken,
  param('id').isMongoId().withMessage('Invalid grievance ID')
], validateRequest, asyncHandler(async (req, res) => {
  const grievance = await Grievance.findById(req.params.id);
  
  if (!grievance) {
    throw new NotFoundError('Grievance not found');
  }

  // Check ownership
  if (grievance.citizen_id.toLowerCase() !== req.user.wallet_address.toLowerCase()) {
    throw new AuthorizationError('Not authorized to delete this grievance');
  }

  // Check if grievance can be deleted (only pending status)
  if (grievance.status !== 'pending') {
    throw new ValidationError('Only pending grievances can be deleted');
  }

  await Grievance.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Grievance deleted successfully'
  });
}));

// @desc    Get grievances by citizen
// @route   GET /api/grievances/citizen/:walletAddress
// @access  Public
router.get('/citizen/:walletAddress', [
  param('walletAddress').matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid wallet address')
], validateRequest, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const filter = { citizen_id: req.params.walletAddress.toLowerCase() };
  if (status) {
    filter.status = status;
  }

  const grievances = await Grievance.find(filter)
    .populate('bids', 'bid_amount worker_id status')
    .populate('assignment', 'worker_id status')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Grievance.countDocuments(filter);

  res.json({
    success: true,
    data: {
      grievances,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit)
      }
    }
  });
}));

// GET /api/grievances/marketplace - Get grievances available for bidding
router.get('/marketplace', asyncHandler(async (req, res) => {
  try {
    // Get grievances that are available for bidding (classified or active status)
    const marketplaceGrievances = await Grievance.find({
      status: { $in: ['classified', 'active'] },
      isActive: true
    })
    .populate('citizen_id', 'user_id')
    .sort({ created_at: -1 });

    res.json({
      success: true,
      message: 'Marketplace grievances retrieved successfully',
      data: {
        grievances: marketplaceGrievances,
        count: marketplaceGrievances.length
      }
    });
  } catch (error) {
    console.error('Error fetching marketplace grievances:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch marketplace grievances',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}));

export default router;