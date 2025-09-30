import express from 'express';
import { body, param, query } from 'express-validator';
import { verifyToken, authorize, requireVerified } from '../middleware/authMiddleware.js';
import { asyncHandler, ValidationError, NotFoundError, ConflictError } from '../middleware/errorMiddleware.js';
import Grievance from '../models/Grievance.js';
import WorkerBid from '../models/WorkerBid.js';
import TaskAssignment from '../models/TaskAssignment.js';
import DAOVote from '../models/DAOVote.js';
import User from '../models/User.js';
import { submitBidToBlockchain, assignTaskOnBlockchain } from '../services/blockchainService.js';
import { validateRequest } from '../utils/validation.js';

const router = express.Router();

// @desc    Get all bids with filtering
// @route   GET /api/bids
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const {
    grievance_id,
    worker_id,
    status,
    page = 1,
    limit = 20,
    sort = '-createdAt'
  } = req.query;

  const filter = {};
  if (grievance_id) filter.grievance_id = grievance_id;
  if (worker_id) filter.worker_id = worker_id.toLowerCase();
  if (status) filter.status = { $in: status.split(',') };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const bids = await WorkerBid.find(filter)
    .populate('grievance', 'title status category priority location')
    .populate('worker', 'display_name reputation profile.skills')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  // For each accepted bid, check if it has an associated assignment
  const bidsWithAssignments = await Promise.all(
    bids.map(async (bid) => {
      const bidObj = bid.toObject();
      
      // Find associated task assignment for accepted bids
      if (bid.status === 'accepted') {
        const assignment = await TaskAssignment.findOne({ 
          bid_id: bid._id,
          status: { $ne: 'cancelled' } // Exclude cancelled assignments
        }).select('_id status createdAt worker_id grievance_id escrow_amount');
        
        if (assignment) {
          bidObj.assignment = assignment;
        }
      }
      
      return bidObj;
    })
  );

  const total = await WorkerBid.countDocuments(filter);

  res.json({
    success: true,
    data: {
      bids: bidsWithAssignments,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit)
      }
    }
  });
}));

// @desc    Get bids for a specific grievance
// @route   GET /api/bids/grievance/:grievanceId
// @access  Public
router.get('/grievance/:grievanceId', [
  param('grievanceId').isMongoId().withMessage('Invalid grievance ID')
], validateRequest, asyncHandler(async (req, res) => {
  const bids = await WorkerBid.getBidsForGrievance(req.params.grievanceId);

  res.json({
    success: true,
    data: bids
  });
}));

// @desc    Get worker's bids
// @route   GET /api/bids/worker/:walletAddress
// @access  Public
router.get('/worker/:walletAddress', [
  param('walletAddress').matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid wallet address')
], validateRequest, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const bids = await WorkerBid.getWorkerBids(
    req.params.walletAddress.toLowerCase(),
    status
  )
  .skip(skip)
  .limit(parseInt(limit));

  const total = await WorkerBid.countDocuments({
    worker_id: req.params.walletAddress.toLowerCase(),
    ...(status && { status })
  });

  res.json({
    success: true,
    data: {
      bids,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit)
      }
    }
  });
}));

