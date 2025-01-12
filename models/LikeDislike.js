// models/LikeDislike.js
const mongoose = require('mongoose');

const likeDislikeSchema = new mongoose.Schema({
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: { type: String, enum: ['like', 'dislike'], required: true },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('LikeDislike', likeDislikeSchema);
