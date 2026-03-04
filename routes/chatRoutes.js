/**
 * Chat API – RegionX
 * REST only. Real-time is handled by chatSocket.js (Socket.IO).
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Chat = require('../models/chatModel.js');
const Message = require('../models/messageModel.js');
const Business = require('../models/businessModel.js');

// ---- List & unread (must be before /:businessId) ----

router.get('/list/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [totalChats, chats] = await Promise.all([
      Chat.countDocuments({ userId }),
      Chat.find({ userId }).sort({ lastMessageTime: -1 }).skip(skip).limit(limit).lean(),
    ]);

    const enriched = await Promise.all(
      chats.map(async (c) => {
        const unreadCount = await Message.countDocuments({
          chatId: c._id,
          senderType: 'business',
          seen: false,
        });
        const business = await Business.findById(c.businessId).lean();
        const img = business?.profileImage || '';
        return {
          ...c,
          unreadCount,
          businessLogo: img,
          businessImage: img,
          businessCategory: business?.category,
        };
      })
    );

    res.json({
      success: true,
      chats: enriched,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalChats / limit),
        totalChats,
        itemsPerPage: limit,
      },
    });
  } catch (err) {
    console.error('GET /chat/list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch chat list', error: err.message });
  }
});

router.get('/unread/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const chatIds = (await Chat.find({ userId }).select('_id').lean()).map((c) => c._id);
    const totalUnread = await Message.countDocuments({
      chatId: { $in: chatIds },
      senderType: 'business',
      seen: false,
    });
    res.json({ success: true, totalUnread });
  } catch (err) {
    console.error('GET /chat/unread error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch unread count', error: err.message });
  }
});

// ---- Get or create chat + messages ----

router.get('/:businessId', async (req, res) => {
  try {
    const businessId = req.params.businessId;
    const userId = req.query.userId;

    if (!userId || !businessId) {
      return res.status(400).json({ success: false, message: 'UserId and businessId required' });
    }
    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({ success: false, message: 'Invalid businessId format' });
    }

    let chat = await Chat.findOne({ userId, businessId });

    if (!chat) {
      const business = await Business.findById(businessId);
      if (!business) {
        return res.status(404).json({ success: false, message: 'Business not found' });
      }
      chat = await Chat.create({
        userId,
        businessId,
        businessName: business.businessTitle || 'Business',
        participants: { user: userId, business: businessId },
      });
    }

    const messages = await Message.find({ chatId: chat._id })
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    await Message.updateMany(
      { chatId: chat._id, senderType: 'business', seen: false },
      { seen: true, seenAt: new Date() }
    );
    chat.unreadCount = 0;
    await chat.save();

    const business = await Business.findById(businessId).lean();

    res.json({
      success: true,
      chat,
      messages: messages || [],
      messageCount: (messages || []).length,
      business: business
        ? {
            _id: business._id,
            businessTitle: business.businessTitle,
            profileImage: business.profileImage,
            category: business.category,
          }
        : null,
    });
  } catch (err) {
    console.error('GET /chat/:businessId error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch chat', error: err.message });
  }
});

// ---- Send message ----

router.post('/send', async (req, res) => {
  try {
    const { chatId, senderId, senderType, receiverId, message: text } = req.body;

    if (!chatId || !senderId || !senderType || (text !== undefined && text !== null && String(text).trim() === '')) {
      return res.status(400).json({
        success: false,
        message: 'Required: chatId, senderId, senderType, message (non-empty)',
      });
    }
    if (!['user', 'business'].includes(senderType)) {
      return res.status(400).json({ success: false, message: 'senderType must be "user" or "business"' });
    }

    const msg = await Message.create({
      chatId,
      senderId,
      senderType,
      receiverId: receiverId || undefined,
      message: String(text).trim(),
      seen: false,
    });

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: String(text).trim().slice(0, 100),
      lastMessageTime: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: msg,
    });
  } catch (err) {
    console.error('POST /chat/send error:', err);
    res.status(500).json({ success: false, message: 'Failed to send message', error: err.message });
  }
});

// ---- Mark seen ----

router.put('/seen', async (req, res) => {
  try {
    const { chatId, userId } = req.body;
    if (!chatId || !userId) {
      return res.status(400).json({ success: false, message: 'chatId and userId required' });
    }

    const result = await Message.updateMany(
      { chatId, senderType: 'business', seen: false },
      { seen: true, seenAt: new Date() }
    );
    const unreadCount = await Message.countDocuments({ chatId, senderType: 'business', seen: false });
    await Chat.findByIdAndUpdate(chatId, { unreadCount });

    res.json({
      success: true,
      message: 'Messages marked as seen',
      markedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error('PUT /chat/seen error:', err);
    res.status(500).json({ success: false, message: 'Failed to mark as seen', error: err.message });
  }
});

// ---- Delete chat ----

router.delete('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    await Message.deleteMany({ chatId });
    const chat = await Chat.findByIdAndDelete(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }
    res.json({ success: true, message: 'Chat deleted successfully' });
  } catch (err) {
    console.error('DELETE /chat/:chatId error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete chat', error: err.message });
  }
});

module.exports = router;
