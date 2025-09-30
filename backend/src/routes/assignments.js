import express from 'express';
import { body, param } from 'express-validator';
import { verifyToken, authorize } from '../middleware/authMiddleware.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorMiddleware.js';
import TaskAssignment from '../models/TaskAssignment.js';
import Grievance from '../models/Grievance.js';
import { submitWorkCompleteToBlockchain, confirmCompletionOnBlockchain } from '../services/blockchainService.js';
import { validateRequest } from '../utils/validation.js';
import crypto from 'crypto';

const router = express.Router();

// @desc    Submit task completion proof
// @route   POST /api/assignments/complete
// @access  Private (Workers only)
router.post('/complete', [
  verifyToken,
  authorize('worker'),
  body('assignment_id')
    .isMongoId()
    .withMessage('Invalid assignment ID'),
  body('completion_notes')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Completion notes must be between 10 and 1000 characters'),
  body('before_images')
    .optional()
    .isArray()
    .withMessage('Before images must be an array of URLs'),
  body('after_images')
    .optional()
    .isArray()
    .withMessage('After images must be an array of URLs'),
  body('completion_time_hours')
    .optional()
    .isFloat({ min: 0.1, max: 168 })
    .withMessage('Completion time must be between 0.1 and 168 hours')
], validateRequest, asyncHandler(async (req, res) => {
  const {
    assignment_id,
    completion_notes,
    before_images = [],
    after_images = [],
    completion_time_hours
  } = req.body;

  // Get assignment and verify worker
  const assignment = await TaskAssignment.findById(assignment_id).populate('grievance');
  if (!assignment) {
    throw new NotFoundError('Assignment not found');
  }

  if (assignment.worker_id !== req.user.wallet_address) {
    throw new ValidationError('Only assigned worker can submit completion');
  }

  if (assignment.status !== 'assigned' && assignment.status !== 'in_progress') {
    throw new ValidationError('Assignment not in valid status for completion');
  }

  // Create completion proof object (stored in database)
  const completionProof = {
    assignment_id: assignment_id,
    worker_id: req.user.wallet_address,
    completion_notes: completion_notes,
    before_images: before_images,
    after_images: after_images,
    completion_time_hours: completion_time_hours,
    submitted_at: new Date(),
    blockchain_hash: null // Will be set after blockchain submission
  };

  // Create hash of completion data for blockchain
  const proofHash = crypto.createHash('sha256')
    .update(JSON.stringify(completionProof))
    .digest('hex');

  completionProof.blockchain_hash = proofHash;

  // Update assignment with completion data
  await TaskAssignment.findByIdAndUpdate(assignment_id, {
    status: 'completed',
    completed_at: new Date(),
    'verification.proof_description': completion_notes,
    'verification.proof_image_url': after_images[0] || null, // Store first image as primary
    completion_proof: completionProof
  });

  // Submit to blockchain (async)
  submitWorkCompleteToBlockchain(
    assignment.grievance_id, 
    proofHash, 
    req.user.wallet_address
  ).catch(error => {
    console.error('Blockchain work completion failed:', error);
  });

  res.json({
    success: true,
    message: 'Task completion submitted successfully',
    data: {
      assignment_id: assignment_id,
      proof_hash: proofHash,
      status: 'completed',
      submitted_at: completionProof.submitted_at
    }
  });
}));

// @desc    Confirm task completion (Citizen)
// @route   POST /api/assignments/confirm/citizen
// @access  Private (Citizens only)
router.post('/confirm/citizen', [
  verifyToken,
  authorize('citizen'),
  body('assignment_id')
    .isMongoId()
    .withMessage('Invalid assignment ID'),
  body('approval')
    .isBoolean()
    .withMessage('Approval must be true or false'),
  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Feedback must be less than 500 characters'),
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5')
], validateRequest, asyncHandler(async (req, res) => {
  const { assignment_id, approval, feedback, rating } = req.body;

  const assignment = await TaskAssignment.findById(assignment_id).populate('grievance');
  if (!assignment) {
    throw new NotFoundError('Assignment not found');
  }

  if (assignment.grievance.citizen_id !== req.user.wallet_address) {
    throw new ValidationError('Only grievance citizen can confirm completion');
  }

  if (assignment.status !== 'completed') {
    throw new ValidationError('Assignment not in completed status');
  }

  // Update assignment with citizen approval
  await TaskAssignment.findByIdAndUpdate(assignment_id, {
    'verification.citizen_approval': approval,
    'verification.citizen_feedback': feedback,
    'verification.citizen_rating': rating,
    'verification.citizen_confirmed_at': new Date()
  });

  // Submit confirmation to blockchain (async)
  if (approval) {
    confirmCompletionOnBlockchain(
      assignment.grievance_id,
      'citizen',
      req.user.wallet_address
    ).catch(error => {
      console.error('Blockchain citizen confirmation failed:', error);
    });
  }

  res.json({
    success: true,
    message: approval ? 'Task completion approved by citizen' : 'Task completion rejected by citizen',
    data: {
      assignment_id: assignment_id,
      citizen_approval: approval,
      citizen_feedback: feedback,
      rating: rating
    }
  });
}));

