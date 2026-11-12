const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Organizer = require('../models/Organizer');
const { createNotification } = require('../utils/notificationHelper');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'eventify_default_secret', {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @desc    Register a new user or organizer
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      role,
      city,
      interests,
      organizationName,
      organizationDescription,
      website
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists'
      });
    }

    // Prevent arbitrary admin registration via public endpoint
    const assignedRole = role === 'organizer' ? 'organizer' : 'customer';

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone || '',
      role: assignedRole,
      city: city || 'Mumbai',
      interests: Array.isArray(interests) ? interests : []
    });

    if (assignedRole === 'organizer') {
      await Organizer.create({
        user: user._id,
        organizationName: organizationName ? organizationName.trim() : `${user.name} Events`,
        description: organizationDescription || 'Professional Event Management Organization on EVENTIFY',
        website: website || '',
        contactEmail: user.email,
        contactPhone: user.phone || '',
        verificationStatus: 'verified'
      });
    }

    await createNotification({
      user: user._id,
      title: 'Welcome to EVENTIFY!',
      message: `Hello ${user.name}, your ${assignedRole} account is ready. Discover and book smart events!`,
      type: 'system',
      link: assignedRole === 'organizer' ? '/organizer/dashboard.html' : '/events.html'
    });

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'Registration completed successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        city: user.city,
        interests: user.interests,
        avatar: user.avatar
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user / organizer / admin
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password, portalRole } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Enforce backend portal-role authorization if logging in via dedicated Organizer or Admin portal
    if (portalRole === 'admin' && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Administrator privileges are required to sign in to the Admin Portal.'
      });
    }

    if (portalRole === 'organizer' && user.role !== 'organizer' && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: An Event Organizer account is required to sign in to the Organizer Studio.'
      });
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        city: user.city,
        interests: user.interests,
        avatar: user.avatar,
        bio: user.bio
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged-in user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    let organizerProfile = null;
    if (user.role === 'organizer') {
      organizerProfile = await Organizer.findOne({ user: user._id });
    }

    res.status(200).json({
      success: true,
      user,
      organizerProfile
    });
  } catch (error) {
    next(error);
  }
};

