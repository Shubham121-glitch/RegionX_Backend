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
    origin: [
      "http://localhost:5173",
      "https://regionx-official.vercel.app"
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});
attachChatSocket(io);

// CORS configuration
// CORS configuration (Production Safe)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://regionx-official.vercel.app'
];

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://regionx-official.vercel.app");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  next();
});

app.use(cors({
  origin: function (origin, callback) {

    // allow requests without origin (mobile apps, curl, postman)
    if (!origin) return callback(null, true);

    // allow localhost
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // allow ALL vercel preview deployments
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }

    console.log("Blocked by CORS:", origin);
    return callback(new Error('Not allowed by CORS'));
  },

  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ]
}));

// Explicitly handle OPTIONS preflight
// The line below only handles OPTIONS for the root path '/'.
// If you need to handle pre-flight for *all* routes, use:
//   app.options('*', cors());
// If you want to keep it scoped to '/', leave as-is.
// app.options('/*', cors());

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

const PORT = process.env.PORT || 5000;

// Connect to Database and Start Server
connectDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Database connection failed:', err);
  process.exit(1);
});

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