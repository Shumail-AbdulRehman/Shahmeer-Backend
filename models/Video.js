// models/Video.js
const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    tags: [{ type: String }],
    hashtags: [{ type: String }],
    url: { type: String, required: true }, // Cloudinary URL of the video
    public_id: { type: String, required: true }, // Cloudinary public_id for deletion
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  });
  

module.exports = mongoose.model('Video', videoSchema);
