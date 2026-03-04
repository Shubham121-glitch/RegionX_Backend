const express = require('express');
const router = express.Router();
const Review = require('../models/reviewModel.js');
const Region = require('../models/regionModel.js');
const Business = require('../models/businessModel.js');
const upload = require('../config/multer.js');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Helper function to update region rating
const updateRegionRating = async (regionId) => {
  const reviews = await Review.find({ regionId });
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
    : 0;
  
  await Region.findByIdAndUpdate(regionId, {
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews
  });
};

// POST /api/reviews - Add new review
router.post('/', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    const { regionId, userId, username, userImage, rating, comment } = req.body;
    
    // Validate required fields
    if (!regionId || !userId || !username || !rating || !comment) {
      return res.status(400).json({ message: 'Required fields are missing' });
    }
    
    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    
    // Check if user already reviewed this region
    const existingReview = await Review.findOne({ regionId, userId });
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this region' });
    }
    
    // Process uploaded files
    const files = req.files;
    const image = files.image ? `/uploads/${files.image[0].filename}` : '';
    const video = files.video ? `/uploads/${files.video[0].filename}` : '';
    
    // Create new review
    const newReview = new Review({
      regionId,
      userId,
      username,
      userImage: userImage || '',
      rating: parseInt(rating),
      comment,
      image,
      video
    });
    
    const savedReview = await newReview.save();
    
    // Update region rating
    await updateRegionRating(regionId);
    
    res.status(201).json({
      message: 'Review added successfully',
      review: savedReview
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/reviews/:regionId - Get all reviews for a region
router.get('/:regionId', async (req, res) => {
  try {
    const reviews = await Review.find({ regionId: req.params.regionId })
      .sort({ createdAt: -1 });
    
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/reviews/user/:userId - Get all reviews by a user
router.get('/user/:userId', async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.params.userId })
      .sort({ createdAt: -1 });
    
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT /api/reviews/:id - Edit review
router.put('/:id', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    const { userId, rating, comment } = req.body;
    
    // Find review
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    // Check ownership
    if (review.userId !== userId) {
      return res.status(403).json({ message: 'You can only edit your own reviews' });
    }
    
    // Validate rating
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    
    // Process uploaded files
    const files = req.files;
    if (files.image) {
      review.image = `/uploads/${files.image[0].filename}`;
    }
    if (files.video) {
      review.video = `/uploads/${files.video[0].filename}`;
    }
    
    // Update fields
    if (rating) review.rating = parseInt(rating);
    if (comment) review.comment = comment;
    review.updatedAt = Date.now();
    
    const updatedReview = await review.save();
    
    // Update region rating
    await updateRegionRating(review.regionId);
    
    res.json({
      message: 'Review updated successfully',
      review: updatedReview
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /api/reviews/:id - Delete review
router.delete('/:id', async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Find review
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    // Check ownership
    if (review.userId !== userId) {
      return res.status(403).json({ message: 'You can only delete your own reviews' });
    }
    
    const regionId = review.regionId;
    
    await Review.findByIdAndDelete(req.params.id);
    
    // Update region rating
    await updateRegionRating(regionId);
    
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/reviews/:reviewId/reply - Add reply to review (Business owner only)
router.post('/:reviewId/reply', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const { text } = req.body;
    const { reviewId } = req.params;
    const userId = req.auth.userId;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Reply text is required' });
    }
    
    // Find review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    // Check if user is a business owner
    const business = await Business.findOne({ userId });
    if (!business) {
      return res.status(403).json({ message: 'Only business owners can reply to reviews' });
    }
    
    // Add reply
    review.reply = {
      text: text.trim(),
      repliedBy: userId,
      repliedAt: new Date()
    };
    
    await review.save();
    
    res.json({
      message: 'Reply added successfully',
      review
    });
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT /api/reviews/:reviewId/reply - Edit reply (Business owner only)
router.put('/:reviewId/reply', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const { text } = req.body;
    const { reviewId } = req.params;
    const userId = req.auth.userId;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Reply text is required' });
    }
    
    // Find review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    // Check if reply exists
    if (!review.reply || !review.reply.text) {
      return res.status(404).json({ message: 'No reply found to edit' });
    }
    
    // Check if user is the one who replied
    if (review.reply.repliedBy !== userId) {
      return res.status(403).json({ message: 'You can only edit your own replies' });
    }
    
    // Update reply
    review.reply.text = text.trim();
    review.reply.repliedAt = new Date();
    
    await review.save();
    
    res.json({
      message: 'Reply updated successfully',
      review
    });
  } catch (error) {
    console.error('Error updating reply:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /api/reviews/:reviewId/reply - Delete reply (Business owner only)
router.delete('/:reviewId/reply', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.auth.userId;
    
    // Find review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    // Check if reply exists
    if (!review.reply || !review.reply.text) {
      return res.status(404).json({ message: 'No reply found to delete' });
    }
    
    // Check if user is the one who replied
    if (review.reply.repliedBy !== userId) {
      return res.status(403).json({ message: 'You can only delete your own replies' });
    }
    
    // Remove reply
    review.reply = {
      text: '',
      repliedBy: '',
      repliedAt: null
    };
    
    await review.save();
    
    res.json({
      message: 'Reply deleted successfully',
      review
    });
  } catch (error) {
    console.error('Error deleting reply:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/reviews/:reviewId/vote - Vote helpful/not helpful
router.post('/:reviewId/vote', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const { voteType } = req.body;
    const { reviewId } = req.params;
    const userId = req.auth.userId;
    
    // Validate vote type
    if (!voteType || !['helpful', 'notHelpful'].includes(voteType)) {
      return res.status(400).json({ message: 'Invalid vote type. Use "helpful" or "notHelpful"' });
    }
    
    // Find review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    // Check if user already voted
    const existingVoteIndex = review.voters.findIndex(v => v.userId === userId);
    
    if (existingVoteIndex !== -1) {
      const existingVote = review.voters[existingVoteIndex];
      
      // If same vote type, remove vote (toggle off)
      if (existingVote.voteType === voteType) {
        if (voteType === 'helpful') {
          review.helpfulVotes = Math.max(0, review.helpfulVotes - 1);
        } else {
          review.notHelpfulVotes = Math.max(0, review.notHelpfulVotes - 1);
        }
        review.voters.splice(existingVoteIndex, 1);
      } else {
        // Switch vote type
        if (existingVote.voteType === 'helpful') {
          review.helpfulVotes = Math.max(0, review.helpfulVotes - 1);
          review.notHelpfulVotes++;
        } else {
          review.notHelpfulVotes = Math.max(0, review.notHelpfulVotes - 1);
          review.helpfulVotes++;
        }
        existingVote.voteType = voteType;
      }
    } else {
      // New vote
      review.voters.push({ userId, voteType });
      if (voteType === 'helpful') {
        review.helpfulVotes++;
      } else {
        review.notHelpfulVotes++;
      }
    }
    
    await review.save();
    
    res.json({
      message: 'Vote recorded successfully',
      review: {
        _id: review._id,
        helpfulVotes: review.helpfulVotes,
        notHelpfulVotes: review.notHelpfulVotes,
        userVote: review.voters.find(v => v.userId === userId)?.voteType || null
      }
    });
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/reviews/:reviewId/vote-status - Get user's vote status
router.get('/:reviewId/vote-status', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.auth.userId;
    
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    const userVote = review.voters.find(v => v.userId === userId);
    
    res.json({
      hasVoted: !!userVote,
      voteType: userVote?.voteType || null
    });
  } catch (error) {
    console.error('Error fetching vote status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
