const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  userId: { type: String, required: true },
}, { _id: false });

const commentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const videoSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  videoUrl: { type: String, required: true },
  caption: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  likes: [likeSchema],
  comments: [commentSchema],
  views: { type: Number, default: 0 },
});

module.exports = mongoose.model('Video', videoSchema);