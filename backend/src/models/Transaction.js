import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  // Transaction identification
  transaction_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  tx_hash: {
    type: String,
    sparse: true, // Blockchain transaction hash (if applicable)
    index: true
  },
  
  // Transaction type and details
  type: {
    type: String,
    enum: [
      'work_assignment', 
      'escrow_creation', 
      'escrow_release', 
      'payment_transfer',
      'bid_submission',
      'task_completion',
      'dispute_resolution'
    ],
    required: true,
    index: true
  },
  
  // Transaction participants
  from_address: {
    type: String,
    required: true,
    index: true // Wallet address of sender/initiator
  },
  to_address: {
    type: String,
    required: true,
    index: true // Wallet address of recipient
  },
  
  // Financial details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'ZENT',
    enum: ['ZENT', 'ETH', 'USD']
  },
  
  // Transaction status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // Related entities
  references: {
    grievance_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grievance',
      sparse: true,
      index: true
    },
    assignment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaskAssignment',
      sparse: true,
      index: true
    },
    bid_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkerBid',
      sparse: true,
      index: true
    },
    vote_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DAOVote',
      sparse: true,
      index: true
    }
  },
  
  // Transaction metadata
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Blockchain details
  blockchain: {
    network: {
      type: String,
      default: 'ethereum',
      enum: ['ethereum', 'polygon', 'bsc', 'local']
    },
    block_number: Number,
    gas_used: Number,
    gas_price: Number,
    confirmed_at: Date
  },
  
  // Timestamps
  initiated_at: {
    type: Date,
    default: Date.now
  },
  processed_at: Date,
  completed_at: Date,
  
  // Error handling
  error_message: String,
  retry_count: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for performance
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ from_address: 1, type: 1 });
transactionSchema.index({ to_address: 1, type: 1 });
transactionSchema.index({ 'references.grievance_id': 1 });
transactionSchema.index({ 'references.assignment_id': 1 });
transactionSchema.index({ initiated_at: -1 });

// Virtual for transaction display
transactionSchema.virtual('display_amount').get(function() {
  return `${this.amount} ${this.currency}`;
});

// Instance methods
transactionSchema.methods.markAsProcessing = function() {
  this.status = 'processing';
  this.processed_at = new Date();
  return this.save();
};

transactionSchema.methods.markAsCompleted = function(txHash = null, blockNumber = null) {
  this.status = 'completed';
  this.completed_at = new Date();
  if (txHash) {
    this.tx_hash = txHash;
  }
  if (blockNumber) {
    this.blockchain.block_number = blockNumber;
    this.blockchain.confirmed_at = new Date();
  }
  return this.save();
};

transactionSchema.methods.markAsFailed = function(errorMessage) {
  this.status = 'failed';
  this.error_message = errorMessage;
  this.retry_count += 1;
  return this.save();
};

// Static methods
transactionSchema.statics.createWorkAssignmentTransaction = function(assignmentData) {
  const transactionId = `work_assign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return new this({
    transaction_id: transactionId,
    type: 'work_assignment',
    from_address: assignmentData.dao_member_address,
    to_address: assignmentData.worker_address,
    amount: assignmentData.escrow_amount,
    description: `Work assignment for grievance: ${assignmentData.grievance_title}`,
    references: {
      grievance_id: assignmentData.grievance_id,
      assignment_id: assignmentData.assignment_id,
      bid_id: assignmentData.bid_id
    },
    metadata: {
      assigned_by: assignmentData.dao_member_address,
      assignment_reason: assignmentData.assignment_reason || 'DAO manual assignment',
      estimated_completion: assignmentData.estimated_completion
    }
  });
};

transactionSchema.statics.getTransactionHistory = function(walletAddress, limit = 50) {
  return this.find({
    $or: [
      { from_address: walletAddress },
      { to_address: walletAddress }
    ]
  })
  .populate('references.grievance_id', 'title category')
  .populate('references.assignment_id', 'status')
  .populate('references.bid_id', 'bid_amount')
  .sort({ initiated_at: -1 })
  .limit(limit);
};

transactionSchema.statics.getTransactionsByType = function(type, status = null) {
  const query = { type };
  if (status) {
    query.status = status;
  }
  return this.find(query)
    .populate('references.grievance_id', 'title category')
    .populate('references.assignment_id', 'status')
    .sort({ initiated_at: -1 });
};

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;