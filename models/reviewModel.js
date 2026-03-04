const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  regionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region',
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  userImage: {
    type: String,
    default: ''
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    default: ''
  },
  video: {
    type: String,
    default: ''
  },
  // Reply from business owner
  reply: {
    text: {
      type: String,
      default: ''
    },
    repliedBy: {
      type: String,
      default: ''
    },
    repliedAt: {
      type: Date,
      default: null
    }
  },
  // Voting system
  helpfulVotes: {
    type: Number,
    default: 0
  },
  notHelpfulVotes: {
    type: Number,
    default: 0
  },
  voters: [{
    userId: {
      type: String,
      required: true
    },
    voteType: {
      type: String,
      enum: ['helpful', 'notHelpful'],
      required: true
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
reviewSchema.index({ regionId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
