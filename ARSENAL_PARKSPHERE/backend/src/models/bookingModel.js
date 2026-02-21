const pool = require('../config/db');

const bookingModel = {
  /**
   * Create a new booking (within a transaction client)
   */
  async create(bookingData, client) {
    const dbClient = client || pool;
    const { id, parkingId, userId, vehicleNumber, date, startTime, endTime, durationHours, totalCost } = bookingData;
    const result = await dbClient.query(
      `INSERT INTO bookings (id, parking_id, user_id, vehicle_number, date, start_time, end_time, duration_hours, total_cost, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmed')
       RETURNING *`,
      [id, parkingId, userId, vehicleNumber || null, date, startTime, endTime, durationHours, totalCost]
    );
    return result.rows[0];
  },

  /**
   * Find overlapping confirmed bookings at the same lot/date/time range.
   * Two bookings overlap if: existing.start < new.end AND existing.end > new.start
   */
  async findOverlapping(parkingId, date, startTime, endTime, client) {
    const dbClient = client || pool;
    const result = await dbClient.query(
      `SELECT COUNT(*)::int AS cnt
       FROM bookings
       WHERE parking_id = $1
         AND date = $2
         AND status = 'confirmed'
         AND start_time < $4
         AND end_time > $3`,
      [parkingId, date, startTime, endTime]
    );
    return result.rows[0].cnt;
  },

  /**
   * Count active (confirmed) bookings at a specific parking lot for a given date/time.
   * A booking is "active" at time T if: start_time <= T < end_time
   */
  async countActiveAtTime(parkingId, date, time, client) {
    const dbClient = client || pool;
    const result = await dbClient.query(
      `SELECT COUNT(*)::int AS cnt
       FROM bookings
       WHERE parking_id = $1
         AND date = $2
         AND status = 'confirmed'
         AND start_time <= $3
         AND end_time > $3`,
      [parkingId, date, time]
    );
    return result.rows[0].cnt;
  },

  /**
   * Cancel a booking by ID — sets status to 'cancelled' and records timestamp
   */
  async cancelBooking(bookingId, client) {
    const dbClient = client || pool;
    const result = await dbClient.query(
      `UPDATE bookings
       SET status = 'cancelled', cancelled_at = NOW()
       WHERE id = $1 AND status = 'confirmed'
       RETURNING *`,
      [bookingId]
    );
    return result.rows[0] || null;
  },

  /**
   * Find all bookings for a user (with parking info)
   */
  async findByUserId(userId) {
    const result = await pool.query(
      `SELECT b.*, p.name AS parking_name, p.address, p.latitude, p.longitude, p.price_per_hour
       FROM bookings b
       JOIN parking_lots p ON b.parking_id = p.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  /**
   * Find booking by ID (with parking info)
   */
  async findById(id) {
    const result = await pool.query(
      `SELECT b.*, p.name AS parking_name, p.address, p.latitude, p.longitude, p.price_per_hour
       FROM bookings b
       JOIN parking_lots p ON b.parking_id = p.id
       WHERE b.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }
};

module.exports = bookingModel;
