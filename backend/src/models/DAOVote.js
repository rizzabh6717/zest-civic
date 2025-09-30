import mongoose from 'mongoose';

const daoVoteSchema = new mongoose.Schema({
  proposal_id: {
    type: String,
    required: true,
    index: true
  },
  proposal_type: {
    type: String,
    enum: ['bid_assignment', 'task_verification', 'dispute_resolution', 'governance', 'budget_allocation'],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  // Reference to the item being voted on
  reference: {
    grievance_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grievance'
    },
    bid_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkerBid'
    },
    assignment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaskAssignment'
    }
  },
  // Voting options
  voting_options: [{
    option_id: String,
    label: String,
    description: String,
    metadata: mongoose.Schema.Types.Mixed // For storing additional data like bid amounts, etc.
  }],
  // Vote tracking
  votes: [{
    voter_id: {
      type: String,
      required: true // DAO member wallet address
    },
    option_id: {
      type: String,
      required: true
    },
    voting_power: {
      type: Number,
      required: true,
      default: 1
    },
    voted_at: {
      type: Date,
      default: Date.now
    },
    signature: String, // Blockchain signature for vote verification
    tx_hash: String // Optional blockchain transaction
  }],
  // Vote configuration
  voting_config: {
    quorum_required: {
      type: Number,
      required: true,
      default: 51 // Percentage
    },
    voting_period_hours: {
      type: Number,
      required: true,
      default: 72 // 3 days
    },
    voting_type: {
      type: String,
      enum: ['simple_majority', 'qualified_majority', 'consensus', 'quadratic'],
      default: 'simple_majority'
    },
    allow_vote_change: {
      type: Boolean,
      default: false
    }
  },
  // Vote status and results
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'cancelled', 'expired'],
    default: 'draft',
    index: true
  },
  created_by: {
    type: String,
    required: true // DAO member wallet address
  },
  starts_at: {
    type: Date,
    default: Date.now
  },
  ends_at: {
    type: Date,
    required: true
  },
  // Results
  results: {
    total_votes: {
      type: Number,
      default: 0
    },
    total_voting_power: {
      type: Number,
      default: 0
    },
    option_results: [{
      option_id: String,
      vote_count: Number,
      voting_power: Number,
      percentage: Number
    }],
    winning_option: {
      option_id: String,
      label: String
    },
    quorum_reached: {
      type: Boolean,
      default: false
    },
    result_calculated_at: Date
  },
  // Execution details
  execution: {
    executed: {
      type: Boolean,
      default: false
    },
    executed_at: Date,
    executed_by: String,
    execution_tx_hash: String,
    execution_result: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for performance
daoVoteSchema.index({ status: 1, ends_at: 1 });
daoVoteSchema.index({ proposal_type: 1, status: 1 });
daoVoteSchema.index({ 'reference.grievance_id': 1 });
daoVoteSchema.index({ 'reference.bid_id': 1 });
daoVoteSchema.index({ created_by: 1 });

// Virtual for checking if vote is active
daoVoteSchema.virtual('is_active').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         this.starts_at <= now && 
         this.ends_at > now;
});

// Virtual for time remaining
daoVoteSchema.virtual('time_remaining_hours').get(function() {
  if (this.status !== 'active') return 0;
  const now = new Date();
  const remaining = this.ends_at - now;
  return Math.max(0, remaining / (1000 * 60 * 60));
});

// Instance methods
daoVoteSchema.methods.hasVoted = function(voterAddress) {
  return this.votes.some(vote => vote.voter_id.toLowerCase() === voterAddress.toLowerCase());
};

daoVoteSchema.methods.canVote = function(voterAddress) {
  return this.is_active && !this.hasVoted(voterAddress);
};

daoVoteSchema.methods.submitVote = async function(voterAddress, optionId, votingPower = 1, signature = null) {
  if (!this.canVote(voterAddress)) {
    throw new Error('Cannot vote: either vote period ended or already voted');
  }

  // Validate option exists
  const validOption = this.voting_options.find(opt => opt.option_id === optionId);
  if (!validOption) {
    throw new Error('Invalid voting option');
  }

  // Add vote
  this.votes.push({
    voter_id: voterAddress.toLowerCase(),
    option_id: optionId,
    voting_power: votingPower,
    signature: signature,
    voted_at: new Date()
  });

  // Recalculate results
  await this.calculateResults();
  return this.save();
};

