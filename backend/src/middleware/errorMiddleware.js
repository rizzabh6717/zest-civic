// Error handling middleware for the Zentigrity backend

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  // If headers are already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  let error = { ...err };
  error.message = err.message;

  // Log error details
  console.error(`Error ${err.message}:`, {
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value for ${field}. Please use another value.`;
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again.';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired. Please log in again.';
    error = { message, statusCode: 401 };
  }

  // Ethereum address validation error
  if (err.message && err.message.includes('Invalid Ethereum wallet address')) {
    error = { message: 'Invalid wallet address format', statusCode: 400 };
  }

  // Rate limiting error
  if (err.message && err.message.includes('Too many requests')) {
    error = { message: 'Too many requests. Please try again later.', statusCode: 429 };
  }

  // OpenAI API errors
  if (err.message && err.message.includes('OpenAI')) {
    error = { message: 'AI service temporarily unavailable', statusCode: 503 };
  }

  // Blockchain errors
  if (err.message && (err.message.includes('revert') || err.message.includes('gas'))) {
    error = { message: 'Blockchain transaction failed', statusCode: 500 };
  }

  const statusCode = error.statusCode || res.statusCode || 500;
  const message = error.message || 'Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack,
        details: err 
      })
    },
    timestamp: new Date().toISOString()
  });
};

// Async error handler wrapper
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error class
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Not authorized to access this resource') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}

export class BlockchainError extends AppError {
  constructor(message = 'Blockchain operation failed') {
    super(message, 500);
  }
}