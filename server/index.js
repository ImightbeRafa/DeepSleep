import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import tilopayRoutes from './routes/tilopay.js';
import emailRoutes from './routes/email.js';
import stockStatusHandler from '../api/stock-status.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'DeepSleep API is running' });
});

app.get('/api/stock-status', stockStatusHandler);

// Routes
app.use('/api/tilopay', tilopayRoutes);
app.use('/api/email', emailRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 DeepSleep API Server running on http://localhost:${PORT}`);
  console.log(`📝 Tilopay webhook URL: http://localhost:${PORT}/api/tilopay/webhook`);
});
