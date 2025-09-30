import express from 'express';
import { body, param, query } from 'express-validator';
import { verifyToken, authorize, requireDAOMember } from '../middleware/authMiddleware.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorMiddleware.js';
import DAOVote from '../models/DAOVote.js';
import TaskAssignment from '../models/TaskAssignment.js';
import WorkerBid from '../models/WorkerBid.js';
import Grievance from '../models/Grievance.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { assignTaskOnBlockchain } from '../services/blockchainService.js';
import { validateRequest } from '../utils/validation.js';

const router = express.Router();

// @desc    Get all DAO votes with filtering
// @route   GET /api/dao/votes
// @access  Public
router.get('/votes', asyncHandler(async (req, res) => {
  const {
    status,
    proposal_type,
    page = 1,
    limit = 20,
    sort = '-createdAt'
  } = req.query;

  const filter = {};
  if (status) filter.status = { $in: status.split(',') };
  if (proposal_type) filter.proposal_type = { $in: proposal_type.split(',') };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const votes = await DAOVote.find(filter)
    .populate('reference.grievance_id', 'title category priority')
    .populate('reference.bid_id', 'bid_amount worker_id')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await DAOVote.countDocuments(filter);

  res.json({
    success: true,
    data: {
      votes,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit)
      }
    }
  });
}));

// @desc    Get active DAO votes
// @route   GET /api/dao/votes/active
// @access  Public
router.get('/votes/active', asyncHandler(async (req, res) => {
  const activeVotes = await DAOVote.getActiveVotes()
    .populate('reference.grievance_id', 'title category priority')
    .populate('reference.bid_id', 'bid_amount worker_id');

  res.json({
    success: true,
    data: activeVotes
  });
}));

// @desc    Get specific DAO vote
// @route   GET /api/dao/votes/:id
// @access  Public
router.get('/votes/:id', [
  param('id').isMongoId().withMessage('Invalid vote ID')
], validateRequest, asyncHandler(async (req, res) => {
  const vote = await DAOVote.findById(req.params.id)
    .populate('reference.grievance_id')
    .populate('reference.bid_id')
    .populate('reference.assignment_id');

  if (!vote) {
    throw new NotFoundError('Vote not found');
  }

  res.json({
    success: true,
    data: vote
  });
}));

// @desc    Submit vote on a DAO proposal
// @route   POST /api/dao/votes/:id/vote
// @access  Private (DAO members only)
router.post('/votes/:id/vote', [
  verifyToken,
  requireDAOMember(),
  param('id').isMongoId().withMessage('Invalid vote ID'),
  body('option_id')
    .notEmpty()
    .withMessage('Option ID is required'),
  body('signature')
    .optional()
    .isString()
    .withMessage('Signature must be a string')
], validateRequest, asyncHandler(async (req, res) => {
  const { option_id, signature } = req.body;
  
  const vote = await DAOVote.findById(req.params.id);
  if (!vote) {
    throw new NotFoundError('Vote not found');
  }

  // Submit the vote
  await vote.submitVote(
    req.user.wallet_address,
    option_id,
    req.user.profile.voting_power,
    signature
  );

  // Update user activity
  await req.user.incrementActivity('votes_cast');

  // Check if vote should be completed
  const completed = await vote.checkAndCompleteVote();
  if (completed && vote.status === 'completed') {
    // Execute the vote result
    await executeVoteResult(vote);
  }

  res.json({
    success: true,
    message: 'Vote submitted successfully',
    data: {
      vote_id: vote._id,
      voter: req.user.wallet_address,
      option_selected: option_id,
      vote_status: vote.status,
      results: vote.results
    }
  });
}));

