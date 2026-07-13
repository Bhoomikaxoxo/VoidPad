import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import vaultRouter from './routes/vault.js';
import { apiLimiter } from './middleware/rateLimiter.js';

const app = express();

// Enable trust proxy for correct client IP detection (crucial on Render/Vercel)
app.set('trust proxy', 1);

// Middleware
app.use(compression());
app.use(morgan('dev'));
app.use(cors({
  origin: '*', // Allow all origins for keyless vault API access
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply general rate limiting
app.use(apiLimiter);

// Status check endpoint
app.get('/api/status', (req, res) => {
  res.json({ status: 'ready', timestamp: new Date() });
});

// Vault Routes & Cleanup endpoints
app.use('/', vaultRouter);

// 404 Route
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || err.toString() || 'Internal server error.' });
});

export default app;
