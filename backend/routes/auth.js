const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role, village, city, district, state } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedPhone = phone?.trim();
    const resolvedCity = city?.trim() || district?.trim();

    if (!name || !normalizedEmail || !normalizedPhone || !password || !role) {
      return res.status(400).json({ message: 'Name, email, phone, password, role required hai' });
    }

    const exists = await User.findOne({
      $or: [
        { phone: normalizedPhone },
        { email: normalizedEmail }
      ]
    });
    if (exists) {
      return res.status(400).json({ message: 'Email ya phone already registered hai' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashedPassword,
      role,
      village: village?.trim(),
      city: resolvedCity,
      district: resolvedCity,
      state: state?.trim()
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, phone: user.phone, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        village: user.village,
        city: user.city,
        state: user.state
      }
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: 'Email aur password required hai' });
    }

    const user = await User.findOne({ email: normalizedEmail });
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
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        village: user.village,
        city: user.city || user.district,
        state: user.state
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
