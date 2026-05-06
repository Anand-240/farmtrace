const { PinataSDK } = require('pinata-web3');
const cloudinary = require('cloudinary').v2;

// Initialize Pinata
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

// Initialize Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads high-res image to IPFS via Pinata and thumbnail to Cloudinary.
 * @param {Buffer} buffer - The image buffer
 * @param {string} originalName - The original file name
 * @param {string} mimeType - The mime type of the file
 * @returns {Promise<{ ipfsCid: string, thumbnailUrl: string }>}
 */
async function uploadProduceImage(buffer, originalName, mimeType) {
  // 1. Upload high-res to IPFS (optional — skipped if PINATA_JWT not configured)
  let ipfsCid = null;
  if (process.env.PINATA_JWT) {
    const blob = new Blob([buffer], { type: mimeType });
    const file = new File([blob], originalName, { type: mimeType });
    const upload = await pinata.upload.file(file);
    ipfsCid = upload.IpfsHash;
  }

  // 2. Upload thumbnail to Cloudinary
  const thumbnailUrl = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { 
        folder: 'farmtrace_thumbnails', 
        transformation: [{ width: 300, height: 300, crop: 'thumb' }] 
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });

  return { ipfsCid, thumbnailUrl };
}

module.exports = {
  uploadProduceImage
};
