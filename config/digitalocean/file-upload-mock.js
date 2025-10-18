// config/digitalocean/file-upload-mock.js
module.exports = {
  upload: {
    single: () => (req, res, next) => {
      // Mock upload middleware (does nothing)
      next();
    },
  },
  uploadDir: '/tmp', // mock directory, not actually used
};
