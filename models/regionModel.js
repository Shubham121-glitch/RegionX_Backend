const mongoose = require('mongoose');

const placeToVisitSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: ''
  }
});

const regionSchema = new mongoose.Schema({
  regionName: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  thumbnail: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  videos: [{
    type: String
  }],
  shortDescription: {
    type: String,
    required: true
  },
  detailedDescription: {
    type: String,
    required: true
  },
  history: {
    type: String,
    required: true
  },
  culturalValues: {
    type: String,
    required: true
  },
  traditions: {
    type: String,
    required: true
  },
  placesToVisit: [placeToVisitSchema],
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Region', regionSchema);
