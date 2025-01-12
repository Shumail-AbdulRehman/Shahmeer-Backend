var { hash, compare } = require('bcrypt')
var jwt = require('jsonwebtoken')
var User = require('../models/User')
var nodemailer = require('nodemailer')
const Video = require('../models/Video')
const LikeDislike = require('../models/LikeDislike')
const { default: mongoose } = require('mongoose')

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'
const EMAIL_SECRET = process.env.EMAIL_SECRET || 'your_email_secret'

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

exports.getUserDetails = async (req, res) => {
  try {
    const  userId  = req.params.id;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const user = await User.findById(userId).select('username email');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const videos = await Video.aggregate([
      { $match: { creator: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: 'likedislikes',
          localField: '_id',
          foreignField: 'video',
          as: 'likesData',
        },
      },
      {
        $project: {
          title: 1,
          url: 1,
          description:1,
          public_id: 1,
          createdAt: 1,
          likeCount: {
            $size: {
              $filter: {
                input: '$likesData',
                as: 'like',
                cond: { $eq: ['$$like.type', 'like'] },
              },
            },
          },
        },
      },
    ]);

    res.status(200).json({ user, videos });
  } catch (err) {
    console.error('Error fetching user details:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
};

exports.register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    const hashedPassword = await hash(password, 10)

    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: role || 'consumer' 
    })

    await user.save()
    res.status(201).json({ message: 'User registered successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error })
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' })
    }

    const isMatch = await compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' })
    }
    if (user.role === 'creator') {
      return res.status(400).json({ message: 'Invalid email or password' })
    }

    const token = jwt.sign({ _id: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: '1d'
    })

    res.status(200).json({ message: 'Login successful', token })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error })
  }
}

exports.getUser = async (req, res) => {
  try {
    const { userId } = req.params
    const user = await User.findById(userId).select('-password') // Exclude password
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    res.status(200).json(user)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error })
  }
}

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params

    const user = await User.findByIdAndDelete(userId)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.status(200).json({ message: 'User deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error })
  }
}

exports.registerCreatorByAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Permission denied' })
    }

    const { username, email, password } = req.body
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    const hashedPassword = await hash(password, 10)

    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: 'creator'
    })

    await user.save()

    const token = jwt.sign({ _id: user._id, role: 'creator' }, EMAIL_SECRET, {
      expiresIn: '7d'
    })

    const loginUrl = `${process.env.CLIENT_URL}/creator/login?token=${token}`

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Creator Account Created - Login Information',
      html: `Your creator account has been created. Login with the following details:\n
               Email: ${email}\n
               Password: ${password}\n
               <a href="${loginUrl}" target="_blank">Click here to login</a>`
    })

    res
      .status(201)
      .json({ message: 'Creator user registered successfully, email sent' })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error })
  }
}

exports.getAllCreators = async (req, res) => {
  try {
    const creators = await User.find({ role: 'creator' }).select('-password')
    return res.status(200).json(creators)
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: 'Server error', error })
  }
}

exports.creatorLoginWithToken = async (req, res) => {
  try {
    const { email, password, token } = req.body

    if (!token) {
      return res.status(401).json({ err: 'Unauthorized access' })
    }

    const decoded = jwt.verify(token, EMAIL_SECRET)
    const creatorId = decoded._id

    const user = await User.findById(creatorId)
    
    if (!user || user.role != 'creator') {
      return res
        .status(403)
        .json({ err: 'Access denied. Creator account required.' })
    }

    if (user.email != email) {
      return res.status(401).json({ err: 'Invalid Account' })
    }

    const isMatch = await compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ err: 'Invalid Account' })
    }

    const sessionToken = jwt.sign(
      { _id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    )

    res.status(200).json({ message: 'Login successful', token: sessionToken })
  } catch (error) {
    console.log(error)
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ err: 'Login link expired' })
    }
    res.status(500).json({ err: 'Server error', error })
  }
}

exports.resendEmailWithToken = async (req, res) => {
  try {
    const { email } = req.body

    const user = await User.findOne({
      email: email
    })
    if (!user) {
      return res.status(404).json({ err: 'User not found' })
    }
    if (user.role !== 'creator') {
      return res
        .status(403)
        .json({ err: 'Access denied. Creator account required.' })
    }
    const token = jwt.sign({ userId: user._id }, EMAIL_SECRET, {
      expiresIn: '7d'
    })
    const loginUrl = `${process.env.CLIENT_URL}/creator/login?token=${token}`
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Creator Account Refresh - Login Information',
      html: `Your creator account has been refreshed. Login with the following details:\n
                        Email: ${email}\n
                        <a href="${loginUrl}" target="_blank">Click here to login</a>`
    })
    res.status(200).json({ message: 'Refresh Token Email Sent' })
  } catch (error) {
    console.log(error)
    res.status(500).json({ err: 'Server error', error })
  }
}

exports.getTotalCreators = async (req, res) => {
  try {
    const creators = await User.find({ role: 'creator' })
    const users = await User.find({ role: 'consumer' })
    res.status(200).json({ creators: creators.length, users: users.length })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error })
  }
}

exports.getCurrentUser = async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1]

    if (token == 'null') {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    const decoded = jwt.verify(token, JWT_SECRET)
    const userId = decoded._id
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    if (userId === process.env.ADMIN_ID) {
      return res.status(200).json({
        _id: process.env.ADMIN_ID,
        email: process.env.ADMIN_EMAIL,
        username: 'Admin',
        role: 'admin'
      })
    }
    const user = await User.findById(userId).select('-password')
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    return res.status(200).json(user)
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Server error', error })
  }
}

exports.searchUser = async (req, res) => {
  try {
    const search = req.query.search;

    if (!search) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const users = await User.find({
      username: { $regex: search, $options: 'i' } 
    }).select('username email'); 

    res.status(200).json(users);
  } catch (err) {
    console.error('Error searching users:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
};




exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body

    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign(
        {
          _id: process.env.ADMIN_ID,
          role: 'admin'
        },
        JWT_SECRET,
        { expiresIn: '1d' }
      )
      res.status(200).json({ message: 'Login successful', token })
    } else {
      res.status(401).json({ err: 'Invalid email or password' })
    }
  } catch (error) {
    res.status(500).json({ err: 'Server error', error })
  }
}