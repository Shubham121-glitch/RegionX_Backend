const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const { requireAuth } = require('@clerk/clerk-sdk-node');

// Public route to get videos with pagination
router.get('/', videoController.getVideos);

// Protected routes for like/unlike
router.post('/:id/like', requireAuth(), videoController.likeVideo);
router.delete('/:id/unlike', requireAuth(), videoController.unlikeVideo);

module.exports = router;