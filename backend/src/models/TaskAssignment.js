import mongoose from 'mongoose';

const taskAssignmentSchema = new mongoose.Schema({
  grievance_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grievance',
    required: true,
    unique: true, // One assignment per grievance
    index: true
  },
  worker_id: {
    type: String,
    required: true,
    index: true // Wallet address
  },
  bid_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkerBid',
    required: true
  },
  assigned_at: {
    type: Date,
    default: Date.now
  },
  estimated_completion: {
    type: Date,
    required: true
  },
  started_at: {
    type: Date,
    default: null
  },
  completed_at: {
    type: Date,
    default: null
  },
  verified_at: {
    type: Date,
    default: null
  },
  escrow_amount: {
    type: Number,
    required: true,
    min: 0
  },
  escrow_tx_hash: {
    type: String,
    default: null // Blockchain transaction hash for escrow creation
  },
  escrow_block_number: {
    type: Number,
    default: null
  },
  error_message: {
    type: String,
    default: null // For tracking any assignment errors
  },
  // Task progress and updates
  status: {
    type: String,
    enum: ['assigned', 'started', 'in_progress', 'completed', 'verified', 'disputed', 'cancelled'],
    default: 'assigned',
    index: true
  },
  progress_updates: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    message: {
      type: String,
      required: true,
      maxlength: 500
    },
    image_url: String,
    worker_id: String // Who posted the update
  }],
  // Verification details
  verification: {
    proof_image_url: String,
    proof_description: String,
    citizen_approval: {
      type: Boolean,
      default: null
    },
    citizen_feedback: String,
    ai_verification: {
      approved: {
        type: Boolean,
        default: null
      },
      confidence: Number,
      analysis: String,
      timestamp: Date
    },
    dao_verification: {
      required: {
        type: Boolean,
        default: false
      },
      approved: {
        type: Boolean,
        default: null
      },
      verified_by: String, // DAO member wallet address
      reason: String,
      timestamp: Date
    },
    final_status: {
      type: String,
      enum: ['approved', 'rejected', 'disputed', 'pending'],
      default: 'pending'
    }
  },
  // Payment details
  payment: {
    escrow_released: {
      type: Boolean,
      default: false
    },
    release_tx_hash: String,
    release_block_number: Number,
    released_at: Date,
    release_amount: Number,
    // Penalties or bonuses
    penalty_amount: {
      type: Number,
      default: 0
    },
    bonus_amount: {
      type: Number,
      default: 0
    },
    penalty_reason: String,
    bonus_reason: String
  },
  // Deadline management
  deadline_extensions: [{
    requested_by: String, // worker_id
    original_deadline: Date,
    new_deadline: Date,
    reason: String,
    approved: Boolean,
    approved_by: String, // citizen_id or dao member
    requested_at: Date,
    decided_at: Date
  }],
  // Dispute handling
  dispute: {
    raised: {
      type: Boolean,
      default: false
    },
    raised_by: String, // citizen_id or worker_id
    raised_at: Date,
    reason: String,
    evidence: [String], // Array of image URLs or documents
    resolution: {
      resolved: {
        type: Boolean,
        default: false
      },
      resolved_by: String, // dao member wallet address
      resolution: String,
      resolved_at: Date,
      compensation: {
        to_citizen: Number,
        to_worker: Number,
        to_dao: Number
      }
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
taskAssignmentSchema.index({ worker_id: 1, status: 1 });
taskAssignmentSchema.index({ status: 1, estimated_completion: 1 });
taskAssignmentSchema.index({ 'payment.escrow_released': 1 });

// Virtual relationships
taskAssignmentSchema.virtual('grievance', {
  ref: 'Grievance',
  localField: 'grievance_id',
  foreignField: '_id',
  justOne: true
});

taskAssignmentSchema.virtual('worker', {
  ref: 'User',
  localField: 'worker_id',
  foreignField: 'wallet_address',
  justOne: true
});

taskAssignmentSchema.virtual('bid', {
  ref: 'WorkerBid',
  localField: 'bid_id',
  foreignField: '_id',
  justOne: true
});

// Instance methods
taskAssignmentSchema.methods.isOverdue = function() {
  return new Date() > this.estimated_completion && !this.completed_at;
};

taskAssignmentSchema.methods.canBeStarted = function() {
  return this.status === 'assigned';
};

taskAssignmentSchema.methods.canBeCompleted = function() {
  return ['started', 'in_progress'].includes(this.status);
};

taskAssignmentSchema.methods.canBeVerified = function() {
  return this.status === 'completed' && this.verification.proof_image_url;
};

taskAssignmentSchema.methods.addProgressUpdate = function(message, imageUrl = null, workerId = null) {
  this.progress_updates.push({
    message,
    image_url: imageUrl,
    worker_id: workerId || this.worker_id,
    timestamp: new Date()
  });
  return this.save();
};

taskAssignmentSchema.methods.calculateCompletionTime = function() {
  if (!this.completed_at || !this.started_at) return null;
  return Math.abs(this.completed_at - this.started_at) / (1000 * 60 * 60); // Hours
};

// Static methods
taskAssignmentSchema.statics.getWorkerAssignments = function(workerId, status = null) {
  const query = { worker_id: workerId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('grievance')
    .populate('bid')
    .sort({ assigned_at: -1 });
};

taskAssignmentSchema.statics.getOverdueAssignments = function() {
  return this.find({
    estimated_completion: { $lt: new Date() },
    status: { $in: ['assigned', 'started', 'in_progress'] }
  })
  .populate('grievance')
  .populate('worker');
};

taskAssignmentSchema.statics.getPendingVerifications = function() {
  return this.find({
    status: 'completed',
    'verification.final_status': 'pending'
  })
  .populate('grievance')
  .populate('worker');
};

// Pre-save middleware to update estimated completion
taskAssignmentSchema.pre('save', async function(next) {
  if (this.isNew && this.bid_id) {
    try {
      const bid = await mongoose.model('WorkerBid').findById(this.bid_id);
      if (bid && bid.estimated_completion_time) {
        const hoursToAdd = bid.estimated_completion_time;
        this.estimated_completion = new Date(this.assigned_at.getTime() + (hoursToAdd * 60 * 60 * 1000));
      }
    } catch (error) {
      console.error('Error setting estimated completion:', error);
    }
  }
  next();
});

const TaskAssignment = mongoose.model('TaskAssignment', taskAssignmentSchema);

export default TaskAssignment;