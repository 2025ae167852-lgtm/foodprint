// webpack.config.js
const path = require('path');

module.exports = {
  entry: './src/index.js', // Update with your actual entry file
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  // Add other necessary configurations
};