// @desc    Submit a bid for a grievance (Simplified for testing)
// @route   POST /api/bids/simple
// @access  Private (Authenticated users)
router.post('/simple', [
  verifyToken,
  body('grievance_id')
    .isMongoId()
    .withMessage('Invalid grievance ID'),
  body('bid_amount')
    .isFloat({ min: 1, max: 10000 })
    .withMessage('Bid amount must be between 1 and 10,000'),
  body('proposal')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Proposal must be between 10 and 1000 characters'),
  body('estimated_completion_time')
    .isInt({ min: 1, max: 168 })
    .withMessage('Estimated completion time must be between 1 and 168 hours'),
  body('skills_offered')
    .optional()
    .isArray()
    .withMessage('Skills must be an array')
], validateRequest, asyncHandler(async (req, res) => {
  const {
    grievance_id,
    bid_amount,
    proposal,
    estimated_completion_time,
    skills_offered = []
  } = req.body;

  // Check if grievance exists and can receive bids
  const grievance = await Grievance.findById(grievance_id);
  if (!grievance) {
    throw new NotFoundError('Grievance not found');
  }

  if (!grievance.canReceiveBids()) {
    throw new ValidationError('Grievance is not available for bidding');
  }

  // Check if worker already submitted a bid for this grievance
  const existingBid = await WorkerBid.findOne({
    grievance_id,
    worker_id: req.user.wallet_address,
    status: 'pending'
  });

  if (existingBid) {
    throw new ConflictError('You have already submitted a bid for this grievance');
  }

  // Create the bid
  const bid = new WorkerBid({
    grievance_id,
    worker_id: req.user.wallet_address,
    bid_amount,
    proposal,
    estimated_completion_time,
    skills_offered,
    worker_reputation: req.user.reputation?.score || 0
  });

  await bid.save();

  // Update grievance bid count
  await Grievance.findByIdAndUpdate(grievance_id, {
    $inc: { bid_count: 1 }
  });

  // Update user activity
  await req.user.incrementActivity('bids_submitted');

  // Submit bid to blockchain (async)
  
  submitBidToBlockchain(bid._id, grievance_id, bid_amount, req.user.wallet_address).catch(error => {
    console.error('Blockchain bid submission failed:', error);
  });

  // Check if this should trigger auto-assignment or DAO vote
  await checkBidAssignment(grievance_id);

  const populatedBid = await WorkerBid.findById(bid._id)
    .populate('grievance', 'title category priority')
    .populate('worker', 'display_name reputation');

  res.status(201).json({
    success: true,
    message: 'Bid submitted successfully',
    data: {
      bid_id: bid._id,
      bid: populatedBid,
      worker_details: {
        wallet_address: req.user.wallet_address,
        display_name: req.user.display_name,
        reputation: req.user.reputation
      }
    }
  });
}));

// @desc    Update a bid (workers can update their pending bids)
// @route   PUT /api/bids/:id
// @access  Private (Owner only)
router.put('/:id', [
  verifyToken,
  authorize('worker'),
  param('id').isMongoId().withMessage('Invalid bid ID'),
  body('bid_amount')
    .optional()
    .isFloat({ min: 1, max: 10000 })
    .withMessage('Bid amount must be between 1 and 10,000'),
  body('proposal')
    .optional()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Proposal must be between 10 and 1000 characters'),
  body('estimated_completion_time')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('Estimated completion time must be between 1 and 168 hours'),
  body('skills_offered')
    .optional()
    .isArray()
    .withMessage('Skills must be an array')
], validateRequest, asyncHandler(async (req, res) => {
  const bid = await WorkerBid.findById(req.params.id);
  
  if (!bid) {
    throw new NotFoundError('Bid not found');
  }

  // Check ownership
  if (bid.worker_id.toLowerCase() !== req.user.wallet_address.toLowerCase()) {
    throw new AuthorizationError('Not authorized to update this bid');
  }

  // Check if bid can be updated
  if (!bid.canBeWithdrawn()) {
    throw new ValidationError('Bid cannot be updated in current status');
  }

  // Update allowed fields
  const allowedUpdates = ['bid_amount', 'proposal', 'estimated_completion_time', 'skills_offered'];
  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      bid[field] = req.body[field];
    }
  });

  await bid.save();

  const populatedBid = await WorkerBid.findById(bid._id)
    .populate('grievance', 'title category priority')
    .populate('worker', 'display_name reputation');

  res.json({
    success: true,
    message: 'Bid updated successfully',
    data: populatedBid
  });
}));

