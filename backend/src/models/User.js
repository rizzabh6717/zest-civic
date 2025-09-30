import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  wallet_address: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid Ethereum wallet address format'
    }
  },
  user_types: {
    type: [String],
    enum: ['citizen', 'worker', 'dao'],
    required: true,
    default: ['citizen'],
    index: true
  },
  primary_role: {
    type: String,
    enum: ['citizen', 'worker', 'dao'],
    required: true,
    default: 'citizen'
  },
  display_name: {
    type: String,
    trim: true,
    maxlength: 50,
    default: function() {
      return `${this.primary_role}_${this.wallet_address.slice(-6)}`;
    }
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    unique: true,
    sparse: true, // Allows multiple null values while maintaining uniqueness for non-null values
    validate: {
      validator: function(v) {
        return !v || /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  profile: {
    // Common profile fields
    avatar_url: String,
    bio: {
      type: String,
      maxlength: 500
    },
    location: String,
    phone: String,
    
    // Worker-specific fields
    skills: [{
      name: String,
      level: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert']
      },
      verified: {
        type: Boolean,
        default: false
      }
    }],
    portfolio_urls: [String],
    certifications: [{
      name: String,
      issuer: String,
      issue_date: Date,
      expiry_date: Date,
      certificate_url: String,
      verified: {
        type: Boolean,
        default: false
      }
    }],
    
    // DAO member fields
    dao_role: {
      type: String,
      enum: ['member', 'moderator', 'admin'],
      default: 'member'
    },
    voting_power: {
      type: Number,
      default: 1,
      min: 0
    }
  },
  reputation: {
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    total_tasks_completed: {
      type: Number,
      default: 0
    },
    total_tasks_assigned: {
      type: Number,
      default: 0
    },
    average_completion_time: {
      type: Number,
      default: 0 // In hours
    },
    positive_feedbacks: {
      type: Number,
      default: 0
    },
    negative_feedbacks: {
      type: Number,
      default: 0
    },
    success_rate: {
      type: Number,
      default: 100 // Percentage
    },
    last_updated: {
      type: Date,
      default: Date.now
    }
  },
  verification: {
    identity_verified: {
      type: Boolean,
      default: false
    },
    phone_verified: {
      type: Boolean,
      default: false
    },
    email_verified: {
      type: Boolean,
      default: false
    },
    kyc_status: {
      type: String,
      enum: ['not_started', 'pending', 'approved', 'rejected'],
      default: 'not_started'
    },
    verification_documents: [{
      type: {
        type: String,
        enum: ['id_card', 'passport', 'driver_license', 'utility_bill', 'bank_statement']
      },
      url: String,
      uploaded_at: Date,
      verified: Boolean,
      verified_at: Date
    }]
  },
  activity: {
    last_login: Date,
    total_logins: {
      type: Number,
      default: 0
    },
    grievances_submitted: {
      type: Number,
      default: 0
    },
    bids_submitted: {
      type: Number,
      default: 0
    },
    votes_cast: {
      type: Number,
      default: 0
    }
  },
  settings: {
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    },
    privacy: {
      show_reputation: {
        type: Boolean,
        default: true
      },
      show_activity: {
        type: Boolean,
        default: true
      },
      show_location: {
        type: Boolean,
        default: false
      }
    }
  },
  // Blockchain integration
  blockchain: {
    nonce: {
      type: Number,
      default: 0
    },
    last_signature_verification: Date
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'banned', 'pending_verification'],
    default: 'active',
    index: true
  }
}, {
  timestamps: true
});

// Indexes for performance
userSchema.index({ user_type: 1, 'reputation.score': -1 });
userSchema.index({ 'verification.identity_verified': 1 });
userSchema.index({ status: 1 });

// Virtual for formatted wallet address
userSchema.virtual('formatted_wallet').get(function() {
  return `${this.wallet_address.slice(0, 6)}...${this.wallet_address.slice(-4)}`;
});

// Instance methods
userSchema.methods.updateReputation = async function(taskAssignment, feedback) {
  try {
    // Calculate new reputation based on task completion
    const completionTime = taskAssignment.calculateCompletionTime();
    const estimatedTime = taskAssignment.estimated_completion;
    
    // Base score calculation
    let scoreChange = 0;
    
    if (feedback.citizen_approval) {
      scoreChange += 5; // Base points for successful completion
      
      // Bonus for completing ahead of schedule
      if (completionTime < estimatedTime) {
        scoreChange += Math.min(5, (estimatedTime - completionTime) / estimatedTime * 5);
      }
      
      this.reputation.positive_feedbacks += 1;
    } else {
      scoreChange -= 10; // Penalty for failed task
      this.reputation.negative_feedbacks += 1;
    }
    
    // Update reputation metrics
    this.reputation.total_tasks_completed += 1;
    this.reputation.average_completion_time = 
      (this.reputation.average_completion_time * (this.reputation.total_tasks_completed - 1) + completionTime) 
      / this.reputation.total_tasks_completed;
    
    this.reputation.success_rate = 
      (this.reputation.positive_feedbacks / this.reputation.total_tasks_completed) * 100;
    
    // Apply score change with bounds
    this.reputation.score = Math.max(0, Math.min(100, this.reputation.score + scoreChange));
    this.reputation.last_updated = new Date();
    
    await this.save();
    return this.reputation;
  } catch (error) {
    console.error('Error updating reputation:', error);
    throw error;
  }
};

userSchema.methods.canSubmitBid = function() {
  return this.user_types.includes('worker') && 
         this.status === 'active';
         // Removed identity_verified requirement for now
};

userSchema.methods.canVote = function() {
  return this.user_types.includes('dao') && 
         this.status === 'active' && 
         this.profile.voting_power > 0;
};

// New method to add roles
userSchema.methods.addRole = function(role) {
  if (!this.user_types.includes(role)) {
    this.user_types.push(role);
  }
  return this.save();
};

// New method to check if user has role
userSchema.methods.hasRole = function(role) {
  return this.user_types.includes(role);
};

userSchema.methods.incrementActivity = function(activityType) {
  if (this.activity[activityType] !== undefined) {
    this.activity[activityType] += 1;
  }
  this.activity.last_login = new Date();
  this.activity.total_logins += 1;
  return this.save();
};

// Static methods
userSchema.statics.findByWallet = function(walletAddress) {
  return this.findOne({ wallet_address: walletAddress.toLowerCase() });
};

userSchema.statics.getTopWorkers = function(limit = 10) {
  return this.find({ 
    user_type: 'worker',
    status: 'active',
    'reputation.total_tasks_completed': { $gt: 0 }
  })
  .sort({ 'reputation.score': -1, 'reputation.total_tasks_completed': -1 })
  .limit(limit);
};

userSchema.statics.getDAOMembers = function() {
  return this.find({ 
    user_type: 'dao',
    status: 'active'
  })
  .sort({ 'profile.voting_power': -1 });
};

// Pre-save middleware
userSchema.pre('save', function(next) {
  // Ensure wallet address is lowercase
  this.wallet_address = this.wallet_address.toLowerCase();
  
  // Set default display name if not provided
  if (!this.display_name) {
    this.display_name = `${this.user_type}_${this.wallet_address.slice(-6)}`;
  }
  
  next();
});

const User = mongoose.model('User', userSchema);

export default User;