// @desc    Create new DAO vote (manual creation)
// @route   POST /api/dao/votes
// @access  Private (DAO members only)
router.post('/votes', [
  verifyToken,
  requireDAOMember(),
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  body('proposal_type')
    .isIn(['bid_assignment', 'task_verification', 'dispute_resolution', 'governance', 'budget_allocation'])
    .withMessage('Invalid proposal type'),
  body('voting_options')
    .isArray({ min: 2 })
    .withMessage('At least 2 voting options required'),
  body('voting_period_hours')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('Voting period must be between 1 and 168 hours')
], validateRequest, asyncHandler(async (req, res) => {
  const {
    title,
    description,
    proposal_type,
    voting_options,
    reference = {},
    voting_period_hours = 72,
    quorum_required = 51
  } = req.body;

  const vote = new DAOVote({
    proposal_id: `${proposal_type}_${Date.now()}`,
    proposal_type,
    title,
    description,
    reference,
    voting_options: voting_options.map((option, index) => ({
      option_id: `option_${index + 1}`,
      label: option.label,
      description: option.description || '',
      metadata: option.metadata || {}
    })),
    voting_config: {
      quorum_required,
      voting_period_hours,
      voting_type: 'simple_majority'
    },
    created_by: req.user.wallet_address,
    status: 'active'
  });

  await vote.save();

  res.status(201).json({
    success: true,
    message: 'DAO vote created successfully',
    data: vote
  });
}));

