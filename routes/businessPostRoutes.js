const express = require('express');
const router = express.Router();
const BusinessPost = require('../models/businessPostModel');
const Business = require('../models/businessModel');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const upload = require('../config/multer.js');

// Create business post
router.post('/', ClerkExpressRequireAuth(), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  try {
    const userId = req.auth.userId;
    
    // Get form data
    const postData = {
      title: req.body.title,
      description: req.body.description,
      offer: req.body.offer || '',
      region: req.body.region,
      location: req.body.location
    };
    
    // Add file paths if uploaded
    if (req.files) {
      if (req.files.image) {
        postData.image = `/uploads/${req.files.image[0].filename}`;
      }
      if (req.files.video) {
        postData.video = `/uploads/${req.files.video[0].filename}`;
      }
    }
    
    // Find user's business
    const business = await Business.findOne({ userId });
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    
    // Check if business is verified
    if (business.verificationStatus !== 'Verified') {
      return res.status(403).json({ message: 'Only verified businesses can create posts' });
    }
    
    const post = new BusinessPost({
      businessId: business._id,
      ...postData
    });
    
    await post.save();
    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ message: 'Failed to create post', error: error.message });
  }
});

// Get posts by business ID
router.get('/business/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    
    // Validate that businessId is a valid MongoDB ObjectId
    if (!businessId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid business ID format' });
    }
    
    const posts = await BusinessPost.find({ businessId })
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Failed to fetch posts' });
  }
});

// Get posts by region
router.get('/region/:region', async (req, res) => {
  try {
    const posts = await BusinessPost.find({ region: req.params.region })
      .populate('businessId', 'businessTitle category verificationStatus')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Failed to fetch posts' });
  }
});

// Get all posts
router.get('/', async (req, res) => {
  try {
    const posts = await BusinessPost.find()
      .populate('businessId', 'businessTitle category verificationStatus contactInfo')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Failed to fetch posts' });
  }
});

// Delete post
router.delete('/:id', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const post = await BusinessPost.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Find user's business
    const business = await Business.findOne({ userId });
    if (!business || business._id.toString() !== post.businessId.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    await BusinessPost.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Failed to delete post' });
  }
});

module.exports = router;