daoVoteSchema.methods.calculateResults = async function() {
  // Reset results
  this.results.total_votes = this.votes.length;
  this.results.total_voting_power = this.votes.reduce((sum, vote) => sum + vote.voting_power, 0);
  
  // Calculate results per option
  const optionResults = {};
  this.voting_options.forEach(option => {
    optionResults[option.option_id] = {
      option_id: option.option_id,
      label: option.label,
      vote_count: 0,
      voting_power: 0
    };
  });

  // Count votes
  this.votes.forEach(vote => {
    if (optionResults[vote.option_id]) {
      optionResults[vote.option_id].vote_count += 1;
      optionResults[vote.option_id].voting_power += vote.voting_power;
    }
  });

  // Calculate percentages and find winner
  let winningOption = null;
  let maxVotingPower = 0;

  this.results.option_results = Object.values(optionResults).map(result => {
    result.percentage = this.results.total_voting_power > 0 
      ? (result.voting_power / this.results.total_voting_power) * 100 
      : 0;
    
    if (result.voting_power > maxVotingPower) {
      maxVotingPower = result.voting_power;
      winningOption = result;
    }
    
    return result;
  });

  // Set winning option
  if (winningOption) {
    this.results.winning_option = {
      option_id: winningOption.option_id,
      label: winningOption.label
    };
  }

  // Check quorum
  // For simplified implementation: quorum based on minimum votes required
  const totalDAOMembers = await mongoose.model('User').countDocuments({ 
    user_type: 'dao', 
    status: 'active' 
  });
  const requiredVotes = Math.ceil((totalDAOMembers * this.voting_config.quorum_required) / 100);
  this.results.quorum_reached = this.results.total_votes >= requiredVotes;

  this.results.result_calculated_at = new Date();
};

daoVoteSchema.methods.checkAndCompleteVote = async function() {
  if (this.status !== 'active') return false;

  const now = new Date();
  const hasExpired = now > this.ends_at;
  
  if (hasExpired || this.results.quorum_reached) {
    this.status = hasExpired && !this.results.quorum_reached ? 'expired' : 'completed';
    await this.calculateResults();
    await this.save();
    return true;
  }
  
  return false;
};

// Static methods
daoVoteSchema.statics.getActiveVotes = function() {
  const now = new Date();
  return this.find({
    status: 'active',
    starts_at: { $lte: now },
    ends_at: { $gt: now }
  }).sort({ ends_at: 1 });
};

daoVoteSchema.statics.createBidAssignmentVote = async function(grievanceId, bids, createdBy) {
  const grievance = await mongoose.model('Grievance').findById(grievanceId).populate('bids');
  if (!grievance) throw new Error('Grievance not found');

  const votingOptions = bids.map((bid, index) => ({
    option_id: bid._id.toString(),
    label: `Bid ${index + 1}: $${bid.bid_amount}`,
    description: `Worker: ${bid.worker_id}, Completion: ${bid.estimated_completion_time}h`,
    metadata: {
      bid_id: bid._id,
      worker_id: bid.worker_id,
      bid_amount: bid.bid_amount,
      estimated_completion_time: bid.estimated_completion_time
    }
  }));

  const endsAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours from now

  const vote = new this({
    proposal_id: `bid_assignment_${grievanceId}_${Date.now()}`,
    proposal_type: 'bid_assignment',
    title: `Assign Worker for: ${grievance.title}`,
    description: `Vote to select the best worker bid for grievance: ${grievance.description.substring(0, 100)}...`,
    reference: {
      grievance_id: grievanceId
    },
    voting_options: votingOptions,
    created_by: createdBy,
    ends_at: endsAt,
    status: 'active'
  });

  return vote.save();
};

// Pre-save middleware
daoVoteSchema.pre('save', function(next) {
  // Set ends_at if not provided
  if (this.isNew && !this.ends_at) {
    const hoursToAdd = this.voting_config.voting_period_hours || 72;
    this.ends_at = new Date(this.starts_at.getTime() + (hoursToAdd * 60 * 60 * 1000));
  }
  next();
});

const DAOVote = mongoose.model('DAOVote', daoVoteSchema);

export default DAOVote;