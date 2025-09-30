import mongoose from 'mongoose';

const workerBidSchema = new mongoose.Schema({
  grievance_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grievance',
    required: true,
    index: true
  },
  worker_id: {
    type: String,
    required: true,
    index: true // Wallet address
  },
  bid_amount: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(v) {
        return v > 0 && v <= 10000; // Maximum bid of $10,000
      },
      message: 'Bid amount must be between 0 and 10,000'
    }
  },
  proposal: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  estimated_completion_time: {
    type: Number, // In hours
    required: true,
    min: 1,
    max: 168 // Max 1 week
  },
  skills_offered: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending',
    index: true
  },
  // Worker reputation at time of bid
  worker_reputation: {
    type: Number,
    default: 0
  },
  // DAO vote details
  dao_vote: {
    vote_id: String,
    voted: {
      type: Boolean,
      default: false
    },
    vote_result: {
      type: String,
      enum: ['approved', 'rejected', 'pending'],
      default: 'pending'
    },
    vote_reason: String,
    voted_at: Date,
    voted_by: String // DAO member wallet address
  },
  // Auto-assignment metadata
  auto_assigned: {
    type: Boolean,
    default: false
  },
  assignment_reason: {
    type: String,
    enum: ['lowest_bid', 'highest_reputation', 'dao_vote', 'single_bid'],
    default: null
  }
}, {
  timestamps: true
});

// Compound indexes for performance
workerBidSchema.index({ grievance_id: 1, status: 1 });
workerBidSchema.index({ worker_id: 1, status: 1 });
workerBidSchema.index({ grievance_id: 1, bid_amount: 1 });

// Virtual for grievance relationship
workerBidSchema.virtual('grievance', {
  ref: 'Grievance',
  localField: 'grievance_id',
  foreignField: '_id',
  justOne: true
});

// Virtual for worker profile relationship
workerBidSchema.virtual('worker', {
  ref: 'User',
  localField: 'worker_id',
  foreignField: 'wallet_address',
  justOne: true
});

// Instance method to calculate bid score (for auto-assignment)
workerBidSchema.methods.calculateBidScore = function() {
  // Lower bid amount = higher score (inverted)
  const bidScore = Math.max(0, 1000 - this.bid_amount) / 1000;
  
  // Higher reputation = higher score
  const reputationScore = Math.min(this.worker_reputation / 100, 1);
  
  // Faster completion = higher score (inverted hours)
  const timeScore = Math.max(0, 168 - this.estimated_completion_time) / 168;
  
  // Weighted average: bid=40%, reputation=40%, time=20%
  return (bidScore * 0.4) + (reputationScore * 0.4) + (timeScore * 0.2);
};

// Instance method to check if bid can be withdrawn
workerBidSchema.methods.canBeWithdrawn = function() {
  return this.status === 'pending';
};

// Static method to get bids for a specific grievance
workerBidSchema.statics.getBidsForGrievance = function(grievanceId) {
  return this.find({ grievance_id: grievanceId })
    .populate('worker')
    .sort({ bid_amount: 1 }); // Lowest bid first
};

// Static method to get worker's active bids
workerBidSchema.statics.getWorkerBids = function(workerId, status = null) {
  const query = { worker_id: workerId };
  if (status) {
    query.status = status;
  }
  return this.find(query)
    .populate('grievance')
    .sort({ createdAt: -1 });
};

// Static method to find winning bid for auto-assignment
workerBidSchema.statics.findWinningBid = function(grievanceId) {
  return this.aggregate([
    { $match: { grievance_id: grievanceId, status: 'pending' } },
    {
      $addFields: {
        bidScore: {
          $add: [
            // Bid amount score (inverted, lower is better)
            { $multiply: [{ $divide: [{ $subtract: [1000, '$bid_amount'] }, 1000] }, 0.4] },
            // Reputation score
            { $multiply: [{ $min: [{ $divide: ['$worker_reputation', 100] }, 1] }, 0.4] },
            // Time score (faster completion is better)
            { $multiply: [{ $divide: [{ $subtract: [168, '$estimated_completion_time'] }, 168] }, 0.2] }
          ]
        }
      }
    },
    { $sort: { bidScore: -1 } },
    { $limit: 1 }
  ]);
};

const WorkerBid = mongoose.model('WorkerBid', workerBidSchema);

export default WorkerBid;