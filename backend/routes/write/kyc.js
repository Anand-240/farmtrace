const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const auth = require('../../middleware/authMiddleware');
const User = require('../../models/User');
const KycVerification = require('../../models/KycVerification');
const { processKycDocument } = require('../../utils/kycService');
const { sendMail, emailTemplates } = require('../../utils/email');
const logger = require('../../utils/logger').child({ module: 'kyc' });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
      return cb(new Error('Sirf image ya PDF allowed hai'));
    }
    cb(null, true);
  }
});

async function uploadToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'farmtrace_kyc',
        public_id: filename,
        // private delivery — not publicly listed
        type: 'upload',
        access_mode: 'authenticated'
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// POST /api/v1/kyc/submit — User apna document submit kare
router.post('/submit', auth, upload.fields([
  { name: 'frontImage', maxCount: 1 },
  { name: 'backImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const { documentType, documentNumber, nameAsPerDoc, dob } = req.body;

    if (!documentType || !documentNumber) {
      return res.status(400).json({ message: 'Document type aur number required hai' });
    }

    const allowed = ['AADHAAR', 'PAN', 'ESHRAM'];
    if (!allowed.includes(documentType)) {
      return res.status(400).json({ message: 'Invalid document type' });
    }

    // Already submitted check
    const existing = await KycVerification.findOne({ userId: req.user.id });
    if (existing && existing.status === 'VERIFIED') {
      return res.status(400).json({ message: 'KYC already verified hai' });
    }

    // Format validation + optional auto-verify via Surepass
    const result = await processKycDocument({
      documentType,
      rawNumber: documentNumber,
      nameAsPerDoc: nameAsPerDoc?.trim()
    });

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    // Upload images to Cloudinary (if provided)
    let frontImageUrl = null;
    let backImageUrl = null;
    const userId = req.user.id;

    if (req.files?.frontImage?.[0]) {
      frontImageUrl = await uploadToCloudinary(
        req.files.frontImage[0].buffer,
        `kyc_${userId}_front_${Date.now()}`
      );
    }

    if (req.files?.backImage?.[0]) {
      backImageUrl = await uploadToCloudinary(
        req.files.backImage[0].buffer,
        `kyc_${userId}_back_${Date.now()}`
      );
    }

    // Upsert KYC record
    const kycData = {
      userId,
      documentType,
      documentNumberHash: result.hashed,
      documentNumberMasked: result.masked,
      nameAsPerDoc: nameAsPerDoc?.trim() || null,
      dobAsPerDoc: dob ? new Date(dob) : null,
      frontImageUrl,
      backImageUrl,
      status: result.kycStatus,
      autoVerified: result.autoVerified,
      verificationResponse: result.verificationResponse || null
    };

    let kyc;
    if (existing) {
      Object.assign(existing, kycData);
      kyc = await existing.save();
    } else {
      kyc = await KycVerification.create(kycData);
    }

    // Update user's kycStatus
    await User.findByIdAndUpdate(userId, { kycStatus: result.kycStatus });

    logger.info({ userId, documentType, status: result.kycStatus, autoVerified: result.autoVerified }, 'KYC submitted');

    // Send acknowledgment email to user + alert to admin (fire-and-forget)
    const submittingUser = await User.findById(userId).select('name email');
    if (submittingUser) {
      const ackTpl = emailTemplates.kycSubmitted({
        userName: submittingUser.name,
        documentType,
        masked: result.masked
      });
      sendMail({ to: submittingUser.email, ...ackTpl }).catch(() => {});

      if (!result.autoVerified) {
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail) {
          const alertTpl = emailTemplates.kycAdminAlert({
            userName: submittingUser.name,
            userEmail: submittingUser.email,
            userId: String(userId),
            documentType,
            masked: result.masked,
            submittedAt: new Date()
          });
          sendMail({ to: adminEmail, ...alertTpl }).catch(() => {});
        }
      }
    }

    return res.json({
      success: true,
      status: kyc.status,
      masked: result.masked,
      autoVerified: result.autoVerified,
      message: result.autoVerified
        ? 'KYC verify ho gaya! Ab aap sare features use kar sakte hain.'
        : 'KYC submit ho gaya. Hamare team 24 ghante mein review karegi.'
    });
  } catch (err) {
    logger.error({ err }, 'KYC submit error');
    res.status(500).json({ message: 'KYC submit nahi ho paya' });
  }
});

// GET /api/v1/kyc/status — Apna KYC status dekho
router.get('/status', auth, async (req, res) => {
  try {
    const kyc = await KycVerification.findOne({ userId: req.user.id }).select(
      'documentType documentNumberMasked nameAsPerDoc status rejectionReason autoVerified createdAt reviewedAt'
    );

    const user = await User.findById(req.user.id).select('kycStatus');

    res.json({
      kycStatus: user?.kycStatus || 'PENDING',
      kyc: kyc || null
    });
  } catch (err) {
    logger.error({ err }, 'KYC status fetch error');
    res.status(500).json({ message: 'KYC status nahi mila' });
  }
});

