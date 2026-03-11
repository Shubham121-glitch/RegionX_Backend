const defaults = [
  'http://localhost:5173',
  'https://regionx-official.netlify.app'
];

const envOrigin = process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [];
const allowedOrigins = Array.from(new Set([...defaults, ...envOrigin])).filter(Boolean);

const origin = (o, cb) => {
  if (!o) return cb(null, true);
  if (allowedOrigins.includes(o)) return cb(null, true);
  return cb(new Error('Not allowed by CORS'));
};

const corsOptions = {
  origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

module.exports = { corsOptions, allowedOrigins };

