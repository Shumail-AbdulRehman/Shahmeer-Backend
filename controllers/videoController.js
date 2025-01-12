
const fs = require('fs')

const cloudinary = require('../config/cloudinary')



const Video = require('../models/Video')



const LikeDislike = require('../models/LikeDislike')



const Comment = require('../models/Comment')


exports.getRandomVideo = async (req, res) => {
  try {
    const user = req.header('Authorization').replace('User ', '')
    if (user) {
      const video = await Video.findOne({ creator: user })
      if (video) return res.status(200).json(video._doc)
    }
    const randomVideo = await Video.aggregate([{ $sample: { size: 1 } }])

    res.status(200).json({ video: randomVideo[0] })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch a random video' })
  }
}





exports.getVideoById = async (req, res) => {
  const { videoId } = req.params
  const user = req.header('Authorization')?.replace('User ', '') 

  try {
    let video

    if (videoId && videoId !== 'random') {
      video = await Video.findOne({
        _id: videoId,
        ...(user && { creator: user }) 
      })
        .select('-__v')
        .populate('creator', 'username email') 

      if (!video) {
        return res.status(404).json({ message: 'Video not found' })
      }
    } else {
      const filter = user ? { creator: user } : {} 
      const videosCount = await Video.countDocuments(filter)

      if (videosCount === 0) {
        return res.status(404).json({ message: 'No videos available' })
      }

      const randomIndex = Math.floor(Math.random() * videosCount)
      video = await Video.findOne(filter).skip(randomIndex).select('-__v')
    }

    const comments = await Comment.findOne({ video: video._id })
      .populate('comments.user', 'username email') 
      .sort({ createdAt: -1 }) 
      .select('comments') 

    const nextVideo = await Video.findOne({
      _id: { $gt: video._id },
      ...(user && { creator: user }) 
    }).sort({ _id: 1 })

    const prevVideo = await Video.findOne({
      _id: { $lt: video._id },
      ...(user && { creator: user }) 
    }).sort({ _id: -1 })

    const likeDisLike = await LikeDislike.findOne({
      video: video._id
    })

    const likeCount = await LikeDislike.countDocuments({
      video: video._id,
      type: 'like'
    })

    const dislikeCount = await LikeDislike.countDocuments({
      video: video._id,
      type: 'dislike'
    })

    res.status(200).json({
      video: {
        ...video._doc,
        nextId: nextVideo ? nextVideo._id : null,
        prevId: prevVideo ? prevVideo._id : null,
        creator: video.creator,
        likes: showCounts(likeCount),
        dislikes: showCounts(dislikeCount),
        isLike: likeDisLike ? likeDisLike?.type === 'like' : false,
        isDislike: likeDisLike ? likeDisLike?.type === 'dislike' : false
      },
      comments: comments?.comments
    })
  } catch (error) {
    console.error('Error fetching video data:', error)
    res
      .status(500)
      .json({ message: 'An error occurred while fetching video data' })
  }
}

const showCounts = number => {
  if (number >= 1000000000) {
    return (number / 1000000000).toString() + 'B'
  } else if (number >= 1000000) {
    return (number / 1000000).toString() + 'M'
  } else if (number >= 1000) {
    return (number / 1000).toString() + 'K'
  } else {
    return number.toString()
  }
}






exports.getVideos = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query 

    const skip = (page - 1) * limit 
    const totalVideos = await Video.countDocuments() 

    const videos = await Video.find()
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 }) 
      .populate('creator', 'name email') 
      .exec()

    const totalPages = Math.ceil(totalVideos / limit)

    res.status(200).json({
      videos,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalVideos,
        perPage: parseInt(limit)
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Error retrieving videos', error })
  }
}

exports.likeOrDislikeVideo = async (req, res) => {
  try {
    const { videoId, type } = req.body 
    const userId = req.user._id
    if (!['like', 'dislike'].includes(type)) {
      return res.status(400).json({ message: 'Invalid action type' })
    }

    let video = await LikeDislike.findOne({
      video: videoId,
      user: userId
    })
    console.log(video)
    if (video) {
      video.type = type
      await video.save()
    } else {
      video = new LikeDislike({
        user: userId,
        video: videoId,
        type
      })

      await video.save()
    }


    const likeCount = await LikeDislike.countDocuments({
      video: videoId,
      type: 'like'
    })
    const dislikeCount = await LikeDislike.countDocuments({
      video: videoId,
      type: 'dislike'
    })
    const stats = {
      likes: likeCount,
      dislikes: dislikeCount,
      isLike: type === 'like',
      isDislike: type === 'dislike'
    }

    res.status(201).json({ success: `Video ${type}d successfully`, stats })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Error processing like/dislike', error })
  }
}

