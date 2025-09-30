import express from 'express';
import { body, param } from 'express-validator';
import { verifyToken, authorize } from '../middleware/authMiddleware.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorMiddleware.js';
import { classifyGrievance, verifyTaskCompletion, analyzeImage } from '../services/aiService.js';
import Grievance from '../models/Grievance.js';
import TaskAssignment from '../models/TaskAssignment.js';
import { validateRequest } from '../utils/validation.js';

const router = express.Router();

// @desc    Manually trigger AI classification for a grievance
// @route   POST /api/ai/classify/:grievanceId
// @access  Private (DAO only)
router.post('/classify/:grievanceId', [
  verifyToken,
  authorize('dao'),
  param('grievanceId').isMongoId().withMessage('Invalid grievance ID')
], validateRequest, asyncHandler(async (req, res) => {
  const grievance = await Grievance.findById(req.params.grievanceId);
  
  if (!grievance) {
    throw new NotFoundError('Grievance not found');
  }

  // Trigger AI classification
  const classification = await classifyGrievance(req.params.grievanceId);

  res.json({
    success: true,
    message: 'AI classification completed',
    data: {
      grievance_id: req.params.grievanceId,
      classification
    }
  });
}));

// @desc    Verify task completion with AI
// @route   POST /api/ai/verify-task/:assignmentId
// @access  Private (Citizens, Workers, DAO)
router.post('/verify-task/:assignmentId', [
  verifyToken,
  param('assignmentId').isMongoId().withMessage('Invalid assignment ID'),
  body('proof_image_url')
    .isURL()
    .withMessage('Valid proof image URL is required'),
  body('proof_description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Proof description must be less than 500 characters')
], validateRequest, asyncHandler(async (req, res) => {
  const { proof_image_url, proof_description } = req.body;
  
  const assignment = await TaskAssignment.findById(req.params.assignmentId)
    .populate('grievance');
  
  if (!assignment) {
    throw new NotFoundError('Task assignment not found');
  }

  // Check authorization (worker who owns the task or citizen who owns the grievance)
  const isWorker = assignment.worker_id.toLowerCase() === req.user.wallet_address.toLowerCase();
  const isCitizen = assignment.grievance.citizen_id.toLowerCase() === req.user.wallet_address.toLowerCase();
  const isDAO = req.user.user_type === 'dao';

  if (!isWorker && !isCitizen && !isDAO) {
    throw new AuthorizationError('Not authorized to verify this task');
  }

  // Trigger AI verification
  const verification = await verifyTaskCompletion(
    req.params.assignmentId,
    proof_image_url,
    proof_description
  );

  res.json({
    success: true,
    message: 'AI verification completed',
    data: {
      assignment_id: req.params.assignmentId,
      verification
    }
  });
}));

// @desc    Analyze image for content and context
// @route   POST /api/ai/analyze-image
// @access  Private
router.post('/analyze-image', [
  verifyToken,
  body('image_url')
    .isURL()
    .withMessage('Valid image URL is required'),
  body('context')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Context must be less than 200 characters'),
  body('analysis_type')
    .optional()
    .isIn(['grievance', 'verification', 'general'])
    .withMessage('Invalid analysis type')
], validateRequest, asyncHandler(async (req, res) => {
  const { image_url, context, analysis_type = 'general' } = req.body;

  const analysis = await analyzeImage(image_url, context, analysis_type);

  res.json({
    success: true,
    message: 'Image analysis completed',
    data: analysis
  });
}));

// @desc    Get AI classification statistics
// @route   GET /api/ai/stats
// @access  Private (DAO only)
router.get('/stats', [
  verifyToken,
  authorize('dao')
], asyncHandler(async (req, res) => {
  const [
    totalClassified,
    classificationsByCategory,
    classificationsByPriority,
    recentClassifications
  ] = await Promise.all([
    Grievance.countDocuments({ ai_classification: { $exists: true } }),
    Grievance.aggregate([
      { $match: { ai_classification: { $exists: true } } },
      { $group: { _id: '$ai_classification.category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Grievance.aggregate([
      { $match: { ai_classification: { $exists: true } } },
      { $group: { _id: '$ai_classification.priority', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Grievance.find({ 
      ai_classification: { $exists: true },
      'ai_classification.timestamp': { $exists: true }
    })
    .sort({ 'ai_classification.timestamp': -1 })
    .limit(10)
    .select('title ai_classification.category ai_classification.priority ai_classification.confidence ai_classification.timestamp')
  ]);

  // Calculate average confidence
  const confidenceStats = await Grievance.aggregate([
    { $match: { 'ai_classification.confidence': { $exists: true } } },
    {
      $group: {
        _id: null,
        avgConfidence: { $avg: '$ai_classification.confidence' },
        minConfidence: { $min: '$ai_classification.confidence' },
        maxConfidence: { $max: '$ai_classification.confidence' }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      total_classified: totalClassified,
      classifications_by_category: classificationsByCategory,
      classifications_by_priority: classificationsByPriority,
      confidence_stats: confidenceStats[0] || {
        avgConfidence: 0,
        minConfidence: 0,
        maxConfidence: 0
      },
      recent_classifications: recentClassifications
    }
  });
}));

// @desc    Retrain or update AI model (placeholder for future ML pipeline)
// @route   POST /api/ai/retrain
// @access  Private (DAO only)
router.post('/retrain', [
  verifyToken,
  authorize('dao'),
  body('model_type')
    .isIn(['classification', 'verification', 'both'])
    .withMessage('Invalid model type'),
  body('training_data_start_date')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format')
], validateRequest, asyncHandler(async (req, res) => {
  const { model_type, training_data_start_date } = req.body;

  // This is a placeholder for future ML pipeline integration
  // In a real implementation, this would trigger model retraining
  
  const startDate = training_data_start_date 
    ? new Date(training_data_start_date) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

  // Get training data statistics
  const trainingDataStats = await Promise.all([
    Grievance.countDocuments({ 
      createdAt: { $gte: startDate },
      ai_classification: { $exists: true }
    }),
    TaskAssignment.countDocuments({ 
      completed_at: { $gte: startDate },
      'verification.ai_verification': { $exists: true }
    })
  ]);

  // Simulate retraining process
  const retrainingJob = {
    job_id: `retrain_${Date.now()}`,
    model_type,
    status: 'queued',
    training_data: {
      grievances: trainingDataStats[0],
      verifications: trainingDataStats[1]
    },
    started_at: new Date(),
    estimated_completion: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
  };

  res.json({
    success: true,
    message: 'Model retraining initiated',
    data: retrainingJob
  });
}));

export default router;