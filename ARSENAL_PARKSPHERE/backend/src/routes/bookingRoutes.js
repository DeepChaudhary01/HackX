const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// POST /api/booking — Create a new booking
router.post('/', bookingController.create);

// GET /api/booking/detail/:bookingId — Get single booking
router.get('/detail/:bookingId', bookingController.getById);

// PATCH /api/booking/:bookingId/cancel — Cancel a booking
router.patch('/:bookingId/cancel', bookingController.cancel);

// GET /api/booking/:userId — Get all user bookings
router.get('/:userId', bookingController.getUserBookings);

module.exports = router;
