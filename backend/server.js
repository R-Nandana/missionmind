const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Observation = require('./models/Observation');
const seed = require('./seed');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = express();
const PORT = Number(process.env.PORT || process.env.BACKEND_PORT || 3001);

// CORS — allow localhost in dev and the deployed Vercel frontend in production
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL,        // e.g. https://missionmind-xxx.vercel.app
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no origin) and any allowed origin
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true
}));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/observations', require('./routes/observations'));

// Database connection & startup
async function startServer() {
  let mongoUri = process.env.MONGODB_URI;
  let isMemory = false;

  try {
    if (!mongoUri) {
      console.log('No MONGODB_URI provided. Starting in-memory MongoDB server...');
      const mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      isMemory = true;
    }

    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
      console.log('Connected to MongoDB successfully');
    } catch (connectionErr) {
      if (!isMemory) {
        console.warn(`Warning: Could not connect to MONGODB_URI: ${connectionErr.message}`);
        console.log('Falling back to in-memory MongoDB server so backend remains healthy...');
        const mongoServer = await MongoMemoryServer.create();
        mongoUri = mongoServer.getUri();
        isMemory = true;
        await mongoose.connect(mongoUri);
        console.log('Connected to fallback in-memory MongoDB');
      } else {
        throw connectionErr;
      }
    }

    // Auto-seed if database is empty
    const count = await Observation.countDocuments();
    if (count === 0) {
      console.log('No observations found in database. Auto-seeding dataset...');
      await seed(mongoUri);
    } else {
      console.log(`Database ready with ${count} observations.`);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Backend server listening on 0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Fatal backend startup error:', err);
    // Still start Express server so health checks and error diagnostics can respond
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Backend server running in degraded mode on 0.0.0.0:${PORT}`);
    });
  }
}

startServer();

