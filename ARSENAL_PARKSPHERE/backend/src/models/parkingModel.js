const pool = require('../config/db');

const parkingModel = {
  /**
   * Find parking lots near a given lat/lng within radius (km).
   * Includes price_per_hour. Uses Haversine formula.
   */
  async findNearby(lat, lng, radiusKm = 5) {
    const query = `
      SELECT * FROM (
        SELECT *,
          (6371 * acos(
            LEAST(1.0, cos(radians($1)) * cos(radians(latitude)) *
            cos(radians(longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(latitude)))
          )) AS distance_km
        FROM parking_lots
      ) AS lots_with_distance
      WHERE distance_km <= $3
      ORDER BY distance_km ASC;
    `;
    const result = await pool.query(query, [lat, lng, radiusKm]);
    return result.rows;
  },

  /**
   * Find a single parking lot by ID
   */
  async findById(id) {
    const result = await pool.query('SELECT * FROM parking_lots WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  /**
   * Atomically decrement available_slots by 1 (within a transaction client)
   */
  async decrementSlot(id, client) {
    const dbClient = client || pool;
    const result = await dbClient.query(
      `UPDATE parking_lots 
       SET available_slots = available_slots - 1 
       WHERE id = $1 AND available_slots > 0
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Increment available_slots by 1 (for cancellation)
   */
  async incrementSlot(id, client) {
    const dbClient = client || pool;
    const result = await dbClient.query(
      `UPDATE parking_lots 
       SET available_slots = available_slots + 1 
       WHERE id = $1 AND available_slots < total_slots
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }
};

module.exports = parkingModel;
