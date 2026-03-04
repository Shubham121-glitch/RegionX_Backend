const mongoose = require('mongoose');

const businessPostSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  offer: { type: String, default: '' },
  image: { type: String, required: true },
  video: { type: String, default: '' },
  region: { type: String, required: true },
  location: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BusinessPost', businessPostSchema);