// @desc    Get DAO dashboard stats
// @route   GET /api/dao/dashboard
// @access  Private (DAO members only)
router.get('/dashboard', [
  verifyToken,
  requireDAOMember()
], asyncHandler(async (req, res) => {
  // Get dashboard statistics
  const [
    activeVotes,
    totalMembers,
    pendingAssignments,
    pendingVerifications,
    recentActivity
  ] = await Promise.all([
    DAOVote.countDocuments({ status: 'active' }),
    User.countDocuments({ user_type: 'dao', status: 'active' }),
    TaskAssignment.countDocuments({ status: 'assigned' }),
    TaskAssignment.countDocuments({ 
      status: 'completed',
      'verification.final_status': 'pending'
    }),
    DAOVote.find({ status: { $in: ['completed', 'active'] } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title proposal_type status results createdAt')
  ]);

  // Calculate participation rates
  const recentVotes = await DAOVote.find({
    status: 'completed',
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
  });

  let avgParticipationRate = 0;
  if (recentVotes.length > 0) {
    const totalParticipation = recentVotes.reduce((sum, vote) => sum + vote.results.total_votes, 0);
    avgParticipationRate = Math.round((totalParticipation / (recentVotes.length * totalMembers)) * 100);
  }

  // Get urgent items needing attention
  const urgentItems = await Promise.all([
    // Overdue assignments
    TaskAssignment.find({
      estimated_completion: { $lt: new Date() },
      status: { $in: ['assigned', 'started', 'in_progress'] }
    }).countDocuments(),
    
    // Votes expiring soon (within 24 hours)
    DAOVote.find({
      status: 'active',
      ends_at: { $lt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
    }).countDocuments(),
    
    // Disputes requiring resolution
    TaskAssignment.find({
      'dispute.raised': true,
      'dispute.resolution.resolved': false
    }).countDocuments()
  ]);

  res.json({
    success: true,
    data: {
      stats: {
        active_votes: activeVotes,
        total_members: totalMembers,
        pending_assignments: pendingAssignments,
        pending_verifications: pendingVerifications,
        avg_participation_rate: avgParticipationRate
      },
      urgent_items: {
        overdue_assignments: urgentItems[0],
        expiring_votes: urgentItems[1],
        pending_disputes: urgentItems[2]
      },
      recent_activity: recentActivity
    }
  });
}));

// @desc    Get DAO members list
// @route   GET /api/dao/members
// @access  Private (DAO members only)
router.get('/members', [
  verifyToken,
  requireDAOMember()
], asyncHandler(async (req, res) => {
  const members = await User.getDAOMembers()
    .select('wallet_address display_name profile.dao_role profile.voting_power activity.votes_cast createdAt');

  res.json({
    success: true,
    data: members
  });
}));

// @desc    Manual bid assignment (DAO override)
// @route   POST /api/dao/assign-bid
// @access  Private (DAO members only)
router.post('/assign-bid', [
  verifyToken,
  requireDAOMember(),
  body('bid_id')
    .isMongoId()
    .withMessage('Invalid bid ID'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
], validateRequest, asyncHandler(async (req, res) => {
  console.log('🔄 Starting bid assignment process...');
  console.log('🔍 Request data:', req.body);
  console.log('🔍 DAO member:', req.user.wallet_address);

  const { bid_id, reason = 'Manual DAO assignment' } = req.body;

  const bid = await WorkerBid.findById(bid_id).populate('grievance');
  if (!bid) {
    console.log('❌ Bid not found:', bid_id);
    throw new NotFoundError('Bid not found');
  }

  console.log('✅ Bid found:', {
    bid_id: bid._id,
    worker_id: bid.worker_id,
    amount: bid.bid_amount,
    grievance_title: bid.grievance?.title
  });

  if (bid.status !== 'pending') {
    console.log('❌ Bid not in pending status:', bid.status);
    throw new ValidationError('Bid is not in pending status');
  }

  if (!bid.grievance.canReceiveBids()) {
    console.log('❌ Grievance cannot receive bids:', bid.grievance.status);
    throw new ValidationError('Grievance is not available for assignment');
  }

  // Get grievance details for transaction
  const grievance = await Grievance.findById(bid.grievance_id);
  if (!grievance) {
    throw new NotFoundError('Grievance not found');
  }

  // Calculate estimated completion date
  const estimatedHours = await WorkerBid.findById(bid._id).select('estimated_completion_time');
  const estimatedCompletion = new Date();
  estimatedCompletion.setHours(estimatedCompletion.getHours() + (estimatedHours?.estimated_completion_time || 24));

  // Create task assignment with complete data
  const assignment = new TaskAssignment({
    grievance_id: bid.grievance_id,
    worker_id: bid.worker_id,
    bid_id: bid._id,
    escrow_amount: bid.bid_amount,
    estimated_completion: estimatedCompletion,
    assignment_reason: 'dao_override',
    assigned_at: new Date(),
    status: 'assigned'
  });

  await assignment.save();
  console.log(`✅ Task assignment created: ${assignment._id}`);

  // Create transaction record
  const transaction = Transaction.createWorkAssignmentTransaction({
    dao_member_address: req.user.wallet_address,
    worker_address: bid.worker_id,
    escrow_amount: bid.bid_amount,
    grievance_id: bid.grievance_id,
    grievance_title: grievance.title,
    assignment_id: assignment._id,
    bid_id: bid._id,
    assignment_reason: reason,
    estimated_completion: assignment.estimated_completion
  });

  await transaction.save();
  console.log(`✅ Transaction created: ${transaction.transaction_id}`);

  // Mark transaction as processing
  await transaction.markAsProcessing();

  // Update bid status
  bid.status = 'accepted';
  bid.dao_vote = {
    voted: true,
    vote_result: 'approved',
    vote_reason: reason,
    voted_at: new Date(),
    voted_by: req.user.wallet_address
  };
  await bid.save();

  // Reject other pending bids
  await WorkerBid.updateMany(
    {
      grievance_id: bid.grievance_id,
      _id: { $ne: bid._id },
      status: 'pending'
    },
    { status: 'rejected' }
  );

  // Update grievance status
  await Grievance.findByIdAndUpdate(bid.grievance_id, {
    status: 'assigned',
    assigned_worker_id: bid.worker_id,
    assignment_id: assignment._id
  });

  // Note: Blockchain transaction will be handled by frontend via MetaMask
  // Mark transaction as processing (will be updated when frontend completes blockchain tx)
  await transaction.markAsProcessing();
  console.log(`✅ Transaction marked as processing: ${transaction.transaction_id}`);

  console.log('🎉 Assignment process completed successfully');
  console.log('📊 Final response data:', {
    assignment_id: assignment._id,
    transaction_id: transaction.transaction_id,
    worker_id: bid.worker_id,
    amount: bid.bid_amount
  });

  res.json({
    success: true,
    message: 'Work assigned successfully',
    data: {
      assignment_id: assignment._id,
      worker_id: bid.worker_id,
      escrow_amount: bid.bid_amount,
      grievance_id: bid.grievance_id,
      grievance_title: grievance.title,
      estimated_completion: assignment.estimated_completion,
      assignment_status: assignment.status,
      transaction: {
        transaction_id: transaction.transaction_id,
        type: transaction.type,
        amount: transaction.display_amount,
        status: transaction.status,
        initiated_at: transaction.initiated_at,
        from_address: transaction.from_address,
        to_address: transaction.to_address
      }
    }
  });
}));

// @desc    Reject a bid (DAO override)
// @route   POST /api/dao/reject-bid
// @access  Private (DAO members only)
router.post('/reject-bid', [
  verifyToken,
  requireDAOMember(),
  body('bid_id')
    .isMongoId()
    .withMessage('Invalid bid ID'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
], validateRequest, asyncHandler(async (req, res) => {
  const { bid_id, reason = 'Rejected by DAO' } = req.body;

  const bid = await WorkerBid.findById(bid_id);
  if (!bid) {
    throw new NotFoundError('Bid not found');
  }

  if (bid.status !== 'pending') {
    throw new ValidationError('Only pending bids can be rejected');
  }

  // Update bid status
  bid.status = 'rejected';
  bid.dao_vote = {
    voted: true,
    vote_result: 'rejected',
    vote_reason: reason,
    voted_at: new Date(),
    voted_by: req.user.wallet_address
  };
  await bid.save();

  res.json({
    success: true,
    message: 'Bid rejected successfully',
    data: {
      bid_id: bid._id,
      status: bid.status,
      reason: reason
    }
  });
}));

// @desc    Unassign a task and make it available for reassignment
// @route   POST /api/dao/unassign-task
// @access  Private (DAO members only)
router.post('/unassign-task', [
  verifyToken,
  requireDAOMember(),
  body('assignment_id')
    .isMongoId()
    .withMessage('Invalid assignment ID'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters')
], validateRequest, asyncHandler(async (req, res) => {
  const { assignment_id, reason = 'Unassigned by DAO for reassignment' } = req.body;

  console.log('🔄 Starting task unassignment process...');
  console.log('📋 Assignment ID:', assignment_id);
  console.log('👤 DAO Member:', req.user.wallet_address);

  // Find the assignment
  const assignment = await TaskAssignment.findById(assignment_id);
  if (!assignment) {
    throw new NotFoundError('Task assignment not found');
  }

  console.log('✅ Assignment found:', {
    grievance_id: assignment.grievance_id,
    worker_id: assignment.worker_id,
    status: assignment.status
  });

  if (assignment.status === 'completed') {
    throw new ValidationError('Cannot unassign completed tasks');
  }

  // Get the grievance and bid
  const grievance = await Grievance.findById(assignment.grievance_id);
  const assignedBid = await WorkerBid.findById(assignment.bid_id);

  if (!grievance || !assignedBid) {
    throw new NotFoundError('Related grievance or bid not found');
  }

  // Update assignment status to 'cancelled' (valid enum value)
  assignment.status = 'cancelled';
  assignment.unassigned_at = new Date();
  assignment.unassignment_reason = reason;
  assignment.unassigned_by = req.user.wallet_address;
  await assignment.save();

  // Update grievance status back to 'open' for new bids
  grievance.status = 'open';
  grievance.assigned_worker_id = null;
  await grievance.save();

  // Update the assigned bid back to 'pending' 
  assignedBid.status = 'pending';
  await assignedBid.save();

  // Reset all other bids for this grievance back to 'pending' (if they were rejected)
  await WorkerBid.updateMany(
    { 
      grievance_id: assignment.grievance_id,
      status: 'rejected',
      _id: { $ne: assignment.bid_id } // Don't update the originally assigned bid
    },
    { 
      status: 'pending',
      dao_vote: null // Clear previous DAO votes
    }
  );

  console.log('✅ Task unassigned successfully');
  console.log('📊 Updated statuses:');
  console.log('  - Assignment:', assignment.status);
  console.log('  - Grievance:', grievance.status);
  console.log('  - Assigned Bid:', assignedBid.status);

  // Create transaction record for unassignment
  const unassignTransaction = new Transaction({
    transaction_id: `unassign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'work_unassignment',
    from_address: req.user.wallet_address,
    to_address: assignment.worker_id,
    amount: 0, // No financial transaction for unassignment
    description: `Task unassignment: ${grievance.title}`,
    references: {
      grievance_id: assignment.grievance_id,
      assignment_id: assignment._id,
      bid_id: assignment.bid_id
    },
    metadata: {
      unassigned_by: req.user.wallet_address,
      unassignment_reason: reason,
      original_escrow_amount: assignment.escrow_amount
    },
    status: 'completed'
  });

  await unassignTransaction.save();
  console.log(`✅ Unassignment transaction created: ${unassignTransaction.transaction_id}`);

  res.json({
    success: true,
    message: 'Task unassigned successfully',
    data: {
      assignment_id: assignment._id,
      grievance_id: assignment.grievance_id,
      worker_id: assignment.worker_id,
      grievance_status: grievance.status,
      unassignment_reason: reason,
      unassigned_at: assignment.unassigned_at,
      transaction: {
        transaction_id: unassignTransaction.transaction_id,
        type: unassignTransaction.type,
        status: unassignTransaction.status
      }
    }
  });
}));

// @desc    Get transaction history for DAO
// @route   GET /api/dao/transactions
// @access  Private (DAO members only)
router.get('/transactions', [
  verifyToken,
  requireDAOMember()
], asyncHandler(async (req, res) => {
  const {
    type,
    status,
    page = 1,
    limit = 20
  } = req.query;

  const filter = {};
  if (type) filter.type = type;
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const transactions = await Transaction.find(filter)
    .populate('references.grievance_id', 'title category priority')
    .populate('references.assignment_id', 'status worker_id')
    .populate('references.bid_id', 'bid_amount')
    .sort({ initiated_at: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Transaction.countDocuments(filter);

  res.json({
    success: true,
    data: {
      transactions,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit)
      }
    }
  });
}));

// @desc    Get specific transaction details
// @route   GET /api/dao/transactions/:transactionId
// @access  Private (DAO members only)
router.get('/transactions/:transactionId', [
  verifyToken,
  requireDAOMember(),
  param('transactionId').notEmpty().withMessage('Transaction ID is required')
], validateRequest, asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({ 
    transaction_id: req.params.transactionId 
  })
    .populate('references.grievance_id')
    .populate('references.assignment_id')
    .populate('references.bid_id');

  if (!transaction) {
    throw new NotFoundError('Transaction not found');
  }

  res.json({
    success: true,
    data: transaction
  });
}));

// Helper function to execute vote results
async function executeVoteResult(vote) {
  try {
    if (!vote.results.winning_option || !vote.results.quorum_reached) {
      console.log(`Vote ${vote._id} completed but no winning option or quorum not reached`);
      return;
    }

    const winningOptionId = vote.results.winning_option.option_id;

    switch (vote.proposal_type) {
      case 'bid_assignment':
        await executeBidAssignmentVote(vote, winningOptionId);
        break;
      
      case 'task_verification':
        await executeTaskVerificationVote(vote, winningOptionId);
        break;
      
      case 'dispute_resolution':
        await executeDisputeResolutionVote(vote, winningOptionId);
        break;
      
      default:
        console.log(`No execution handler for proposal type: ${vote.proposal_type}`);
    }

    vote.execution.executed = true;
    vote.execution.executed_at = new Date();
    await vote.save();

  } catch (error) {
    console.error('Vote execution failed:', error);
  }
}

async function executeBidAssignmentVote(vote, winningOptionId) {
  const winningBid = await WorkerBid.findById(winningOptionId);
  if (!winningBid) return;

  // Create task assignment
  const assignment = new TaskAssignment({
    grievance_id: winningBid.grievance_id,
    worker_id: winningBid.worker_id,
    bid_id: winningBid._id,
    escrow_amount: winningBid.bid_amount,
    assignment_reason: 'dao_vote'
  });

  await assignment.save();

  // Update bid statuses
  await WorkerBid.findByIdAndUpdate(winningBid._id, { status: 'accepted' });
  await WorkerBid.updateMany(
    {
      grievance_id: winningBid.grievance_id,
      _id: { $ne: winningBid._id },
      status: 'pending'
    },
    { status: 'rejected' }
  );

  // Update grievance
  await Grievance.findByIdAndUpdate(winningBid.grievance_id, {
    status: 'assigned',
    assigned_worker_id: winningBid.worker_id,
    assignment_id: assignment._id
  });

  // Create escrow transaction
  assignTaskOnBlockchain(grievance_id, winningBid._id, winningBid.bid_amount).catch(console.error);
}

async function executeTaskVerificationVote(vote, winningOptionId) {
  // Implementation for task verification vote execution
  console.log('Executing task verification vote:', vote._id, winningOptionId);
}

async function executeDisputeResolutionVote(vote, winningOptionId) {
  // Implementation for dispute resolution vote execution
  console.log('Executing dispute resolution vote:', vote._id, winningOptionId);
}

export default router;