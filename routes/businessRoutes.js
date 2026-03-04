const express = require('express');
const router = express.Router();
const Business = require('../models/businessModel');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const upload = require('../config/multer.js');

// Create business
router.post('/', ClerkExpressRequireAuth(), upload.fields([
  { name: 'licenseDocument', maxCount: 1 },
  { name: 'profileImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const userId = req.auth.userId;
    
    // Debug logging
    console.log('Files received:', req.files);
    console.log('Body received:', req.body);
    
    // Parse JSON fields from form data
    const businessData = {
      businessTitle: req.body.businessTitle,
      category: req.body.category,
      description: req.body.description,
      regions: JSON.parse(req.body.regions || '[]'),
      locations: JSON.parse(req.body.locations || '[]'),
      contactInfo: JSON.parse(req.body.contactInfo || '{}'),
      licenseNumber: req.body.licenseNumber || ''
    };
    
    // Add license document path if uploaded
    if (req.files.licenseDocument) {
      businessData.licenseDocument = `/uploads/${req.files.licenseDocument[0].filename}`;
    }
    
    // Add profile image path if uploaded
    if (req.files.profileImage) {
      businessData.profileImage = `/uploads/${req.files.profileImage[0].filename}`;
      console.log('Profile image saved:', businessData.profileImage);
    } else {
      console.log('No profile image received');
    }
    
    // Check if user already has a business
    const existingBusiness = await Business.findOne({ userId });
    if (existingBusiness) {
      return res.status(400).json({ message: 'User already has a business' });
    }
    
    // Auto-verify Home Stays category
    let verificationStatus = 'Pending Verification';
    if (businessData.category === 'Home Stays') {
      verificationStatus = 'Verified';
    }
    
    const business = new Business({
      userId,
      ...businessData,
      verificationStatus
    });
    
    await business.save();
    res.status(201).json(business);
  } catch (error) {
    console.error('Error creating business:', error);
    res.status(500).json({ message: 'Failed to create business', error: error.message });
  }
});

// Get business by user ID
router.get('/user/:userId', async (req, res) => {
  try {
    const business = await Business.findOne({ userId: req.params.userId });
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    res.json(business);
  } catch (error) {
    console.error('Error fetching business:', error);
    res.status(500).json({ message: 'Failed to fetch business' });
  }
});

// Get business by ID
router.get('/:id', async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    res.json(business);
  } catch (error) {
    console.error('Error fetching business:', error);
    res.status(500).json({ message: 'Failed to fetch business' });
  }
});

// Update business
router.put('/:id', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const business = await Business.findById(req.params.id);
    
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    
    if (business.userId !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const updatedBusiness = await Business.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    
    res.json(updatedBusiness);
  } catch (error) {
    console.error('Error updating business:', error);
    res.status(500).json({ message: 'Failed to update business' });
  }
});

// Get all businesses by region
router.get('/region/:region', async (req, res) => {
  try {
    const businesses = await Business.find({ 
      regions: req.params.region,
      verificationStatus: 'Verified'
    });
    res.json(businesses);
  } catch (error) {
    console.error('Error fetching businesses:', error);
    res.status(500).json({ message: 'Failed to fetch businesses' });
  }
});

module.exports = router;
