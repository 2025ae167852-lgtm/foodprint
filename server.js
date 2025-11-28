// server.js
const express = require('express');
const app = express();

// Root route for Railway healthcheck
app.get('/', (req, res) => {
  res.send('🚀 FoodPrint minimal server is live!');
});

// Start server on Railway's port
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Minimal server running on port ${PORT}`);
});
