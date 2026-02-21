const parkingModel = require('../models/parkingModel');

const parkingService = {
  /**
   * Get nearby parking lots sorted by distance
   */
  async getNearbyParking(lat, lng, radiusKm) {
    if (!lat || !lng) {
      throw { status: 400, message: 'Latitude and longitude are required' };
    }

    const radius = radiusKm || 5;
    const parkingLots = await parkingModel.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(radius)
    );

    return parkingLots.map((lot) => ({
      id: lot.id,
      name: lot.name,
      address: lot.address,
      latitude: lot.latitude,
      longitude: lot.longitude,
      totalSlots: lot.total_slots,
      availableSlots: lot.available_slots,
      pricePerHour: parseFloat(lot.price_per_hour) || 20,
      distanceKm: parseFloat(lot.distance_km).toFixed(2),
    }));
  },

  /**
   * Get a single parking lot by ID
   */
  async getParkingById(id) {
    if (!id) {
      throw { status: 400, message: 'Parking ID is required' };
    }

    const lot = await parkingModel.findById(id);
    if (!lot) {
      throw { status: 404, message: 'Parking lot not found' };
    }

    return {
      id: lot.id,
      name: lot.name,
      address: lot.address,
      latitude: lot.latitude,
      longitude: lot.longitude,
      totalSlots: lot.total_slots,
      availableSlots: lot.available_slots,
      pricePerHour: parseFloat(lot.price_per_hour) || 20,
      createdAt: lot.created_at,
    };
  },
};

module.exports = parkingService;
