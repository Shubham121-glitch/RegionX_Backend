const express = require('express');
const router = express.Router();
const { ClerkExpressRequireAuth, clerkClient } = require('@clerk/clerk-sdk-node');
const User = require('../models/userModel.js');

router.post('/saveuser', async (req, res) => {
    try {
        const { id, email, firstName, lastName, profileImage } = req.body;
        
        console.log(`[SAVEUSER] Received user data:`, { id, email, firstName, lastName });
        
        // Check if user already exists
        let user = await User.findOne({ clerkId: id });
        
        if (user) {
            console.log(`[SAVEUSER] User already exists in DB`);
            return res.json({ message: 'User already exists', user });
        }
        
        // Create new user with all data
        user = await User.create({
            clerkId: id,
            email: email || '',
            firstName: firstName || '',
            lastName: lastName || '',
            profileImage: profileImage || ''
        });
        
        console.log(`[SAVEUSER] New user created with all data`);
        
        res.status(201).json({ message: 'User created successfully', user });
    } catch (error) {
        console.error(`[SAVEUSER ERROR]`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/users/me/:businessId - Get user profile by business ID
router.get('/me/:businessId', async (req, res) => {
    try {
        const { businessId } = req.params;
        
        // First get the business to get the userId
        const Business = require('../models/businessModel');
        const business = await Business.findById(businessId);
        
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }
        
        // Get user by clerkId
        const user = await User.findOne({ clerkId: business.userId });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({
            profileImage: user.profileImage,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
        });
    } catch (error) {
        console.error('[GET USER BY BUSINESS ERROR]', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
