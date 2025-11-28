// server.js (minimal healthcheck-safe version)
const express = require('express');
const app = express();

// Root route for Railway healthcheck
app.get('/', (req, res) => {
  res.send('🚀 FoodPrint API is live!');
});

// Start server on Railway's port
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 FoodPrint Server running on port ${PORT}`);
});
