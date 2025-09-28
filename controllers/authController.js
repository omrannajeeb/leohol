import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

export const promoteToAdmin = async (req, res) => {
  try {
    const { email, secret } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Allow promotion if:
    // 1) No admin exists yet (bootstrap scenario), OR
    // 2) A valid secret token is provided matching ADMIN_SETUP_TOKEN
    const hasAdmin = await User.exists({ role: 'admin' });
    const configuredSecret = process.env.ADMIN_SETUP_TOKEN || '';
    const secretOk = configuredSecret && secret && String(secret) === String(configuredSecret);

    if (!secretOk && hasAdmin) {
      return res.status(403).json({ message: 'Admin already exists. Provide valid secret to promote.' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.role = 'admin';
    await user.save();
  return res.json({ ok: true, id: user._id, email: user.email, role: user.role, image: user.image || null });
  } catch (e) {
    console.error('promoteToAdmin error:', e);
    return res.status(500).json({ message: 'Failed to promote user' });
  }
};

export const register = async (req, res) => {
  try {
  const { name, email, password } = req.body;
  const normalizedEmail = String(email || '').toLowerCase();

    // Check if user already exists
  const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create new user
    const user = new User({
      name,
      email: normalizedEmail,
      password,
      role: 'user' // Default role
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Send response
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image || null
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

export const login = async (req, res) => {
  try {
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').toLowerCase();
    
    // Find user
  const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Optional auto-register-on-login feature (disabled by default)
      const autoRegister = String(process.env.AUTO_REGISTER_ON_LOGIN || '').toLowerCase();
      const enabled = ['1','true','yes','on'].includes(autoRegister);
      if (!enabled) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      // Basic minimum validation before implicit registration
      if (!password || String(password).length < 6) {
        return res.status(400).json({ message: 'Password too short for automatic registration' });
      }
      try {
        const newUser = new User({
          name: normalizedEmail.split('@')[0],
          email: normalizedEmail,
          password,
          role: 'user',
          provider: 'local'
        });
        await newUser.save();
        const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        return res.status(201).json({
          autoRegistered: true,
          token,
          user: {
            id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            image: newUser.image || null
          }
        });
      } catch (e) {
        console.error('Auto-register on login failed:', e);
        return res.status(500).json({ message: 'Failed to auto-register user' });
      }
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Send response
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image || null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      image: user.image || null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const isAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('email role');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({ isAdmin: user.role === 'admin', email: user.email, role: user.role });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to check admin status' });
  }
};
