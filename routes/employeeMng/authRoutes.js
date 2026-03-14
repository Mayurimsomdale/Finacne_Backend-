// routes/authRoutes.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../../config/database.js';

const router = express.Router();

// JWT Secret (should be in .env file)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

/**
 * @route   POST /api/auth/register
 * @desc    Register new admin user
 * @access  Public
 */
router.post('/register', async (req, res) => {
  console.log('📝 Registration request received:', {
    fullName: req.body.fullName,
    username: req.body.username,
    email: req.body.email,
    role: req.body.role
  });

  const { fullName, username, email, password, role } = req.body;

  try {
    // Validation
    if (!fullName || !username || !email || !password) {
      console.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Validation failed: Invalid email format');
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Username validation
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username) || username.length < 4) {
      console.log('❌ Validation failed: Invalid username');
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 4 characters and contain only letters, numbers, and underscores'
      });
    }

    // Password validation
    if (password.length < 8) {
      console.log('❌ Validation failed: Password too short');
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    // Check if user already exists
    console.log('🔍 Checking if user already exists...');
    const userCheck = await pool.query(
      'SELECT * FROM admins WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (userCheck.rows.length > 0) {
      const existingUser = userCheck.rows[0];
      const field = existingUser.username === username ? 'Username' : 'Email';
      console.log(`❌ User already exists: ${field} already taken`);
      return res.status(400).json({
        success: false,
        message: `${field} already exists. Please use a different ${field.toLowerCase()}.`
      });
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new admin
    console.log('💾 Inserting new admin into database...');
    const result = await pool.query(
      `INSERT INTO admins (username, email, password, full_name, role, is_active) 
       VALUES ($1, $2, $3, $4, $5, true) 
       RETURNING id, username, email, full_name, role, created_at`,
      [username, email, hashedPassword, fullName, role || 'hr']
    );

    const newUser = result.rows[0];
    console.log('✅ User created successfully:', { id: newUser.id, username: newUser.username });

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: newUser.id, 
        username: newUser.username, 
        role: newUser.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token: token,
        user: {
          id: newUser.id,
          username: newUser.username,
          fullName: newUser.full_name,
          email: newUser.email,
          role: newUser.role,
          createdAt: newUser.created_at
        }
      }
    });

  } catch (error) {
    console.error('🔴 Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login admin user
 * @access  Public
 */
router.post('/login', async (req, res) => {
  console.log('🔑 Login request received:', {
    username: req.body.username
  });

  const { username, password } = req.body;

  try {
    // Validation
    if (!username || !password) {
      console.log('❌ Validation failed: Missing credentials');
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find user
    console.log('🔍 Looking up user...');
    const result = await pool.query(
      'SELECT * FROM admins WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      console.log('❌ User account is inactive');
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Verify password
    console.log('🔐 Verifying password...');
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      console.log('❌ Invalid password');
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful');

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token: token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('🔴 Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout admin user
 * @access  Private
 */
router.post('/logout', (req, res) => {
  console.log('👋 Logout request received');
  
  // In a JWT-based system, logout is handled client-side by removing the token
  // If you implement token blacklisting, you would add the token to a blacklist here
  
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user data
 * @access  Private
 */
router.get('/me', async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from database
    const result = await pool.query(
      'SELECT id, username, email, full_name, role, created_at FROM admins WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          role: user.role,
          createdAt: user.created_at
        }
      }
    });

  } catch (error) {
    console.error('🔴 Get user error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export default router;