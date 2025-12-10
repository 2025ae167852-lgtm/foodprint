// server.js
const express = require('express');
const path = require('path');

const app = express();

// ✅ Root route for Railway healthcheck
app.get('/', (req, res) => {
  res.send('🚀 FoodPrint server is live and healthy!');
});

// ✅ Serve static frontend build (React/Vue/Angular)
// Assumes your frontend build output is in a folder called "build"
app.use(express.static(path.join(__dirname, 'build')));

// ✅ Catch-all route for frontend deep links
// This ensures routes like /app/auth/login or /track don’t throw "Error Not Found"
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// ✅ Start server on Railway’s assigned port
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 FoodPrint server running on port ${PORT}`);
});

