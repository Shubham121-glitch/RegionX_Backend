const express = require('express');
const router = express.Router();
const Business = require('../models/businessModel.js');
const Region = require('../models/regionModel.js');

// GET /api/services - Get services with filtering
router.get('/', async (req, res) => {
  try {
    const { region, category, lat, lng, radius = 50 } = req.query;
    
    let filter = {};
    
    // Filter by region (region is stored as regionName string in Business model)
    if (region) {
      // First get the region name from the region ID
      const regionData = await Region.findById(region);
      if (regionData) {
        filter.regions = { $in: [regionData.regionName] };
      } else {
        // If not found by ID, try matching directly (in case region name was passed)
        filter.regions = { $in: [region] };
      }
    }
    
    // Filter by category
    if (category) {
      filter.category = category;
    }
    
    // Filter by location (if lat and lng provided)
    if (lat && lng) {
      // For now, we'll return all businesses and let frontend sort by distance
      // In production, you could use MongoDB geospatial queries
      // This requires storing coordinates in the Business model
    }
    
    // Only show verified businesses by default
    // Uncomment the next line if you want to filter by verification status
    // filter.verificationStatus = 'Verified';
    
    const services = await Business.find(filter)
      .sort({ createdAt: -1 });
    
    // If location is provided, calculate distance and sort
    if (lat && lng) {
      const servicesWithDistance = services.map(service => {
        const serviceObj = service.toObject();
        
        // Calculate approximate distance if business has coordinates
        // This is a simplified calculation - for production use proper geospatial queries
        if (service.coordinates && service.coordinates.lat && service.coordinates.lng) {
          const distance = calculateDistance(
            parseFloat(lat),
            parseFloat(lng),
            service.coordinates.lat,
            service.coordinates.lng
          );
          serviceObj.distance = distance;
        } else {
          serviceObj.distance = null;
        }
        
        return serviceObj;
      });
      
      // Sort by distance (null distances go to end)
      servicesWithDistance.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
      
      return res.json(servicesWithDistance);
    }
    
    res.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ message: 'Failed to fetch services', error: error.message });
  }
});

// GET /api/services/categories - Get all unique categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Business.distinct('category');
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

// GET /api/services/region/:regionId - Get services by region
router.get('/region/:regionId', async (req, res) => {
  try {
    const { regionId } = req.params;
    
    // Get region name from ID first
    const regionData = await Region.findById(regionId);
    const regionName = regionData ? regionData.regionName : regionId;
    
    const services = await Business.find({ regions: { $in: [regionName] } })
      .sort({ createdAt: -1 });
    
    res.json(services);
  } catch (error) {
    console.error('Error fetching services by region:', error);
    res.status(500).json({ message: 'Failed to fetch services' });
  }
});

// GET /api/services/category/:category - Get services by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    
    const services = await Business.find({ category })
      .sort({ createdAt: -1 });
    
    res.json(services);
  } catch (error) {
    console.error('Error fetching services by category:', error);
    res.status(500).json({ message: 'Failed to fetch services' });
  }
});

// GET /api/services/nearby - Get services near a location
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 50 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const searchRadius = parseFloat(radius);
    
    // Find all businesses and calculate distance
    // In production, use MongoDB geospatial queries with 2dsphere index
    const businesses = await Business.find({});
    
    const nearbyServices = businesses
      .map(business => {
        const businessObj = business.toObject();
        
        // Calculate distance
        if (business.coordinates && business.coordinates.lat && business.coordinates.lng) {
          const distance = calculateDistance(
            latitude,
            longitude,
            business.coordinates.lat,
            business.coordinates.lng
          );
          businessObj.distance = distance;
          return businessObj;
        }
        return null;
      })
      .filter(service => service !== null && service.distance <= searchRadius)
      .sort((a, b) => a.distance - b.distance);
    
    res.json(nearbyServices);
  } catch (error) {
    console.error('Error fetching nearby services:', error);
    res.status(500).json({ message: 'Failed to fetch nearby services' });
  }
});

// Helper function to calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

module.exports = router;
