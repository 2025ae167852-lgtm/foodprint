const nodemailer = require('nodemailer');
const env = process.env.NODE_ENV || 'development';
const CUSTOM_ENUMS = require('../../utils/enums');
const { v4: uuidv4 } = require('uuid');

var moment = require('moment'); //datetime

// Lazy-load database connection and models to avoid connection issues during module load
let models = null;
function getModels() {
  if (!models) {
    var initModels = require('../../models/init-models');
    var sequelise = require('../../config/db/db_sequelise');
    models = initModels(sequelise);
  }
  return models;
}

//emailer configuration
// Testing Emails Pattern
// when testing emails, in NODE_ENV=development, set EMAIL_OVERRIDE
// if EMAIL_OVERRIDE is set, send email to it's value, prepend subject line with [TEST EMAIL], include intended recipients in the body

// Only create email transport if ALL credentials are provided AND EMAIL_ENABLED is true
let emailTransport = null;

// Check if email is enabled and all required credentials exist and are not empty
const isEmailEnabled = process.env.EMAIL_ENABLED === 'true';
const hasCompleteCredentials = 
  process.env.EMAIL_HOST && 
  typeof process.env.EMAIL_HOST === 'string' &&
  process.env.EMAIL_HOST.trim() !== '' &&
  process.env.EMAIL_ADDRESS && 
  typeof process.env.EMAIL_ADDRESS === 'string' &&
  process.env.EMAIL_ADDRESS.trim() !== '' &&
  process.env.WEBAPP_PASSWORD && 
  typeof process.env.WEBAPP_PASSWORD === 'string' &&
  process.env.WEBAPP_PASSWORD.trim() !== '';

const shouldEnableEmail = isEmailEnabled && hasCompleteCredentials;

if (shouldEnableEmail) {
  try {
    emailTransport = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: process.env.EMAIL_SECURE === 'true' || process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_ADDRESS,
        pass: process.env.WEBAPP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    console.log('Email transport initialized');
  } catch (err) {
    console.error('Failed to create email transport:', err.message);
    emailTransport = null;
  }
} else {
  if (!isEmailEnabled) {
    console.log('Email disabled (EMAIL_ENABLED not set to true)');
  } else {
    console.warn('Email configuration incomplete. EMAIL_HOST, EMAIL_ADDRESS, and WEBAPP_PASSWORD required.');
  }
}

const customSendEmail = function (recipient, subject, body) {
  // If email transport is not configured, log and exit
  if (!emailTransport) {
    console.warn('Email not configured - skipping email send to', recipient);
    return;
  }

  //check var
  const toCheck = () => {
    return process.env.NODE_ENV !== CUSTOM_ENUMS.PRODUCTION
      ? '' + process.env.EMAIL_OVERRIDE
      : recipient;
  };
  const subjectCheck = () => {
    return process.env.NODE_ENV !== CUSTOM_ENUMS.PRODUCTION
      ? '[FoodPrint ' + process.env.NODE_ENV + '] -' + subject
      : '[FoodPrint] -' + subject;
  };
  //Details for email sent to customSendEmail
  let mailOptions = {
    from: process.env.EMAIL_ADDRESS,
    to: toCheck(),
    subject: subjectCheck(),
    html: body,
  };
  let email_logid = uuidv4();
  let logdatetime = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');

  emailTransport.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log('Error sending email - ', error);
      //res.status.json({ err: error });
      //log to emailModel here
      let data = {
        email_logid: email_logid,
        email_recipient: recipient,
        email_subject: subject,
        email_timestamp: logdatetime,
        email_content: mailOptions.html,
        email_status: 'FAILED',
      };
      getModels().FoodprintEmail.create(data)
        .then(_ => {
          console.log('Error - Email not sent ' + email_logid);
        })
        .catch(err => {
          //throw err;
          console.log('Error - Failed email not saved ' + email_logid);
          console.log(err.message);
        });
    } else {
      console.log(
        'Success - Email successfully sent. Response - %s, Message ID - %s, email record ID - %s',
        info.response,
        info.messageId,
        email_logid
      );

      //log to emailModel here
      let data = {
        email_logid: email_logid,
        email_recipient: recipient,
        email_subject: subject,
        email_timestamp: logdatetime,
        email_content: mailOptions.html,
        email_status: 'SENT',
      };
      getModels().FoodprintEmail.create(data)
        .then(_ => {
          console.log('Success - Email saved to DB ' + email_logid);
        })
        .catch(err => {
          //throw err;
          console.log('Error - Email not sent ' + email_logid);
          console.log(err.message);
          //Update previous saved email in db
          let data_update = { email_status: 'FAILED' };
          getModels().FoodprintEmail.update(data_update, {
            where: {
              email_logid: email_logid,
            },
          })
            .then(_ => {
              console.log('Success - Updated email to FAILED status ' + email_logid);
            })
            .catch(err => {
              //throw err;
              console.log('Error - Email record not updated to FAILED status ' + email_logid);
              console.log(err.message);
            });
        });
    }
  });
};

module.exports = customSendEmail;
