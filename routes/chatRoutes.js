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
const upload = require('../config/multer.js');

// ---- List & unread (must be before /:businessId) ----

router.get('/list/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    // Find businesses owned by this user
    const userBusinesses = await Business.find({ userId }).select('_id').lean();
    const businessIds = userBusinesses.map((b) => b._id);

    const [totalChats, chats] = await Promise.all([
      Chat.countDocuments({
        $or: [{ userId }, { businessId: { $in: businessIds } }],
      }),
      Chat.find({
        $or: [{ userId }, { businessId: { $in: businessIds } }],
      })
        .sort({ lastMessageTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const enriched = await Promise.all(
      chats.map(async (c) => {
        const isOwner = businessIds.some((bId) => String(bId) === String(c.businessId));
        
        let unreadCount;
        if (isOwner) {
          unreadCount = await Message.countDocuments({
            chatId: c._id,
            senderType: 'user',
            seen: false,
          });
        } else {
          unreadCount = await Message.countDocuments({
            chatId: c._id,
            senderType: 'business',
            seen: false,
          });
        }

        const business = await Business.findById(c.businessId).lean();
        const img = business?.profileImage || '';
        
        // If owner, we might want to show the customer's name, 
        // but since we don't have it in the Chat model, we'll prefix for now
        // or just use business name if that's what's expected.
        // Actually, for a business owner, they should see who the user is.
        // We can fetch the user from Clerk if needed, but let's keep it simple first.
        
        return {
          ...c,
          unreadCount,
          isOwner,
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

// ---- Get chat by specific Chat ID ----

router.get('/id/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.query;

    const chat = await Chat.findById(chatId).lean();
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    // Verify participant
    const isUser = chat.userId === userId;
    const business = await Business.findById(chat.businessId).lean();
    const isOwner = business && business.userId === userId;

    if (!isUser && !isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const messages = await Message.find({ chatId: chat._id })
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    // Mark seen for the OTHER party
    if (isUser) {
      await Message.updateMany(
        { chatId: chat._id, senderType: 'business', seen: false },
        { seen: true, seenAt: new Date() }
      );
    } else {
      await Message.updateMany(
        { chatId: chat._id, senderType: 'user', seen: false },
        { seen: true, seenAt: new Date() }
      );
    }

    res.json({
      success: true,
      chat,
      messages: messages || [],
      business: business ? {
        _id: business._id,
        businessTitle: business.businessTitle,
        profileImage: business.profileImage,
        category: business.category,
      } : null,
    });
  } catch (err) {
    console.error('GET /chat/id/:chatId error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch chat', error: err.message });
  }
});

router.get('/:businessId', async (req, res) => {
  try {
    const businessId = req.params.businessId;
    const userId = req.query.userId;

    if (!userId || !businessId) {
      return res.status(400).json({ success: false, message: 'UserId and businessId required' });
    }
    
    // Check if the user is a business owner of THIS business
    const business = await Business.findById(businessId).lean();
    const isOwner = business && business.userId === userId;

    let chat;
    if (isOwner) {
       // If owner, we need the customer's ID to find the chat. 
       // If no customer ID in query, this route is ambiguous.
       // For now, we'll try to find the most recent chat for this business if no userId provided,
       // but ideally owners should use /chat/id/:chatId
       const customerId = req.query.customerId;
       if (customerId) {
         chat = await Chat.findOne({ userId: customerId, businessId });
       } else {
         chat = await Chat.findOne({ businessId }).sort({ lastMessageTime: -1 });
       }
    } else {
       // Normal customer path
       chat = await Chat.findOne({ userId, businessId });
    }

    if (!chat && !isOwner) {
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

    if (!chat) {
       return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    const messages = await Message.find({ chatId: chat._id })
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      chat,
      messages: messages || [],
      business: business ? {
            _id: business._id,
            businessTitle: business.businessTitle,
            profileImage: business.profileImage,
            category: business.category,
          } : null,
    });
  } catch (err) {
    console.error('GET /chat/:businessId error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch chat', error: err.message });
  }
});

// ---- Send message ----

router.post('/send', upload.fields([{ name: 'image', maxCount: 1 }]), async (req, res) => {
  try {
    const { chatId, senderId, senderType, receiverId, message: text } = req.body;
    const files = req.files || {};
    const toBase64 = (file) => file ? `data:${file.mimetype};base64,${file.buffer.toString('base64')}` : '';
    const mediaUrl = files.image ? toBase64(files.image[0]) : '';

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
      message: (text || '').trim(),
      mediaUrl,
      mediaType: mediaUrl ? 'image' : undefined,
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
