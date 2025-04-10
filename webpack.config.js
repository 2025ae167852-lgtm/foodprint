const path = require('path');

module.exports = {
  entry: path.resolve(__dirname, 'src', 'index.js'), // Absolute path
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
