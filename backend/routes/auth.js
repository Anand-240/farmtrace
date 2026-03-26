const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const FARMER_ROLE = 'FARMER';

const buildAuthResponse = (user) => {
  const token = jwt.sign(
    { id: user._id, phone: user.phone, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      village: user.village,
      city: user.city || user.district,
      state: user.state,
      avatar: user.avatar
    }
  };
};

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
      state: state?.trim(),
      authProvider: 'local'
    });

    await user.save();

    res.json(buildAuthResponse(user));
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

    if (!user.password) {
      return res.status(400).json({ message: 'Is account ke liye Google se login karo' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Password galat hai' });
    }

    res.json(buildAuthResponse(user));
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/google', async (req, res) => {
  try {
    const {
      idToken,
      mode = 'login',
      role,
      phone,
      village,
      city,
      district,
      state
    } = req.body;

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: 'GOOGLE_CLIENT_ID configure nahi hai' });
    }

    if (!idToken) {
      return res.status(400).json({ message: 'Google ID token required hai' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload?.email) {
      return res.status(400).json({ message: 'Google profile verify nahi ho paya' });
    }

    const normalizedEmail = payload.email.trim().toLowerCase();
    const normalizedPhone = phone?.trim() || undefined;
    const resolvedCity = city?.trim() || district?.trim();
    const resolvedRole = role || FARMER_ROLE;

    let user = await User.findOne({
      $or: [
        { googleId: payload.sub },
        { email: normalizedEmail }
      ]
    });

    if (!user && mode !== 'register') {
      return res.status(404).json({ message: 'Pehle register karo, phir Google se login hoga' });
    }

    if (!user) {
      user = new User({
        name: payload.name?.trim() || 'Google User',
        email: normalizedEmail,
        phone: normalizedPhone,
        role: resolvedRole,
        village: village?.trim(),
        city: resolvedCity,
        district: resolvedCity,
        state: state?.trim(),
        authProvider: 'google',
        googleId: payload.sub,
        avatar: payload.picture
      });
    } else {
      user.name = user.name || payload.name?.trim() || 'Google User';
      user.googleId = user.googleId || payload.sub;
      user.avatar = payload.picture || user.avatar;
      user.authProvider = user.authProvider || 'google';
      user.phone = user.phone || normalizedPhone;
      user.village = user.village || village?.trim();
      user.city = user.city || resolvedCity;
      user.district = user.district || resolvedCity;
      user.state = user.state || state?.trim();
      user.role = user.role || resolvedRole;
    }

    await user.save();

    res.json(buildAuthResponse(user));
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
