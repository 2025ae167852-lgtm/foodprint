// routes/qrcode.js
var express = require('express');
const { check, validationResult } = require('express-validator');
const { Op, Sequelize } = require('sequelize');
var router = express.Router();
var initModels = require('../models/init-models');
var sequelize;

// Try to load sequelize, but don't fail if it's not configured
try {
  if (process.env.DATABASE_URL) {
    sequelize = require('../config/db/db_sequelise');
  }
} catch (err) {
  console.warn('Warning: Could not load database config in qrcode routes:', err.message);
  sequelize = null;
}

const CUSTOM_ENUMS = require('../utils/enums');
// use modern uuid import
const { v4: uuidv4 } = require('uuid');
var ROLES = require('../utils/roles');
var QRCode = require('qrcode');
var moment = require('moment'); //datetime

var models = null;
if (sequelize) {
  try {
    models = initModels(sequelize);
  } catch (err) {
    console.warn('Warning: Could not initialize models in qrcode routes:', err.message);
  }
}
var crypto = require('crypto');
const env = process.env.NODE_ENV || 'development';
let fs = require('fs');

// Cloudinary setup (primary)
let cloudinary = null;
try {
  cloudinary = require('cloudinary').v2;
  // If CLOUDINARY_URL or individual vars are present, configure (cloudinary.v2 will parse CLOUDINARY_URL automatically)
  if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  } else {
    // if CLOUDINARY_URL not set but cloudinary package loaded, cloudinary.config will still work if CLOUDINARY_URL present in env
  }
} catch (e) {
  cloudinary = null;
  console.warn('cloudinary package not available or failed to load - Cloudinary uploads disabled.');
}

// DigitalOcean S3 fallback removed - using Cloudinary only

// multer for parsing incoming multipart/form-data
const multer = require('multer');

// For Cloudinary we use memory storage and upload buffer as base64 data URI
const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({ storage: memoryStorage });

// If DO fallback is used, configure multer-s3 style upload will be handled by legacy code — but
// for safety we'll still use memory storage and call the helper if present.
const upload = uploadMemory;

/*
  Helper: uploadBufferToCloudinary
  - file: multer file object (buffer, mimetype, originalname)
  - folder: optional folder name in Cloudinary
  - Returns: Promise resolving to { secure_url, public_id, raw_response }
*/
function uploadBufferToCloudinary(file, folder = 'foodprint') {
  return new Promise((resolve, reject) => {
    if (!cloudinary) return reject(new Error('Cloudinary not configured'));

    const extMime = file.mimetype || 'application/octet-stream';
    const dataUri = `data:${extMime};base64,${file.buffer.toString('base64')}`;

    const opts = {
      folder: folder,
      public_id: (file.originalname || `file-${Date.now()}`).replace(/\.[^/.]+$/, ''),
      overwrite: true,
      resource_type: 'image',
    };

    cloudinary.uploader
      .upload(dataUri, opts)
      .then(result => {
        resolve({ secure_url: result.secure_url, public_id: result.public_id, raw: result });
      })
      .catch(err => {
        reject(err);
      });
  });
}

/* Helper to upload buffer to Cloudinary */
async function uploadBufferToCloudinary(file, logoFilename, extension) {
  if (!cloudinary) {
    throw new Error('Cloudinary not configured');
  }

  const extMime = file.mimetype || 'application/octet-stream';
  const dataUri = `data:${extMime};base64,${file.buffer.toString('base64')}`;

  const opts = {
    folder: 'foodprint/qrcodes',
    public_id: logoFilename,
    overwrite: true,
    resource_type: 'image',
  };

  const result = await cloudinary.uploader.upload(dataUri, opts);
  return { fileUrl: result.secure_url, raw: result };
}

/* -------------------------
   ROUTES (only relevant qrcode routes shown)
   ------------------------- */

/* Example: market checkin (unchanged) */
router.post(
  '/marketcheckin',
  [check('checkin_email', 'Your email is not valid').not().isEmpty().isEmail().normalizeEmail()],
  function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.json({ errors: errors.array(), success: false });
      return;
    }
    var checkin_market_id = req.body.checkin_market_id;
    var checkin_email = req.body.checkin_email;
    var checkin_datetime = new Date();
    let data = {
      market_id: checkin_market_id,
      firstname: '',
      surname: '',
      email: checkin_email,
      logdatetime: checkin_datetime,
    };
    models.MarketSubscription.create(data)
      .then(_ => res.json({ success: true, email: checkin_email }))
      .catch(err => {
        console.error('error', err);
        res.status(500).json({ success: false, err: err.message || err });
      });
  }
);

/* Example: checkin form (unchanged) */
router.get('/checkin/:market_id', [check('market_id').trim().escape()], function (req, res) {
  var boolCheckinForm = process.env.SHOW_CHECKIN_FORM || false;
  var marketID = req.params.market_id;
  res.render('checkin.ejs', {
    data: marketID,
    showCheckinForm: boolCheckinForm,
    user: req.user,
    page_name: 'checkin',
  });
});

/* Scan pages and API routes (unchanged) */
/* ... (your existing scan / api/v1/scan logic here) ... */
/* For brevity, I assume you will keep the rest of file content unchanged.
   The main change below is upload handling for /qrcode/save route. */

