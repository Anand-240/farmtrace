const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

router.post('/register', async (req, res) => {
  try {
    const { name, phone, password, role, village, district, state } = req.body;

    if (!name || !phone || !password || !role) {
      return res.status(400).json({ message: 'Name, phone, password, role required hai' });
    }

    const exists = await User.findOne({ phone });
    if (exists) {
      return res.status(400).json({ message: 'Phone already registered hai' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name, phone,
      password: hashedPassword,
      role, village, district, state
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, phone: user.phone, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { name: user.name, phone: user.phone, role: user.role }
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone aur password required hai' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ message: 'User nahi mila' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Password galat hai' });
    }

    const token = jwt.sign(
      { id: user._id, phone: user.phone, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { name: user.name, phone: user.phone, role: user.role }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
