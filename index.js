const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db.js');
const userRoutes = require('./routes/userRoutes.js');
const regionRoutes = require('./routes/regionRoutes.js');
const reviewRoutes = require('./routes/reviewRoutes.js');
const businessRoutes = require('./routes/businessRoutes.js');
const businessPostRoutes = require('./routes/businessPostRoutes.js');
const serviceRoutes = require('./routes/serviceRoutes.js');
const chatRoutes = require('./routes/chatRoutes.js');
const geminiRoutes = require('./routes/geminiRoutes.js');
const { attachChatSocket } = require('./chatSocket.js');
const videoRoutes = require('./routes/videoRoutes');
const { clerkClient, ClerkExpressRequireAuth, requireAuth } = require('@clerk/clerk-sdk-node');
const { clerkMiddleware } = require('@clerk/express');

const app = express();

const server = http.createServer(app);
dotenv.config();

// Clerk configuration check
const clerkPubKey = process.env.CLERK_PUBLISHABLE_KEY;
const clerkSecretKey = process.env.CLERK_SECRET_KEY;

if (!clerkPubKey || !clerkSecretKey) {
  console.error('Missing Clerk keys. Please add CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to your .env file');
  process.exit(1);
}

// Socket.io configuration
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});
attachChatSocket(io);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Apply Clerk middleware globally to populate req.auth
app.use(clerkMiddleware());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/business-posts', businessPostRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', geminiRoutes);
app.use('/api/videos', videoRoutes);

app.get('/', (req, res) => {
  res.send('RegionX API Server');
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: `Not Found - ${req.originalUrl}` });
});

// Express error handler
app.use((err, req, res, next) => {
  console.error('[Express error]', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 5000;
const MAX_PORT_ATTEMPTS = 25; // try 5000..5024 if ports are busy

function startServer(port) {
  return new Promise((resolve, reject) => {
    const onListen = () => {
      server.off('error', onError);
      const actualPort = (server.address && server.address().port) ? server.address().port : port;
      console.log(`Server running on port ${actualPort}`);
      if (actualPort !== DEFAULT_PORT) {
        console.warn(`⚠️ Port ${DEFAULT_PORT} was in use. Using port ${actualPort} instead. Update .env or free the port.`);
      }
      // reflect actual listening port in env for other tools/tests
      process.env.PORT = String(actualPort);
      resolve(actualPort);
    };

    const onError = (err) => {
      server.off('listening', onListen);
      reject(err);
    };

    server.once('listening', onListen);
    server.once('error', onError);
    server.listen(port, '0.0.0.0');
  });
}

(async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error('Database connection failed during startup', err);
    process.exit(1);
  }

  let lastErr;
  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
    const port = DEFAULT_PORT + attempt;
    try {
      await startServer(port);
      // started successfully
      return;
    } catch (err) {
      lastErr = err;
      if (err.code !== 'EADDRINUSE') {
        console.error('Server failed to start', err);
        process.exit(1);
      }
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
    }
  }

  // last-resort: try ephemeral port 0 (OS assigns a free port)
  try {
    console.warn(`All ports ${DEFAULT_PORT}-${DEFAULT_PORT + MAX_PORT_ATTEMPTS - 1} busy — attempting ephemeral port...`);
    const actual = await startServer(0);
    console.log(`Started on ephemeral port ${actual}. If you need a fixed port, set PORT in your .env.`);
  } catch (err) {
    console.error(`Could not bind to any port from ${DEFAULT_PORT} to ${DEFAULT_PORT + MAX_PORT_ATTEMPTS - 1}, and ephemeral port failed.`, err);
    process.exit(1);
  }
})();

// Global/unhandled error handlers & graceful shutdown
const _shutdown = (info) => {
  console.error('[shutdown]', info);
  if (server.listening) {
    server.close(() => {
      console.log('Server closed, exiting.');
      process.exit(1);
    });
    setTimeout(() => {
      console.error('Force exit after timeout.');
      process.exit(1);
    }, 5000).unref();
  } else {
    process.exit(1);
  }
};

process.on('uncaughtException', (err) => {
  console.error('uncaughtException', err);
  _shutdown(err);
});

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection', reason);
  _shutdown(reason);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down server.');
  if (server.listening) server.close(() => process.exit(0)); else process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down server.');
  if (server.listening) server.close(() => process.exit(0)); else process.exit(0);
});

module.exports = app;