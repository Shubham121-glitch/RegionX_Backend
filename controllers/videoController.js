const Video = require('../models/videoModel');
const mongoose = require('mongoose');

// Get videos with pagination
exports.getVideos = async (req, res) => {
  try {
    // Hard-coded sample videos
    const sampleVideos = [
      {
        _id: "1",
        videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        thumbnail: "/uploads/thumbnail-1771234243549-593830835.jpeg",
        title: "Sample Video 1",
        likes: [],
        createdAt: new Date(),
      },
      {
        _id: "2",
        videoUrl: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4",
        thumbnail: "/uploads/thumbnail-1771311259024-990410469.jpg",
        title: "Sample Video 2",
        likes: [],
        createdAt: new Date(),
      },
      {
        _id: "3",
        videoUrl: "https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4",
        thumbnail: "/uploads/videos-1771311259257-515953631.png",
        title: "Sample Video 3",
        likes: [],
        createdAt: new Date(),
      }
    ];
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const videos = sampleVideos.slice(skip, skip + limit);
    const total = sampleVideos.length;
    res.json({ videos, total, page, limit });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ message: 'Failed to fetch videos' });
  }
};

// Like a video
exports.likeVideo = async (req, res) => {
  try {
    const videoId = req.params.id;
    const userId = req.auth.userId; // Assuming Clerk middleware sets req.auth

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({ message: 'Invalid video ID' });
    }

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Prevent duplicate likes
    if (video.likes.some(like => like.userId === userId)) {
      return res.status(400).json({ message: 'Already liked' });
    }

    video.likes.push({ userId });
    await video.save();

    res.json({ likeCount: video.likes.length });
  } catch (error) {
    console.error('Error liking video:', error);
    res.status(500).json({ message: 'Failed to like video' });
  }
};

// Unlike a video
exports.unlikeVideo = async (req, res) => {
  try {
    const videoId = req.params.id;
    const userId = req.auth.userId; // Assuming Clerk middleware sets req.auth

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({ message: 'Invalid video ID' });
    }

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const likeIndex = video.likes.findIndex(like => like.userId === userId);
    if (likeIndex === -1) {
      return res.status(400).json({ message: 'Not liked yet' });
    }

    video.likes.splice(likeIndex, 1);
    await video.save();

    res.json({ likeCount: video.likes.length });
  } catch (error) {
    console.error('Error unliking video:', error);
    res.status(500).json({ message: 'Failed to unlike video' });
  }
};