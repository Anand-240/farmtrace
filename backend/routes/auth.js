const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');
const { z } = require('zod');

// Schema Validation
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['FARMER', 'DISTRIBUTOR', 'RETAILER', 'CONSUMER']),
  village: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional()
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Identifier (Email or Phone) is required'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const FARMER_ROLE = 'FARMER';
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const requestBuckets = {
  forgotPassword: new Map(),
  resetPassword: new Map(),
  changePassword: new Map()
};

const isRateLimited = ({ bucket, key, limit, windowMs = RATE_LIMIT_WINDOW_MS }) => {
  const now = Date.now();
  const entry = bucket.get(key);

  if (!entry || now > entry.resetAt) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (entry.count >= limit) {
    return true;
  }

  entry.count += 1;
  return false;
};

const getRequestKey = (req, identifier = '') => `${req.ip || 'unknown'}:${identifier || 'none'}`;

const isPlaceholderValue = (value = '') => {
  const normalized = String(value).trim().toLowerCase();
  return !normalized || normalized.includes('your-email@gmail.com') || normalized.includes('xxxx');
};

const hasSmtpConfig = () =>
  Boolean(
    process.env.SMTP_HOST
    && process.env.SMTP_USER
    && process.env.SMTP_PASS
    && !isPlaceholderValue(process.env.SMTP_USER)
    && !isPlaceholderValue(process.env.SMTP_PASS)
  );

const resolveMailFrom = () => {
  const configuredFrom = process.env.MAIL_FROM;
  if (!configuredFrom || isPlaceholderValue(configuredFrom)) {
    return process.env.SMTP_USER;
  }
  return configuredFrom;
};

const createMailTransport = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const sendResetMail = async ({ to, name, resetUrl }) => {
  if (!hasSmtpConfig()) {
    console.log('SMTP configure nahi hai. Reset link:', resetUrl);
    return;
  }

  const transporter = createMailTransport();
  const from = resolveMailFrom();

  await transporter.sendMail({
    from,
    to,
    subject: 'FarmTrace Password Reset',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2f26;">
        <h2 style="margin-bottom: 8px;">Namaste ${name || 'User'},</h2>
        <p>Aapke account ke password reset ke liye request aayi hai.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:10px 14px;background:#27500A;color:#fff;border-radius:8px;text-decoration:none;">
            Password Reset Karo
          </a>
        </p>
        <p>Yeh link 15 minute tak valid hai.</p>
        <p>Agar aapne request nahi ki, to is email ko ignore karo.</p>
      </div>
    `
  });
};

const buildAuthResponse = (user) => {
  const token = jwt.sign(
    { id: user._id, phone: user.phone, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user._id,
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
    const parsedSchema = registerSchema.safeParse(req.body);
    if (!parsedSchema.success) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: parsedSchema.error.errors.map(e => e.message) 
      });
    }

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
    const parsedSchema = loginSchema.safeParse(req.body);
    if (!parsedSchema.success) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: parsedSchema.error.errors.map(e => e.message) 
      });
    }

    const { identifier: email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: 'Email aur password required hai' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ message: 'password or email dono galat hai' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'Is account ke liye Google se login karo' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'password or email dono galat hai' });
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

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -resetPasswordToken -resetPasswordExpires');
    if (!user) {
      return res.status(404).json({ message: 'User nahi mila' });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        village: user.village,
        city: user.city || user.district,
        state: user.state,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error('Profile fetch error:', err.message);
    res.status(500).json({ message: 'Profile load nahi hua' });
  }
});

router.put('/me', auth, async (req, res) => {
  try {
    const { name, phone, village, city, district, state, avatar } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User nahi mila' });
    }

    if (phone?.trim()) {
      const normalizedPhone = phone.trim();
      const phoneExists = await User.findOne({ phone: normalizedPhone, _id: { $ne: user._id } });
      if (phoneExists) {
        return res.status(400).json({ message: 'Yeh phone number pehle se use ho raha hai' });
      }
      user.phone = normalizedPhone;
    }

    if (name?.trim()) user.name = name.trim();
    if (typeof avatar === 'string') user.avatar = avatar.trim();
    if (typeof village === 'string') user.village = village.trim();

    const resolvedCity = (city || district || '').trim();
    if (resolvedCity) {
      user.city = resolvedCity;
      user.district = resolvedCity;
    }

    if (typeof state === 'string') user.state = state.trim();

    await user.save();

    res.json({
      message: 'Profile update ho gaya',
      ...buildAuthResponse(user)
    });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ message: 'Profile update nahi hua' });
  }
});

router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const rateLimitKey = getRequestKey(req, req.user?.id);
    if (isRateLimited({ bucket: requestBuckets.changePassword, key: rateLimitKey, limit: 8 })) {
      return res.status(429).json({ message: 'Bahut zyada attempts ho gaye, 15 minute baad try karo' });
    }

    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ message: 'Naya password kam se kam 6 characters ka hona chahiye' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User nahi mila' });
    }

    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password required hai' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password galat hai' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.authProvider = user.authProvider || 'local';
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password change ho gaya' });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ message: 'Password change nahi hua' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const normalizedEmail = req.body.email?.trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email required hai' });
    }

    const rateLimitKey = getRequestKey(req, normalizedEmail);
    if (isRateLimited({ bucket: requestBuckets.forgotPassword, key: rateLimitKey, limit: 5 })) {
      return res.status(429).json({ message: 'Bahut zyada forgot password requests aayi hain, thodi der baad try karo' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.json({
        success: true,
        message: 'Agar account exist karta hai to reset link bhej diya gaya hai'
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const envUrl = process.env.FRONTEND_URL || '';
    const frontendBase = (envUrl.split(',')[0] || 'http://localhost:3000').trim();
    const resetUrl = `${frontendBase}/reset-password/${rawToken}`;

    try {
      await sendResetMail({
        to: user.email,
        name: user.name,
        resetUrl
      });
    } catch (emailErr) {
      console.error('Reset mail error:', emailErr.message);
    }

    const response = {
      success: true,
      message: 'Agar account exist karta hai to reset link bhej diya gaya hai'
    };

    if (process.env.NODE_ENV !== 'production' && !hasSmtpConfig()) {
      response.devResetUrl = resetUrl;
      response.note = 'SMTP configure nahi hai, reset link response me diya gaya hai';
    }

    res.json(response);
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ message: 'Forgot password request fail ho gayi' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const rateLimitKey = getRequestKey(req, token ? 'with-token' : 'without-token');
    if (isRateLimited({ bucket: requestBuckets.resetPassword, key: rateLimitKey, limit: 10 })) {
      return res.status(429).json({ message: 'Bahut zyada reset attempts ho gaye, 15 minute baad try karo' });
    }

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token aur new password required hai' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'Naya password kam se kam 6 characters ka hona chahiye' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Reset token invalid ya expire ho chuka hai' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    if (!user.authProvider) user.authProvider = 'local';
    await user.save();

    res.json({ success: true, message: 'Password reset ho gaya. Ab login karo.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ message: 'Password reset nahi hua' });
  }
});

module.exports = router;
