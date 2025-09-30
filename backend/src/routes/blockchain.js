import express from 'express';
import { body, param, query } from 'express-validator';
import { verifyToken, authorize, requireDAOMember } from '../middleware/authMiddleware.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorMiddleware.js';
import { 
  getTransactionDetails, 
  getNetworkStatus, 
  releaseEscrowPayment,
  disputeEscrow 
} from '../services/blockchainService.js';
import Transaction from '../models/Transaction.js';
import TaskAssignment from '../models/TaskAssignment.js';
import { validateRequest } from '../utils/validation.js';

const router = express.Router();

// @desc    Get blockchain network status
// @route   GET /api/blockchain/status
// @access  Public
router.get('/status', asyncHandler(async (req, res) => {
  const status = await getNetworkStatus();

  res.json({
    success: true,
    data: status
  });
}));

// @desc    Get transaction details by hash
// @route   GET /api/blockchain/transaction/:txHash
// @access  Public
router.get('/transaction/:txHash', [
  param('txHash').matches(/^0x[a-fA-F0-9]{64}$/).withMessage('Invalid transaction hash format')
], validateRequest, asyncHandler(async (req, res) => {
  const result = await getTransactionDetails(req.params.txHash);

  if (!result.success) {
    throw new NotFoundError('Transaction not found or blockchain error');
  }

  res.json({
    success: true,
    data: result.transaction
  });
}));

// @desc    Release escrow payment (DAO only)
// @route   POST /api/blockchain/escrow/:assignmentId/release
// @access  Private (DAO only)
router.post('/escrow/:assignmentId/release', [
  verifyToken,
  authorize('dao'),
  param('assignmentId').isMongoId().withMessage('Invalid assignment ID')
], validateRequest, asyncHandler(async (req, res) => {
  const result = await releaseEscrowPayment(req.params.assignmentId);

  res.json({
    success: true,
    message: 'Escrow payment released successfully',
    data: result
  });
}));

// @desc    Dispute escrow (Citizens, Workers, DAO)
// @route   POST /api/blockchain/escrow/:assignmentId/dispute
// @access  Private
router.post('/escrow/:assignmentId/dispute', [
  verifyToken,
  param('assignmentId').isMongoId().withMessage('Invalid assignment ID')
], validateRequest, asyncHandler(async (req, res) => {
  const { reason = 'Dispute raised' } = req.body;

  const result = await disputeEscrow(req.params.assignmentId, reason);

  res.json({
    success: true,
    message: 'Escrow dispute initiated',
    data: result
  });
}));

// @desc    Update transaction with blockchain details (called from frontend after MetaMask transaction)
// @route   POST /api/blockchain/update-transaction
// @access  Private (DAO members only)
router.post('/update-transaction', [
  verifyToken,
  requireDAOMember(),
  body('transaction_id')
    .notEmpty()
    .withMessage('Transaction ID is required'),
  body('tx_hash')
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid transaction hash format'),
  body('block_number')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Block number must be a positive integer'),
  body('assignment_id')
    .optional()
    .isMongoId()
    .withMessage('Invalid assignment ID')
], validateRequest, asyncHandler(async (req, res) => {
  const { transaction_id, tx_hash, block_number, assignment_id } = req.body;

  console.log('🔗 Updating transaction with blockchain details:', {
    transaction_id,
    tx_hash,
    block_number
  });

  // Find and update transaction
  const transaction = await Transaction.findOne({ transaction_id });
  if (!transaction) {
    throw new NotFoundError('Transaction not found');
  }

  // Update transaction with blockchain details
  await transaction.markAsCompleted(tx_hash, block_number);

  // Update assignment if provided
  if (assignment_id) {
    await TaskAssignment.findByIdAndUpdate(assignment_id, {
      escrow_tx_hash: tx_hash,
      escrow_block_number: block_number
    });
  }

  console.log(`✅ Transaction updated with blockchain tx: ${tx_hash}`);

  res.json({
    success: true,
    message: 'Transaction updated with blockchain details',
    data: {
      transaction_id,
      tx_hash,
      block_number,
      status: transaction.status
    }
  });
}));

// @desc    Mark transaction as failed (called from frontend if MetaMask transaction fails)
// @route   POST /api/blockchain/transaction-failed
// @access  Private (DAO members only)
router.post('/transaction-failed', [
  verifyToken,
  requireDAOMember(),
  body('transaction_id')
    .notEmpty()
    .withMessage('Transaction ID is required'),
  body('error_message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Error message must be less than 500 characters')
], validateRequest, asyncHandler(async (req, res) => {
  const { transaction_id, error_message = 'Blockchain transaction failed' } = req.body;

  console.log('❌ Marking transaction as failed:', transaction_id);

  // Find and update transaction
  const transaction = await Transaction.findOne({ transaction_id });
  if (!transaction) {
    throw new NotFoundError('Transaction not found');
  }

  // Mark transaction as failed
  await transaction.markAsFailed(error_message);

  res.json({
    success: true,
    message: 'Transaction marked as failed',
    data: {
      transaction_id,
      status: transaction.status,
      error_message
    }
  });
}));

export default router;