// POST /api/v1/kyc/admin/verify/:userId — Admin manually approve/reject
// Protected by ADMIN_SECRET_KEY header
router.post('/admin/verify/:userId', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (!process.env.ADMIN_SECRET_KEY || adminKey !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { action, rejectionReason } = req.body;
    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ message: 'Action APPROVE ya REJECT hona chahiye' });
    }

    const kyc = await KycVerification.findOne({ userId: req.params.userId });
    if (!kyc) return res.status(404).json({ message: 'KYC record nahi mila' });

    const newStatus = action === 'APPROVE' ? 'VERIFIED' : 'REJECTED';
    kyc.status = newStatus;
    kyc.reviewedAt = new Date();
    kyc.reviewedBy = 'admin';
    if (action === 'REJECT') kyc.rejectionReason = rejectionReason || 'Document valid nahi hai';
    await kyc.save();

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { kycStatus: newStatus },
      { new: true }
    ).select('name email');

    // Notify user by email (fire-and-forget)
    if (updatedUser) {
      let tpl;
      if (action === 'APPROVE') {
        tpl = emailTemplates.kycApproved({ userName: updatedUser.name });
      } else {
        tpl = emailTemplates.kycRejected({
          userName: updatedUser.name,
          rejectionReason: rejectionReason || 'Document clearly visible nahi tha'
        });
      }
      sendMail({ to: updatedUser.email, ...tpl }).catch(() => {});
    }

    logger.info({ userId: req.params.userId, action, newStatus }, 'KYC admin review');
    res.json({ success: true, status: newStatus, userName: updatedUser?.name });
  } catch (err) {
    logger.error({ err }, 'KYC admin verify error');
    res.status(500).json({ message: 'Admin verify fail ho gaya' });
  }
});

// GET /api/v1/kyc/admin/signed-image/:kycId/:side — generate signed Cloudinary URL for document image
router.get('/admin/signed-image/:kycId/:side', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (!process.env.ADMIN_SECRET_KEY || adminKey !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { kycId, side } = req.params;
    if (!['front', 'back'].includes(side)) {
      return res.status(400).json({ message: 'Side front ya back hona chahiye' });
    }

    const kyc = await KycVerification.findById(kycId);
    if (!kyc) return res.status(404).json({ message: 'KYC record nahi mila' });

    const imageUrl = side === 'front' ? kyc.frontImageUrl : kyc.backImageUrl;
    if (!imageUrl) return res.status(404).json({ message: 'Image upload nahi hua' });

    // Extract public_id from Cloudinary URL (strips version and extension)
    const match = imageUrl.match(/\/(?:authenticated|upload)\/(?:v\d+\/)?(.+?)(?:\.[^./]+)?$/);
    const publicId = match ? match[1] : null;
    if (!publicId) return res.status(500).json({ message: 'Image URL parse fail' });

    const signedUrl = cloudinary.url(publicId, {
      sign_url: true,
      type: 'authenticated',
      resource_type: 'image',
      expires_at: Math.floor(Date.now() / 1000) + 900 // 15 minutes
    });

    res.json({ url: signedUrl, expiresIn: 900 });
  } catch (err) {
    logger.error({ err }, 'KYC signed image error');
    res.status(500).json({ message: 'Image URL generate nahi hua' });
  }
});

// GET /api/v1/kyc/admin/list?status=SUBMITTED — list KYC submissions for admin review
router.get('/admin/list', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (!process.env.ADMIN_SECRET_KEY || adminKey !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { status = 'SUBMITTED', page = 1, limit = 20 } = req.query;
    const filter = status === 'ALL' ? {} : { status };

    const [submissions, total] = await Promise.all([
      KycVerification.find(filter)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate('userId', 'name email phone role city state')
        .lean(),
      KycVerification.countDocuments(filter)
    ]);

    const result = submissions.map(kyc => ({
      kycId: kyc._id,
      userId: kyc.userId?._id,
      userName: kyc.userId?.name,
      userEmail: kyc.userId?.email,
      userPhone: kyc.userId?.phone,
      userRole: kyc.userId?.role,
      location: [kyc.userId?.city, kyc.userId?.state].filter(Boolean).join(', '),
      documentType: kyc.documentType,
      documentNumberMasked: kyc.documentNumberMasked,
      nameAsPerDoc: kyc.nameAsPerDoc,
      status: kyc.status,
      frontImageUrl: kyc.frontImageUrl,
      backImageUrl: kyc.backImageUrl,
      submittedAt: kyc.createdAt,
      reviewedAt: kyc.reviewedAt,
      rejectionReason: kyc.rejectionReason,
      autoVerified: kyc.autoVerified
    }));

    res.json({ total, page: Number(page), limit: Number(limit), submissions: result });
  } catch (err) {
    logger.error({ err }, 'KYC admin list error');
    res.status(500).json({ message: 'List fetch fail ho gaya' });
  }
});

module.exports = router;
