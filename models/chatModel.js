const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    businessName: {
      type: String,
    },
    lastMessage: {
      type: String,
    },
    lastMessageTime: {
      type: Date,
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    participants: {
      user: { type: String, ref: 'User' },
      business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
    },
  },
  { timestamps: true }
);

// Create compound index for userId and businessId
chatSchema.index({ userId: 1, businessId: 1 }, { unique: true });

module.exports = mongoose.model('Chat', chatSchema);
