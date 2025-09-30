import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Debug endpoint to check authentication
router.get('/check-auth', verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'Authentication successful',
    user: {
      wallet_address: req.user.wallet_address,
      user_type: req.user.user_type,
      display_name: req.user.display_name,
      reputation: req.user.reputation,
      verification_status: req.user.verification_status
    }
  });
});

// Debug endpoint to check what's in localStorage
router.get('/check-token', (req, res) => {
  const authHeader = req.headers.authorization;
  res.json({
    success: true,
    authHeader: authHeader ? 'Present' : 'Missing',
    token: authHeader ? authHeader.substring(0, 20) + '...' : 'No token'
  });
});

export default router;