exports.addComment = async (req, res) => {
  try {
    const { videoId, comment } = req.body
    const userId = req.user._id

    let comments = await Comment.findOne({ video: videoId })
    if (comments) {
      comments.comments.push({ user: userId, comment })
    } else {
      comments = new Comment({
        video: videoId,
        comments: [{ user: userId, comment }]
      })
    }
    await comments.save()

    res.status(201).json({
      success: 'Comment added successfully',
      comment: comments.comments.slice(-1)[0]
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Error adding comment', error })
  }
}


exports.updateVideo = async (req, res) => {
  try {
    const { videoId } = req.params
    const { title, description, tags } = req.body

    const video = await Video.findById(videoId)
    if (!video) {
      return res.status(404).json({ message: 'Video not found' })
    }

    if (video.creator.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: 'Unauthorized to update this video' })
    }

    video.title = title || video.title
    video.description = description || video.description
    video.tags = tags || video.tags

    await video.save()

    res.status(200).json({ message: 'Video updated successfully', video })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Error updating video', error })
  }
}
exports.deleteVideo = async (req, res) => {
  try {
    const { videoId } = req.params

    const video = await Video.findById(videoId)
    if (!video) {
      return res.status(404).json({ message: 'Video not found' })
    }

    if (video.creator.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: 'Unauthorized to delete this video' })
    }

    const videoPath = path.join(__dirname, '..', 'uploads', video.videoUrl)
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath) 
    }

    await video.remove()

    res.status(200).json({ message: 'Video deleted successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Error deleting video', error })
  }
}


// exports.getVideoById = async (req, res) => {
//   const { videoId } = req.params
//   const user = req.header('Authorization')?.replace('User ', '') // Check if user exists

//   try {
//     let video

//     if (videoId && videoId !== 'random') {
//       // Fetch the video by its ID
//       video = await Video.findOne({
//         _id: videoId,
//         ...(user && { creator: user }) // Match creator if user exists
//       })
//         .select('-__v')
//         .populate('creator', 'username email') // Populate user details

//       if (!video) {
//         return res.status(404).json({ message: 'Video not found' })
//       }
//     } else {
//       // Fetch a random video
//       const filter = user ? { creator: user } : {} // Match creator if user exists
//       const videosCount = await Video.countDocuments(filter)

//       if (videosCount === 0) {
//         return res.status(404).json({ message: 'No videos available' })
//       }

//       const randomIndex = Math.floor(Math.random() * videosCount)
//       video = await Video.findOne(filter).skip(randomIndex).select('-__v')
//     }

//     // Fetch comments related to the video
//     const comments = await Comment.findOne({ video: video._id })
//       .populate('comments.user', 'username email') // Populate user details
//       .sort({ createdAt: -1 }) // Sort comments by newest first
//       .select('comments') // Exclude unnecessary fields

//     // Check for next and previous videos for pagination
//     const nextVideo = await Video.findOne({
//       _id: { $gt: video._id },
//       ...(user && { creator: user }) // Match creator if user exists
//     }).sort({ _id: 1 })

//     const prevVideo = await Video.findOne({
//       _id: { $lt: video._id },
//       ...(user && { creator: user }) // Match creator if user exists
//     }).sort({ _id: -1 })

//     const likeDisLike = await LikeDislike.findOne({
//       video: video._id
//     })

//     const likeCount = await LikeDislike.countDocuments({
//       video: video._id,
//       type: 'like'
//     })

//     const dislikeCount = await LikeDislike.countDocuments({
//       video: video._id,
//       type: 'dislike'
//     })

//     res.status(200).json({
//       video: {
//         ...video._doc,
//         nextId: nextVideo ? nextVideo._id : null,
//         prevId: prevVideo ? prevVideo._id : null,
//         creator: video.creator,
//         likes: showCounts(likeCount),
//         dislikes: showCounts(dislikeCount),
//         isLike: likeDisLike ? likeDisLike?.type === 'like' : false,
//         isDislike: likeDisLike ? likeDisLike?.type === 'dislike' : false
//       },
//       comments: comments?.comments
//     })
//   } catch (error) {
//     console.error('Error fetching video data:', error)
//     res
//       .status(500)
//       .json({ message: 'An error occurred while fetching video data' })
//   }
// }

// const showCounts = number => {
//   // show the numbers in form of K M B
//   if (number >= 1000000000) {
//     return (number / 1000000000).toString() + 'B'
//   } else if (number >= 1000000) {
//     return (number / 1000000).toString() + 'M'
//   } else if (number >= 1000) {
//     return (number / 1000).toString() + 'K'
//   } else {
//     return number.toString()
//   }
// }

exports.uploadVideo = async (req, res) => {
  try {
    if (req.user.role !== 'creator') {
      return res
        .status(403)
        .json({ message: 'Access denied. Only creators can upload videos.' })
    }

    if (!req.files || !req.files.video) {
      return res.status(400).json({ message: 'No video file uploaded' })
    }

    const { video } = req.files 
    const { title, description, tags, hashtags } = req.body 

    
    const result = await cloudinary.uploader.upload(video.tempFilePath, {
      resource_type: 'video',
      folder: 'videos'
    })

    
    const newVideo = new Video({
      title,
      tags: tags ? tags.split(',') : [],
      description,
      hashtags: hashtags ? hashtags.split(',') : [],
      url: result.secure_url, 
      public_id: result.public_id, 
      creator: req.user._id 
    })
    console.log(newVideo)
    await newVideo.save()
    fs.unlinkSync(video.tempFilePath) 

    res
      .status(201)
      .json({ message: 'Video uploaded successfully', video: newVideo })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Video upload failed', error })
  }
}


exports.searchVideos = async (req, res) => {
  try {
    const { query } = req.query 
    const page = parseInt(req.query.page) || 1
    const limit = 10 

    const searchCondition = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } },
        { hashtags: { $regex: query, $options: 'i' } }
      ]
    }

    const videos = await Video.find(searchCondition)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 }) 

    res.status(200).json({ videos })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Error fetching videos', error })
  }
}

