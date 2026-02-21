const parkingService = require('../services/parkingService');

const parkingController = {
  /**
   * GET /api/parking/nearby?lat=&lng=&radius=
   */
  async getNearby(req, res, next) {
    try {
      const { lat, lng, radius } = req.query;
      const parkingLots = await parkingService.getNearbyParking(lat, lng, radius);
      res.json({
        success: true,
        count: parkingLots.length,
        data: parkingLots,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/parking/:id
   */
  async getById(req, res, next) {
    try {
      const lot = await parkingService.getParkingById(req.params.id);
      res.json({
        success: true,
        data: lot,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = parkingController;
