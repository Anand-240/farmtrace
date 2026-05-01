const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadProduceImage } = require('../../utils/storage');
const auth = require('../../middleware/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Koi image upload nahi hui.' });
    }

    const { ipfsCid, thumbnailUrl } = await uploadProduceImage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.json({
      success: true,
      ipfsCid,
      thumbnailUrl,
      message: 'Image uploaded successfully!',
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Image upload failed', error: err.message });
  }
});

module.exports = router;
