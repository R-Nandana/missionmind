const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string'
      || !email.trim() || !password || !name.trim()) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });
    if (user) {
      return res.status(400).json({ error: 'User already exists' });
    }

    user = new User({ email: normalizedEmail, password, name: name.trim() });
    await user.save();

    const token = createToken({ id: user._id, email: user.email, role: 'user' });
    res.status(201).json({ token, user: { id: user._id, email: user.email, name: user.name, role: 'user' } });
  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createToken({ id: user._id, email: user.email, role: 'user' });
    res.status(200).json({ token, user: { id: user._id, email: user.email, name: user.name, role: 'user' } });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/admin-login', async (req, res) => {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    return res.status(503).json({ error: 'Admin login is not configured for this deployment' });
  }

  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  const emailMatches = safeEqual(email.trim().toLowerCase(), adminEmail);
  const passwordMatches = safeEqual(password, adminPassword);
  if (!emailMatches || !passwordMatches) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  const token = createToken({ id: 'admin', email: adminEmail, role: 'admin' });
  res.status(200).json({
    token,
    user: { id: 'admin', email: adminEmail, name: 'Administrator', role: 'admin' },
  });
});

module.exports = router;
