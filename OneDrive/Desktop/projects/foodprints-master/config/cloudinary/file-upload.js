const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload buffer data to Cloudinary
 * @param {Buffer} buffer_data - The file buffer to upload
 * @param {string} contentType - MIME type of the file
 * @param {string} filename - Name for the file (without extension)
 * @param {string} folder - Cloudinary folder (default: 'foodprint')
 * @param {string} resourceType - Type of resource ('image', 'raw', 'video', 'auto')
 * @returns {Promise<Object>} - Returns { secure_url, public_id, raw_response }
 */
const uploadBuffer = function (
  buffer_data,
  contentType,
  filename,
  folder = 'foodprint',
  resourceType = 'auto'
) {
  return new Promise((resolve, reject) => {
    if (!cloudinary) {
      return reject(new Error('Cloudinary not configured'));
    }

    // Convert buffer to base64 data URI
    const dataUri = `data:${contentType};base64,${buffer_data.toString('base64')}`;

    const uploadOptions = {
      folder: folder,
      public_id: filename,
      overwrite: true,
      resource_type: resourceType,
    };

    cloudinary.uploader
      .upload(dataUri, uploadOptions)
      .then(result => {
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          raw_response: result,
        });
      })
      .catch(err => {
        reject(err);
      });
  });
};

/**
 * Upload file from multer file object
 * @param {Object} file - Multer file object with buffer, mimetype, originalname
 * @param {string} filename - Custom filename (optional)
 * @param {string} folder - Cloudinary folder (default: 'foodprint')
 * @param {string} resourceType - Type of resource ('image', 'raw', 'video', 'auto')
 * @returns {Promise<Object>} - Returns { secure_url, public_id, raw_response }
 */
const uploadFile = function (file, filename = null, folder = 'foodprint', resourceType = 'auto') {
  return new Promise((resolve, reject) => {
    if (!cloudinary) {
      return reject(new Error('Cloudinary not configured'));
    }

    if (!file || !file.buffer) {
      return reject(new Error('Invalid file object'));
    }

    const finalFilename =
      filename || (file.originalname || `file-${Date.now()}`).replace(/\.[^/.]+$/, '');
    const contentType = file.mimetype || 'application/octet-stream';

    uploadBuffer(file.buffer, contentType, finalFilename, folder, resourceType)
      .then(result => resolve(result))
      .catch(err => reject(err));
  });
};

/**
 * Resolve filename and URL (replaces the old resolveFilenames function)
 * @param {string} filename - Base filename
 * @param {string} extension - File extension
 * @returns {Object} - Returns { filename, fileUrl } (fileUrl will be set after upload)
 */
const resolveFilenames = function (filename, extension) {
  // Force filename to lowercase for consistency
  filename = filename.toLowerCase();
  const fullFilename = filename + extension;

  return {
    filename: fullFilename,
    fileUrl: null, // Will be set after successful upload
  };
};

/**
 * Upload PDF buffer to Cloudinary
 * @param {Buffer} pdfBuffer - PDF buffer
 * @param {string} filename - PDF filename
 * @param {string} folder - Cloudinary folder (default: 'foodprint/pdfs')
 * @returns {Promise<Object>} - Returns { secure_url, public_id, raw_response }
 */
const uploadPDF = function (pdfBuffer, filename, folder = 'foodprint/pdfs') {
  return uploadBuffer(pdfBuffer, 'application/pdf', filename, folder, 'raw');
};

/**
 * Upload image buffer to Cloudinary
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} filename - Image filename
 * @param {string} folder - Cloudinary folder (default: 'foodprint/images')
 * @returns {Promise<Object>} - Returns { secure_url, public_id, raw_response }
 */
const uploadImage = function (imageBuffer, filename, folder = 'foodprint/images') {
  return uploadBuffer(imageBuffer, 'image/jpeg', filename, folder, 'image');
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Type of resource ('image', 'raw', 'video')
 * @returns {Promise<Object>} - Deletion result
 */
const deleteFile = function (publicId, resourceType = 'raw') {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .destroy(publicId, { resource_type: resourceType })
      .then(result => resolve(result))
      .catch(err => reject(err));
  });
};

module.exports = {
  uploadBuffer,
  uploadFile,
  uploadPDF,
  uploadImage,
  resolveFilenames,
  deleteFile,
  cloudinary,
};


