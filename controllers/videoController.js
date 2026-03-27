const Video = require('../models/videoModel');
const BusinessPost = require('../models/businessPostModel');
const Business = require('../models/businessModel');
const mongoose = require('mongoose');
const { clerkClient } = require('@clerk/clerk-sdk-node');

// Helper to get auth data in a version-safe way
const getAuthData = (req) => {
  return typeof req.auth === 'function' ? req.auth() : req.auth;
};

// Get videos with pagination (Global Feed)
exports.getVideos = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const videosFromCollection = await Video.find()
      .sort({ createdAt: -1 })
      .limit(100) 
      .lean();

    const postsWithVideos = await BusinessPost.find({ video: { $ne: '' } })
      .populate('businessId', 'businessTitle userId logo')
      .sort({ createdAt: -1 })
      .lean();

    const mappedPosts = postsWithVideos.map(post => ({
      _id: post._id,
      userId: post.businessId?.userId || 'Business',
      videoUrl: post.video,
      caption: post.title,
      uploaderName: post.businessId?.businessTitle || 'Business',
      uploaderImage: post.businessId?.logo || '',
      uploaderEmail: '',
      createdAt: post.createdAt,
      isBusinessPost: true
    }));

    const collectionVideos = videosFromCollection.map(v => ({ ...v, isBusinessPost: false }));

    let allVideos = [...collectionVideos, ...mappedPosts]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const userIdsToFetch = [...new Set(allVideos.filter(v => !v.isBusinessPost).map(v => v.userId))];
    let userMap = {};
    if (userIdsToFetch.length > 0) {
      try {
        const users = await clerkClient.users.getUserList({ userId: userIdsToFetch });
        users.forEach(u => {
          userMap[u.id] = {
            name: u.fullName || 'User',
            image: u.imageUrl || '',
            email: u.emailAddresses?.[0]?.emailAddress || ''
          };
        });
      } catch (err) {}
    }

    const finalFeed = allVideos.map(v => {
      if (v.isBusinessPost) return v;
      const u = userMap[v.userId] || { name: 'User', image: '', email: '' };
      return { ...v, uploaderName: u.name, uploaderImage: u.image, uploaderEmail: u.email };
    });

    const paginated = finalFeed.slice(skip, skip + limit);
    res.json({ videos: paginated, total: finalFeed.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error', error: error.message });
  }
};

// Get videos for a specific user (Profile)
exports.getUserVideos = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch from Video collection
    const personalShorts = await Video.find({ userId }).sort({ createdAt: -1 }).lean();

    // Also fetch from BusinessPost if the user is a business
    const businessPosts = await BusinessPost.find()
      .populate({
        path: 'businessId',
        match: { userId: userId },
        select: 'businessTitle logo userId'
      })
      .lean();

    const filteredPosts = businessPosts.filter(p => p.businessId && p.video).map(post => ({
      _id: post._id,
      videoUrl: post.video,
      caption: post.title,
      uploaderName: post.businessId.businessTitle,
      uploaderImage: post.businessId.logo,
      isBusinessPost: true,
      createdAt: post.createdAt
    }));

    const combined = [...personalShorts, ...filteredPosts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, videos: combined });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching profile shorts', error: error.message });
  }
};

// Create Video
exports.createVideo = async (req, res) => {
  try {
    const auth = getAuthData(req);
    const userId = auth?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Login' });
    const { caption } = req.body;
    const file = req.files?.video?.[0];
    if (!file) return res.status(400).json({ success: false, message: 'No file' });
    const videoUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const newVideo = new Video({ userId, videoUrl, caption: caption || '' });
    await newVideo.save();
    res.status(201).json({ success: true, data: newVideo });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error', error: error.message });
  }
};

// Like/Unlike (Preserved)
exports.likeVideo = async (req, res) => {
  try {
    const auth = getAuthData(req);
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ success: false });
    if (!video.likes.some(l => l.userId === auth.userId)) {
      video.likes.push({ userId: auth.userId });
      await video.save();
    }
    res.json({ success: true, likeCount: video.likes.length });
  } catch (e) { res.status(500).json({ success: false }); }
};

exports.unlikeVideo = async (req, res) => {
  try {
    const auth = getAuthData(req);
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ success: false });
    video.likes = video.likes.filter(l => l.userId !== auth.userId);
    await video.save();
    res.json({ success: true, likeCount: video.likes.length });
  } catch (e) { res.status(500).json({ success: false }); }
};