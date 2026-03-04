const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  region: { type: String, required: true },
  city: { type: String, required: true },
  area: { type: String, required: true },
  placeName: { type: String, required: true },
  mapLink: { type: String, default: '' }
});

const businessSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  businessTitle: { type: String, required: true },
  category: { 
    type: String, 
    required: true,
    enum: ['Guide', 'Medical', 'Restaurants', 'Home Stays', 'Travel and Transport']
  },
  licenseNumber: { type: String, default: '' },
  licenseDocument: { type: String, default: '' },
  profileImage: { type: String, default: '' },
  verificationStatus: { 
    type: String, 
    default: 'Pending Verification',
    enum: ['Pending Verification', 'Verified', 'Rejected']
  },
  regions: [{ type: String }],
  locations: [locationSchema],
  description: { type: String, required: true },
  contactInfo: {
    phone: { type: String, required: true },
    whatsapp: { type: String, default: '' },
    email: { type: String, required: true }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Business', businessSchema);
