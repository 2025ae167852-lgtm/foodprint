const nodemailer = require('nodemailer');
const env = process.env.NODE_ENV || 'development';
const CUSTOM_ENUMS = require('../../utils/enums');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const initModels = require('../../models/init-models');
const sequelise = require('../../config/db/db_sequelise');
const models = initModels(sequelise);

// Create nodemailer transporter
const emailTransport = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_ADDRESS,
    pass: process.env.WEBAPP_PASSWORD,
  },
});

// Verify email transport configuration
console.log('Checking email connection and authentication...');
emailTransport
  .verify()
  .then(() => {
    console.log('✅ Success - email connects and authenticates.');
  })
  .catch(err => {
    console.error('❌ Email transport verification failed:', err.message);
  });

// Core email send logic
const customSendEmail = function (recipient, subject, body) {
  const isProd = process.env.NODE_ENV === CUSTOM_ENUMS.PRODUCTION;
  const effectiveRecipient = isProd ? recipient : process.env.EMAIL_OVERRIDE;
  const emailSubject = isProd
    ? `[FoodPrint] - ${subject}`
    : `[FoodPrint ${process.env.NODE_ENV}] - ${subject}`;

  const mailOptions = {
    from: process.env.EMAIL_ADDRESS,
    to: effectiveRecipient,
    subject: emailSubject,
    html: body,
  };

  const email_logid = uuidv4();
  const logdatetime = moment().format('YYYY-MM-DD HH:mm:ss');

  emailTransport.sendMail(mailOptions, (error, info) => {
    const emailData = {
      email_logid,
      email_recipient: recipient,
      email_subject: subject,
      email_timestamp: logdatetime,
      email_content: mailOptions.html,
      email_status: error ? 'FAILED' : 'SENT',
    };

    if (error) {
      console.error('❌ Email send failed:', error.message);
      models.FoodprintEmail.create(emailData)
        .then(() => console.log('📌 Failed email logged:', email_logid))
        .catch(err => console.error('❌ Failed to log failed email:', err.message));
    } else {
      console.log(`✅ Email sent: ${info.messageId} (record ID: ${email_logid})`);
      models.FoodprintEmail.create(emailData)
        .then(() => console.log('📩 Email saved to DB:', email_logid))
        .catch(err => {
          console.error('⚠️ Email log save failed, attempting update...', err.message);
          models.FoodprintEmail.update({ email_status: 'FAILED' }, { where: { email_logid } })
            .then(() => console.log('✅ Email record updated to FAILED:', email_logid))
            .catch(err => console.error('❌ Could not update failed email record:', err.message));
        });
    }
  });
};

module.exports = customSendEmail;
