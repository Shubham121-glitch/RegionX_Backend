const express = require('express');
const router = express.Router();
const Region = require('../models/regionModel.js');
const upload = require('../config/multer.js');

// POST /api/regions - Create new region with file uploads
router.post('/', upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 5 },
  { name: 'placeImages', maxCount: 20 }
]), async (req, res) => {
  try {
    const {
      regionName,
      shortDescription,
      detailedDescription,
      history,
      culturalValues,
      traditions,
      placesToVisit
    } = req.body;

    // Auto-generate slug from region name
    const slug = regionName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Validate required fields
    if (!regionName || !shortDescription || !detailedDescription) {
      return res.status(400).json({ message: 'Required fields are missing' });
    }

    // Check if slug already exists
    const existingRegion = await Region.findOne({ slug });
    if (existingRegion) {
      return res.status(400).json({ message: 'Region with this slug already exists' });
    }

    // Process uploaded files
    const files = req.files;
    
    // Thumbnail
    const thumbnail = files.thumbnail ? `/uploads/${files.thumbnail[0].filename}` : '';
    
    // Images
    const images = files.images ? files.images.map(file => `/uploads/${file.filename}`) : [];
    
    // Videos
    const videos = files.videos ? files.videos.map(file => `/uploads/${file.filename}`) : [];
    
    // Parse places to visit
    let parsedPlaces = [];
    if (placesToVisit) {
      try {
        parsedPlaces = JSON.parse(placesToVisit);
        // Add images to places if uploaded
        if (files.placeImages) {
          parsedPlaces = parsedPlaces.map((place, index) => ({
            ...place,
            image: files.placeImages[index] ? `/uploads/${files.placeImages[index].filename}` : ''
          }));
        }
      } catch (e) {
        console.error('Error parsing placesToVisit:', e);
      }
    }

    // Create new region
    const newRegion = new Region({
      regionName,
      slug,
      thumbnail,
      images,
      videos,
      shortDescription,
      detailedDescription,
      history,
      culturalValues,
      traditions,
      placesToVisit: parsedPlaces
    });

    const savedRegion = await newRegion.save();
    res.status(201).json({
      message: 'Region created successfully',
      region: savedRegion
    });
  } catch (error) {
    console.error('Error creating region:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/regions - Get all regions
router.get('/', async (req, res) => {
  try {
    const regions = await Region.find({}, {
      regionName: 1,
      slug: 1,
      thumbnail: 1,
      shortDescription: 1,
      createdAt: 1
    }).sort({ createdAt: -1 });
    
    res.json(regions);
  } catch (error) {
    console.error('Error fetching regions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/regions/:id - Get single region by ID
router.get('/:id', async (req, res) => {
  try {
    const region = await Region.findById(req.params.id);
    
    if (!region) {
      return res.status(404).json({ message: 'Region not found' });
    }
    
    res.json(region);
  } catch (error) {
    console.error('Error fetching region:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/regions/slug/:slug - Get region by slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const region = await Region.findOne({ slug: req.params.slug });
    
    if (!region) {
      return res.status(404).json({ message: 'Region not found' });
    }
    
    res.json(region);
  } catch (error) {
    console.error('Error fetching region:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /api/regions/:id - Delete region
router.delete('/:id', async (req, res) => {
  try {
    const region = await Region.findByIdAndDelete(req.params.id);
    
    if (!region) {
      return res.status(404).json({ message: 'Region not found' });
    }
    
    res.json({ message: 'Region deleted successfully' });
  } catch (error) {
    console.error('Error deleting region:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
