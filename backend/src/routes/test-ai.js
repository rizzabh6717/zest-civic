import express from 'express';
import { classifyGrievance } from '../services/aiService.js';
import Grievance from '../models/Grievance.js';

const router = express.Router();

// Test endpoint to manually trigger AI classification
router.post('/classify/:grievanceId', async (req, res) => {
  try {
    const { grievanceId } = req.params;
    
    console.log(`🧪 Manual AI classification test for grievance: ${grievanceId}`);
    
    // Check if grievance exists
    const grievance = await Grievance.findById(grievanceId);
    if (!grievance) {
      return res.status(404).json({
        success: false,
        message: 'Grievance not found'
      });
    }
    
    console.log('📋 Testing grievance:', {
      id: grievance._id,
      title: grievance.title,
      currentStatus: grievance.status,
      currentCategory: grievance.category,
      currentClassification: grievance.ai_classification
    });
    
    // Run AI classification
    const result = await classifyGrievance(grievanceId);
    
    // Get updated grievance
    const updatedGrievance = await Grievance.findById(grievanceId);
    
    res.json({
      success: true,
      message: 'AI classification completed successfully',
      data: {
        classification: result,
        updatedGrievance: {
          id: updatedGrievance._id,
          title: updatedGrievance.title,
          status: updatedGrievance.status,
          category: updatedGrievance.category,
          priority: updatedGrievance.priority,
          ai_classification: updatedGrievance.ai_classification,
          ai_tags: updatedGrievance.ai_tags
        }
      }
    });
    
  } catch (error) {
    console.error('🚨 AI classification test failed:', error);
    res.status(500).json({
      success: false,
      message: 'AI classification test failed',
      error: error.message
    });
  }
});

// Test endpoint to check all grievances needing AI classification
router.get('/pending', async (req, res) => {
  try {
    const pendingGrievances = await Grievance.find({ 
      status: 'pending',
      ai_classification: { $exists: false }
    }).select('_id title category status created_at');
    
    res.json({
      success: true,
      message: `Found ${pendingGrievances.length} grievances needing AI classification`,
      data: pendingGrievances
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending grievances',
      error: error.message
    });
  }
});

// Test endpoint to classify all pending grievances
router.post('/classify-all', async (req, res) => {
  try {
    const pendingGrievances = await Grievance.find({ 
      status: 'pending'
    }).select('_id title');
    
    console.log(`🔄 Starting batch AI classification for ${pendingGrievances.length} grievances`);
    
    const results = [];
    
    for (const grievance of pendingGrievances) {
      try {
        console.log(`🤖 Processing grievance: ${grievance._id}`);
        const classification = await classifyGrievance(grievance._id);
        results.push({
          grievanceId: grievance._id,
          title: grievance.title,
          success: true,
          classification
        });
      } catch (error) {
        console.error(`❌ Failed to classify grievance ${grievance._id}:`, error.message);
        results.push({
          grievanceId: grievance._id,
          title: grievance.title,
          success: false,
          error: error.message
        });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      message: `Batch classification completed: ${successful} successful, ${failed} failed`,
      data: {
        summary: { total: results.length, successful, failed },
        results
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Batch classification failed',
      error: error.message
    });
  }
});

export default router;