/* Render qrcode EJS (unchanged) */
router.get(
  '/qrcode',
  require('connect-ensure-login').ensureLoggedIn({ redirectTo: '/app/auth/login' }),
  function (req, res, next) {
    if (req.user.role === ROLES.Admin || req.user.role === ROLES.Superuser) {
      models.FoodprintQRCode.findAll({
        where: {
          user_email: req.user.email,
        },
        order: [['pk', 'DESC']],
      })
        .then(async rows => {
          const qrcodes = [];
          for (var i = 0; i < rows.length; i++) {
            var qrcode_image = await QRCode.toDataURL(rows[i].qrcode_url);
            qrcodes.push(qrcode_image);
          }
          res.render('dashboard_qrcode_static', {
            page_title: 'FoodPrint - QR Code Dashboard',
            data: rows,
            user: req.user,
            qrcodes: qrcodes,
            filter_data: '',
            page_name: 'dashboard_qrcode_static',
          });
        })
        .catch(err => {
          console.log('All dashboard_qrcode_static err:' + err);
          req.flash('error', err);
          res.render('dashboard_qrcode_static', {
            page_title: 'FoodPrint - QR Code Dashboard',
            data: '',
            filter_data: '',
            user: req.user,
            page_name: 'dashboard_qrcode_static',
          });
        });
    } else {
      res.render('error', {
        message: 'You are not authorised to view this resource.',
        title: 'Error',
        user: req.user,
        filter_data: '',
        page_name: 'error',
      });
    }
  }
);

/* ROUTE TO INSERT QRCODE DATA
   NOTE: upload middleware replaced with memory upload to support Cloudinary primary.
*/
router.post(
  '/qrcode/save',
  upload.single('qrcode_company_logo_uploaded_file'),
  [
    check('qrcode_company_name', 'Your company name is not valid').not().isEmpty().trim().escape(),
    check('qrcode_company_founded', 'Your your founded year is not valid')
      .not()
      .isEmpty()
      .trim()
      .escape(),
    check('qrcode_contact_email', 'Your contact email is not valid')
      .not()
      .isEmpty()
      .trim()
      .escape(),
    check('qrcode_website', 'Your website is not valid').not().isEmpty().trim().escape(),
    check('qrcode_description', 'Your QR Code description is not valid')
      .not()
      .isEmpty()
      .trim()
      .escape(),
    check('qrcode_product_name', 'Your Product Name is not valid').not().isEmpty().trim().escape(),
    check('qrcode_product_description', 'Your Product description is not valid')
      .not()
      .isEmpty()
      .trim()
      .escape(),
  ],
  async function (req, res) {
    console.log('Upload mode:', cloudinary ? 'Cloudinary' : 'DISABLED');
    const result = validationResult(req);
    if (!result.isEmpty()) {
      const errors = result.array();
      req.flash('error', errors);
      return res.render('dashboard_qrcode_static', {
        page_title: 'FoodPrint - QR Code Configuration Dashboard',
        data: '',
        user: req.user,
        page_name: 'dashboard_qrcode_static',
      });
    }

    try {
      // Build filenames and upload if file present
      let logoUrl = ''; // final URL to save in DB
      if (req.file && req.file.buffer) {
        // Use Cloudinary for uploads
        if (cloudinary && (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME)) {
          const extArray = req.file.mimetype.split('/');
          const extension = '.' + (extArray[extArray.length - 1] || 'png');
          const logoFilename =
            (req.body.qrcode_company_name || 'file').replace(/\s+/g, '_').toLowerCase() +
            '-' +
            moment().format('YYYYMMDDHHmmss');
          const uploadResult = await uploadBufferToCloudinary(req.file, logoFilename, extension);
          logoUrl = uploadResult.fileUrl;
        } else {
          // No Cloudinary configured - error
          throw new Error('Cloudinary not configured - file uploads disabled');
        }
      } else {
        // No file uploaded - set default placeholder or empty
        logoUrl = process.env.DEFAULT_QR_LOGO_URL || '';
      }

      // Build QR URL
      let host = req.get('host');
      let protocol = 'https';
      if (process.env.NODE_ENV === CUSTOM_ENUMS.DEVELOPMENT) {
        protocol = req.protocol;
      }
      let supplier_product = (
        req.body.qrcode_company_name +
        '-' +
        req.body.qrcode_product_name +
        '-' +
        req.body.qrcode_contact_email
      )
        .split(' ')
        .join('');
      let hashID = crypto.createHash('sha256').update(supplier_product).digest('hex');
      let qrURL = protocol + '://' + host + '/app/qrcode/static/' + hashID;

      let qrid = uuidv4();
      let data = {
        qrcode_logid: qrid,
        qrcode_company_name: req.body.qrcode_company_name,
        qrcode_company_founded: req.body.qrcode_company_founded,
        qrcode_contact_email: req.body.qrcode_contact_email,
        qrcode_website: req.body.qrcode_website,
        qrcode_facebook: req.body.qrcode_facebook,
        qrcode_twitter: req.body.qrcode_twitter,
        qrcode_instagram: req.body.qrcode_instagram,
        qrcode_url: qrURL,
        qrcode_image_url: qrURL,
        qrcode_description: req.body.qrcode_description,
        qrcode_company_logo_url: logoUrl,
        qrcode_product_name: req.body.qrcode_product_name,
        qrcode_product_description: req.body.qrcode_product_description,
        qrcode_hashid: hashID,
        qrcode_supplier_product: supplier_product,
        user_email: req.user ? req.user.email : 'system',
        qrcode_logdatetime: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
      };

      await models.FoodprintQRCode.create(data);
      req.flash(
        'success',
        'New QR Code Configuration added successfully! QR Code company name = ' +
          req.body.qrcode_company_name
      );
      res.redirect('/app/qrcode');
    } catch (err) {
      console.error('Error saving QR code:', err);
      req.flash('error', err.message || err);
      res.redirect('/app/qrcode');
    }
  }
);

module.exports = router;
