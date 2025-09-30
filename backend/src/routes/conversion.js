import express from 'express';
import { query, body } from 'express-validator';
import { verifyToken, authorize } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { 
  getAVAXPriceInINR, 
  convertINRToAVAX, 
  convertAVAXToINR, 
  updateAVAXPrice 
} from '../services/blockchainService.js';
import { validateRequest } from '../utils/validation.js';

const router = express.Router();

// @desc    Get current AVAX price in INR
// @route   GET /api/conversion/price
// @access  Public
router.get('/price', asyncHandler(async (req, res) => {
  const price = await getAVAXPriceInINR();

  res.json({
    success: true,
    data: {
      avax_price_inr: price,
      currency_pair: 'AVAX/INR',
      last_updated: new Date().toISOString()
    }
  });
}));

// @desc    Convert INR to AVAX
// @route   GET /api/conversion/inr-to-avax
// @access  Public
router.get('/inr-to-avax', [
  query('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number')
], validateRequest, asyncHandler(async (req, res) => {
  const { amount } = req.query;
  const amountINR = parseFloat(amount);

  const avaxAmount = await convertINRToAVAX(amountINR);
  const currentPrice = await getAVAXPriceInINR();

  res.json({
    success: true,
    data: {
      input_amount_inr: amountINR,
      output_amount_avax: avaxAmount,
      exchange_rate: currentPrice,
      calculation: `${amountINR} INR ÷ ${currentPrice} INR/AVAX = ${avaxAmount} AVAX`
    }
  });
}));

// @desc    Convert AVAX to INR
// @route   GET /api/conversion/avax-to-inr
// @access  Public
router.get('/avax-to-inr', [
  query('amount')
    .isFloat({ min: 0.001 })
    .withMessage('Amount must be a positive number')
], validateRequest, asyncHandler(async (req, res) => {
  const { amount } = req.query;
  const amountAVAX = parseFloat(amount);

  const inrAmount = await convertAVAXToINR(amountAVAX);
  const currentPrice = await getAVAXPriceInINR();

  res.json({
    success: true,
    data: {
      input_amount_avax: amountAVAX,
      output_amount_inr: inrAmount,
      exchange_rate: currentPrice,
      calculation: `${amountAVAX} AVAX × ${currentPrice} INR/AVAX = ${inrAmount} INR`
    }
  });
}));

// @desc    Update AVAX price (DAO only)
// @route   PUT /api/conversion/price
// @access  Private (DAO only)
router.put('/price', [
  verifyToken,
  authorize('dao'),
  body('price')
    .isFloat({ min: 1 })
    .withMessage('Price must be a positive number'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Reason must be less than 200 characters')
], validateRequest, asyncHandler(async (req, res) => {
  const { price, reason = 'Price update by DAO' } = req.body;

  const result = await updateAVAXPrice(price);

  if (result.success) {
    res.json({
      success: true,
      message: 'AVAX price updated successfully',
      data: {
        old_price: await getAVAXPriceInINR(),
        new_price: price,
        updated_by: req.user.wallet_address,
        reason: reason,
        transaction_hash: result.transactionHash,
        block_number: result.blockNumber
      }
    });
  } else {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update AVAX price',
        details: result.error
      }
    });
  }
}));

// @desc    Get conversion history (mock implementation)
// @route   GET /api/conversion/history
// @access  Public
router.get('/history', [
  query('days')
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage('Days must be between 1 and 90')
], validateRequest, asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const currentPrice = await getAVAXPriceInINR();

  // Mock historical data (in production, this would come from a database)
  const history = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Simulate price fluctuation (±5% of current price)
    const variation = (Math.random() - 0.5) * 0.1; // ±5%
    const price = currentPrice * (1 + variation);
    
    history.push({
      date: date.toISOString().split('T')[0],
      price: Math.round(price * 100) / 100,
      volume_inr: Math.floor(Math.random() * 1000000) + 100000, // Mock volume
      volume_avax: Math.floor(Math.random() * 1000) + 100
    });
  }

  res.json({
    success: true,
    data: {
      period_days: days,
      currency_pair: 'AVAX/INR',
      current_price: currentPrice,
      history: history
    }
  });
}));

// @desc    Batch conversion calculator
// @route   POST /api/conversion/batch
// @access  Public
router.post('/batch', [
  body('conversions')
    .isArray({ min: 1, max: 10 })
    .withMessage('Conversions array must contain 1-10 items'),
  body('conversions.*.from')
    .isIn(['INR', 'AVAX'])
    .withMessage('From currency must be INR or AVAX'),
  body('conversions.*.to')
    .isIn(['INR', 'AVAX'])
    .withMessage('To currency must be INR or AVAX'),
  body('conversions.*.amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number')
], validateRequest, asyncHandler(async (req, res) => {
  const { conversions } = req.body;
  const currentPrice = await getAVAXPriceInINR();
  
  const results = await Promise.all(
    conversions.map(async (conversion, index) => {
      const { from, to, amount } = conversion;
      
      if (from === to) {
        return {
          index,
          input: { currency: from, amount },
          output: { currency: to, amount },
          error: 'Cannot convert currency to itself'
        };
      }

      try {
        let convertedAmount;
        if (from === 'INR' && to === 'AVAX') {
          convertedAmount = await convertINRToAVAX(amount);
        } else if (from === 'AVAX' && to === 'INR') {
          convertedAmount = await convertAVAXToINR(amount);
        }

        return {
          index,
          input: { currency: from, amount },
          output: { currency: to, amount: convertedAmount },
          exchange_rate: currentPrice,
          success: true
        };
      } catch (error) {
        return {
          index,
          input: { currency: from, amount },
          output: null,
          error: 'Conversion failed',
          success: false
        };
      }
    })
  );

  res.json({
    success: true,
    data: {
      exchange_rate: currentPrice,
      timestamp: new Date().toISOString(),
      results: results
    }
  });
}));

export default router;