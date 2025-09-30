import { validationResult } from 'express-validator';
import { ValidationError } from '../middleware/errorMiddleware.js';

// Middleware to handle validation results
export const validateRequest = (req, res, next) => {
  console.log('🔍 Validating request body:', req.body);
  console.log('🔍 Request userType specifically:', req.body.userType);
  
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    console.log('❌ Validation errors:', errorMessages);
    console.log('📝 Request body was:', req.body);
    
    // For DAO users, let's be more specific about what failed
    if (req.body.userType === 'dao') {
      console.log('❌ DAO authentication validation failed:', errorMessages);
    }

    throw new ValidationError(`Validation failed: ${errorMessages.map(e => e.message).join(', ')}`);
  }
  
  console.log('✅ Validation passed');
  next();
};

// Custom validation functions
export const isValidWalletAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export const isValidTransactionHash = (hash) => {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
};

export const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

export const sanitizeString = (str, maxLength = 1000) => {
  if (!str || typeof str !== 'string') return '';
  
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ''); // Basic XSS prevention
};

export const validateImageUrl = (url) => {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const validDomains = [
      'ipfs.io',
      'pinata.cloud',
      'imgur.com',
      'cloudinary.com',
      'amazonaws.com'
    ];
    
    return validDomains.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
};

export const validatePagination = (page, limit) => {
  const validatedPage = Math.max(1, parseInt(page) || 1);
  const validatedLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  
  return {
    page: validatedPage,
    limit: validatedLimit,
    skip: (validatedPage - 1) * validatedLimit
  };
};

export const validateSortField = (sort, allowedFields = []) => {
  if (!sort) return '-createdAt'; // Default sort
  
  const direction = sort.startsWith('-') ? '-' : '';
  const field = sort.replace(/^-/, '');
  
  if (allowedFields.length > 0 && !allowedFields.includes(field)) {
    return '-createdAt'; // Fallback to default
  }
  
  return direction + field;
};