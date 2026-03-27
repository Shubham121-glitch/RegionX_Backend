const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const upload = require('../config/multer.js');

/**
 * Middleware to require a valid Clerk session.
 * req.auth() is the new standard for @clerk/express
 */
const requireAuth = (req, res, next) => {
  const auth = typeof req.auth === 'function' ? req.auth() : req.auth;
  
  if (!auth || !auth.userId) {
    console.warn(`[AUTH] Unauthorized access to ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ success: false, message: 'Unauthorized. Please sign in.' });
  }
  
  // Re-attach to req for convenience (though typically clerkMiddleware does this)
  req.authData = auth; 
  next();
};

// --- ROUTES ---

// Get all shorts videos (Feed)
router.get('/', videoController.getVideos);

// Get user-specific shorts (Profile)
router.get('/user/:userId', videoController.getUserVideos);

// Protected: Upload a new short (User or Business)
router.post('/', requireAuth, upload.fields([{ name: 'video', maxCount: 1 }]), videoController.createVideo);

// Protected: Like/Unlike interactions
router.post('/:id/like', requireAuth, videoController.likeVideo);
router.delete('/:id/unlike', requireAuth, videoController.unlikeVideo);

module.exports = router;