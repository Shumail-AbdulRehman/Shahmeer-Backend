
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'

const authenticate = (requiredRole, pass) => async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ message: 'Authentication token required' })
    }

    const decoded = jwt.verify(token, JWT_SECRET)

    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' })
    }
    req.user = decoded 

    if (requiredRole == 'admin') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' })
      }
    } else {
      const user = await User.findById(req.user._id)
      if (!user) {
        return res.status(401).json({ message: 'User not found' })
      }

     
      
      if (!pass && requiredRole && user.role !== requiredRole) {
        return res.status(403).json({ message: 'Access denied' })
      }
    }

    next() 
  } catch (error) {
    console.log(error)
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' })
    }
    res.status(401).json({ message: 'Invalid token', error })
  }
}

module.exports = authenticate