// @desc    Confirm task completion (DAO)
// @route   POST /api/assignments/confirm/dao
// @access  Private (DAO only)
router.post('/confirm/dao', [
  verifyToken,
  authorize('dao'),
  body('assignment_id')
    .isMongoId()
    .withMessage('Invalid assignment ID'),
  body('approval')
    .isBoolean()
    .withMessage('Approval must be true or false'),
  body('verification_notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Verification notes must be less than 500 characters')
], validateRequest, asyncHandler(async (req, res) => {
  const { assignment_id, approval, verification_notes } = req.body;

  const assignment = await TaskAssignment.findById(assignment_id);
  if (!assignment) {
    throw new NotFoundError('Assignment not found');
  }

  if (assignment.status !== 'completed') {
    throw new ValidationError('Assignment not in completed status');
  }

  // Update assignment with DAO approval
  await TaskAssignment.findByIdAndUpdate(assignment_id, {
    'verification.dao_approval': approval,
    'verification.dao_verification_notes': verification_notes,
    'verification.dao_verified_by': req.user.wallet_address,
    'verification.dao_confirmed_at': new Date()
  });

  // Submit confirmation to blockchain (async)
  if (approval) {
    confirmCompletionOnBlockchain(
      assignment.grievance_id,
      'dao',
      req.user.wallet_address
    ).catch(error => {
      console.error('Blockchain DAO confirmation failed:', error);
    });
  }

  res.json({
    success: true,
    message: approval ? 'Task completion approved by DAO' : 'Task completion rejected by DAO',
    data: {
      assignment_id: assignment_id,
      dao_approval: approval,
      verification_notes: verification_notes,
      verified_by: req.user.wallet_address
    }
  });
}));

// @desc    Get assignment details
// @route   GET /api/assignments/:id
// @access  Private
router.get('/:id', [
  verifyToken,
  param('id').isMongoId().withMessage('Invalid assignment ID')
], validateRequest, asyncHandler(async (req, res) => {
  const assignment = await TaskAssignment.findById(req.params.id)
    .populate('grievance')
    .populate('bid');

  if (!assignment) {
    throw new NotFoundError('Assignment not found');
  }

  res.json({
    success: true,
    data: assignment
  });
}));

// @desc    Get worker's assignments
// @route   GET /api/assignments/worker/:walletAddress
// @access  Public
router.get('/worker/:walletAddress', [
  param('walletAddress').matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid wallet address')
], validateRequest, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const filter = { worker_id: req.params.walletAddress.toLowerCase() };
  if (status) {
    filter.status = status;
  }

  const assignments = await TaskAssignment.find(filter)
    .populate('grievance')
    .populate('bid')
    .sort({ assigned_at: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await TaskAssignment.countDocuments(filter);

  res.json({
    success: true,
    data: {
      assignments,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit)
      }
    }
  });
}));

// @desc    Get pending verifications (for DAO dashboard)
// @route   GET /api/assignments/pending-verifications
// @access  Private (DAO only)
router.get('/pending-verifications', [
  verifyToken,
  authorize('dao')
], asyncHandler(async (req, res) => {
  const pendingAssignments = await TaskAssignment.find({
    status: 'completed',
    'verification.dao_approval': { $ne: true }
  })
  .populate('grievance')
  .populate('bid')
  .sort({ completed_at: 1 }); // Oldest first

  res.json({
    success: true,
    data: pendingAssignments
  });
}));

export default router;