// @desc    Withdraw a bid
// @route   DELETE /api/bids/:id
// @access  Private (Owner only)
router.delete('/:id', [
  verifyToken,
  authorize('worker'),
  param('id').isMongoId().withMessage('Invalid bid ID')
], validateRequest, asyncHandler(async (req, res) => {
  const bid = await WorkerBid.findById(req.params.id);
  
  if (!bid) {
    throw new NotFoundError('Bid not found');
  }

  // Check ownership
  if (bid.worker_id.toLowerCase() !== req.user.wallet_address.toLowerCase()) {
    throw new AuthorizationError('Not authorized to withdraw this bid');
  }

  // Check if bid can be withdrawn
  if (!bid.canBeWithdrawn()) {
    throw new ValidationError('Bid cannot be withdrawn in current status');
  }

  // Update bid status instead of deleting
  bid.status = 'withdrawn';
  await bid.save();

  // Update grievance bid count
  await Grievance.findByIdAndUpdate(bid.grievance_id, {
    $inc: { bid_count: -1 }
  });

  res.json({
    success: true,
    message: 'Bid withdrawn successfully'
  });
}));

// Helper function to check if bid assignment should be triggered
async function checkBidAssignment(grievanceId) {
  try {
    const grievance = await Grievance.findById(grievanceId);
    const pendingBids = await WorkerBid.find({
      grievance_id: grievanceId,
      status: 'pending'
    });

    if (pendingBids.length === 0) return;

    // Auto-assign if only one bid and grievance priority is urgent
    if (pendingBids.length === 1 && grievance.priority === 'urgent') {
      await autoAssignTask(grievanceId, pendingBids[0]);
      return;
    }

    // If multiple bids or non-urgent, create DAO vote after some delay
    // This could be triggered by a cron job or after a certain number of bids
    if (pendingBids.length >= 3 || grievance.priority === 'high') {
      await createDAOVoteForBidAssignment(grievanceId, pendingBids);
    }
  } catch (error) {
    console.error('Error checking bid assignment:', error);
  }
}

// Auto-assign task to a worker
async function autoAssignTask(grievanceId, winningBid) {
  try {
    // Create task assignment
    const assignment = new TaskAssignment({
      grievance_id: grievanceId,
      worker_id: winningBid.worker_id,
      bid_id: winningBid._id,
      escrow_amount: winningBid.bid_amount,
      assignment_reason: 'single_bid'
    });

    await assignment.save();

    // Update bid status
    winningBid.status = 'accepted';
    winningBid.auto_assigned = true;
    await winningBid.save();

    // Update grievance status
    await Grievance.findByIdAndUpdate(grievanceId, {
      status: 'assigned',
      assigned_worker_id: winningBid.worker_id,
      assignment_id: assignment._id
    });

    // Create escrow transaction (async)
    assignTaskOnBlockchain(grievance_id, winningBid._id, winningBid.bid_amount).catch(error => {
      console.error('Escrow creation failed:', error);
    });

    console.log(`Task auto-assigned: Assignment ${assignment._id}`);
  } catch (error) {
    console.error('Auto-assignment failed:', error);
  }
}

// Create DAO vote for bid assignment
async function createDAOVoteForBidAssignment(grievanceId, bids) {
  try {
    // Check if vote already exists
    const existingVote = await DAOVote.findOne({
      'reference.grievance_id': grievanceId,
      proposal_type: 'bid_assignment',
      status: { $in: ['active', 'draft'] }
    });

    if (existingVote) return; // Vote already exists

    // Find a DAO member to create the vote (in a real system, this might be automated)
    const daoMember = await User.findOne({ user_type: 'dao', status: 'active' });
    if (!daoMember) {
      console.log('No DAO members available to create vote');
      return;
    }

    const vote = await DAOVote.createBidAssignmentVote(
      grievanceId,
      bids,
      daoMember.wallet_address
    );

    console.log(`DAO vote created: ${vote._id} for grievance ${grievanceId}`);
  } catch (error) {
    console.error('Failed to create DAO vote:', error);
  }
}

export default router;