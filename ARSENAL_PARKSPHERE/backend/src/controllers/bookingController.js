const bookingService = require('../services/bookingService');

const bookingController = {
  /**
   * POST /api/booking
   * Body: { parkingId, userId, vehicleNumber?, date, startTime, endTime }
   */
  async create(req, res, next) {
    try {
      const booking = await bookingService.createBooking(req.body);
      res.status(201).json({
        success: true,
        data: booking,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/booking/:bookingId/cancel
   * Body: { userId? } (optional for ownership check)
   */
  async cancel(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { userId } = req.body || {};
      const result = await bookingService.cancelBooking(bookingId, userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/booking/detail/:bookingId
   */
  async getById(req, res, next) {
    try {
      const booking = await bookingService.getBookingById(req.params.bookingId);
      res.json({
        success: true,
        data: booking,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/booking/:userId
   */
  async getUserBookings(req, res, next) {
    try {
      const bookings = await bookingService.getUserBookings(req.params.userId);
      res.json({
        success: true,
        count: bookings.length,
        data: bookings,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = bookingController;
