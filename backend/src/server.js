import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

// Import routes
import grievanceRoutes from './routes/grievances.js';
import bidRoutes from './routes/bids.js';
import daoRoutes from './routes/dao.js';
import userRoutes from './routes/users.js';
import aiRoutes from './routes/ai.js';
import testAiRoutes from './routes/test-ai.js';
import tempUpdateRoutes from './routes/temp-update-status.js';
import debugAuthRoutes from './routes/debug-auth.js';
import blockchainRoutes from './routes/blockchain.js';
import conversionRoutes from './routes/conversion.js';
import assignmentRoutes from './routes/assignments.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : ['http://localhost:8080', 'http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (uploads)
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// API routes
app.use('/api/grievances', grievanceRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/dao', daoRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/test-ai', testAiRoutes);
app.use('/api/temp', tempUpdateRoutes);
app.use('/api/debug', debugAuthRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/conversion', conversionRoutes);
app.use('/api/assignments', assignmentRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Zentigrity Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app;