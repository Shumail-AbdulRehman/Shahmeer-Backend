const express = require('express')
const videoController = require('../controllers/videoController')
const authenticate = require('../middlewares/authenticate')
const router = express.Router()
const fileUpload = require('express-fileupload')

router.post(
  '/upload',
  fileUpload({
    useTempFiles: true
  }),
  authenticate('creator'),
  videoController.uploadVideo
)
router.get('/', videoController.getVideos)
router.get('/search', videoController.searchVideos)
router.post(
  '/like-dislike',
  authenticate('', true),
  videoController.likeOrDislikeVideo
)
router.post('/comment', authenticate('', true), videoController.addComment)

router.put('/:videoId', videoController.updateVideo)
router.get('/:videoId',  videoController.getVideoById)
router.get('/random',  videoController.getRandomVideo)
router.delete('/:videoId', videoController.deleteVideo)

module.exports = router
