import mongoose from 'mongoose';

const grievanceSchema = new mongoose.Schema({
  citizen_id: {
    type: String,
    required: true,
    index: true // Wallet address
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
    maxlength: 2000
  },
  category: {
    type: String,
    enum: ['road', 'waste', 'sewage', 'lighting', 'water', 'public_safety', 'environment', 'other'],
    default: 'other'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  image_url: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'classified', 'active', 'assigned', 'in_progress', 'completed', 'verified', 'disputed'],
    default: 'pending',
    index: true
  },
  ai_tags: [{
    type: String,
    trim: true
  }],
  ai_classification: {
    category: String,
    priority: String,
    reasoning: String,
    confidence: Number,
    timestamp: Date
  },
  blockchain_tx_hash: {
    type: String,
    default: null
  },
  blockchain_block_number: {
    type: Number,
    default: null
  },
  // Metadata for tracking
  assigned_worker_id: {
    type: String,
    default: null
  },
  assignment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaskAssignment',
    default: null
  },
  view_count: {
    type: Number,
    default: 0
  },
  bid_count: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true // Creates createdAt and updatedAt automatically
});

// Indexes for performance
grievanceSchema.index({ citizen_id: 1, status: 1 });
grievanceSchema.index({ status: 1, createdAt: -1 });
grievanceSchema.index({ category: 1, priority: 1 });
grievanceSchema.index({ location: 1 });

// Virtual for bid relationship
grievanceSchema.virtual('bids', {
  ref: 'WorkerBid',
  localField: '_id',
  foreignField: 'grievance_id'
});

// Virtual for assignment relationship
grievanceSchema.virtual('assignment', {
  ref: 'TaskAssignment',
  localField: '_id',
  foreignField: 'grievance_id',
  justOne: true
});

// Pre-save middleware to update ai_tags based on classification
grievanceSchema.pre('save', function(next) {
  if (this.ai_classification && this.ai_classification.category) {
    // Add AI classification category as a tag if not already present
    if (!this.ai_tags.includes(this.ai_classification.category)) {
      this.ai_tags.push(this.ai_classification.category);
    }
    
    // Add priority as tag
    if (!this.ai_tags.includes(this.ai_classification.priority)) {
      this.ai_tags.push(this.ai_classification.priority);
    }
  }
  next();
});

// Instance method to check if grievance can receive bids
grievanceSchema.methods.canReceiveBids = function() {
  return ['classified', 'active'].includes(this.status);
};

// Instance method to check if grievance is assigned
grievanceSchema.methods.isAssigned = function() {
  return ['assigned', 'in_progress', 'completed', 'verified'].includes(this.status);
};

// Static method to get grievances by status
grievanceSchema.statics.getByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

// Static method to get grievances for marketplace (available for bidding)
grievanceSchema.statics.getMarketplaceGrievances = function() {
  return this.find({ 
    status: { $in: ['classified', 'active'] } 
  })
  .populate('bids')
  .sort({ priority: 1, createdAt: -1 }); // High priority first, then recent
};

const Grievance = mongoose.model('Grievance', grievanceSchema);

export default Grievance;