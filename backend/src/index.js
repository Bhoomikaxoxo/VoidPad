import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import vaultRouter from './routes/vault.js';
import { apiLimiter } from './middleware/rateLimiter.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable trust proxy for correct client IP detection (crucial on Render/Vercel)
app.set('trust proxy', 1);

// Middleware
app.use(morgan('dev'));
app.use(cors({
  origin: '*', // Allow all origins for the keyless vault API access
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply general rate limiting
app.use(apiLimiter);

// Render cold-start status check endpoint
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
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Void Pad backend listening on port ${PORT}`);
});
