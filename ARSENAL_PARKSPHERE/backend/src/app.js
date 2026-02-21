const express = require('express');
const cors = require('cors');
require('dotenv').config();

const parkingRoutes = require('./routes/parkingRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const errorHandler = require('./utils/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ParkSphere API', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/parking', parkingRoutes);
app.use('/api/booking', bookingRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚗 ParkSphere API running on http://localhost:${PORT}`);
});

module.exports = app;
