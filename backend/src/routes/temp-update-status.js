import express from 'express';
import Grievance from '../models/Grievance.js';

const router = express.Router();

// Temporary endpoint to update grievance statuses for marketplace
router.post('/update-grievances-for-marketplace', async (req, res) => {
  try {
    console.log('Updating grievance statuses for marketplace...');
    
    // Update all grievances with AI classification to 'classified' status
    const result = await Grievance.updateMany(
      { 
        ai_classification: { $exists: true },
        status: { $ne: 'resolved' }
      },
      { 
        $set: { 
          status: 'classified',
          isActive: true 
        } 
      }
    );
    
    console.log('Update result:', result);
    
    // Get updated grievances
    const updatedGrievances = await Grievance.find({
      status: 'classified'
    }).select('_id title status ai_classification');
    
    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} grievances for marketplace`,
      data: {
        modifiedCount: result.modifiedCount,
        updatedGrievances
      }
    });
    
  } catch (error) {
    console.error('Error updating grievances:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update grievances',
      error: error.message
    });
  }
});

export default router;