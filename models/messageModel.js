const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    senderType: {
      type: String,
      enum: ['user', 'business'],
      required: true,
    },
    receiverId: {
      type: String,
      required: false,
    },
    message: {
      type: String,
      required: true,
    },
    seen: {
      type: Boolean,
      default: false,
      index: true,
    },
    seenAt: {
      type: Date,
    },
    mediaUrl: {
      type: String,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video', 'document'],
    },
  },
  { timestamps: true }
);

// Index for efficient querying
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ chatId: 1, seen: 1 });

module.exports = mongoose.model('Message', messageSchema);
