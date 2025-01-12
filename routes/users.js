var express = require('express')
var router = express.Router()
var userController = require('../controllers/userController')
var authenticate = require('../middlewares/authenticate')

router.get('/me', userController.getCurrentUser)
router.post(
  '/admin/register-creator',
  authenticate('admin'),
  userController.registerCreatorByAdmin
)
router.post(
  '/admin/refresh-token',
  authenticate('admin'),
  userController.resendEmailWithToken
)
router.get('/admin/creators/all', userController.getAllCreators)
router.post('/admin/login', userController.adminLogin)
router.get('/admin/dashboard', userController.getTotalCreators)
router.get('/search', userController.searchUser)
router.post('/creator/login', userController.creatorLoginWithToken)
router.post('/consumer/register', userController.register)
router.post('/consumer/login', userController.login)
router.get('/:userId', userController.getUser)
router.get('/:id/details', userController.getUserDetails)
router.delete('/:userId', authenticate('admin'), userController.deleteUser)

module.exports = router
