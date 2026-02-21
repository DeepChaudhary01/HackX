const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const bookingModel = require('../models/bookingModel');
const parkingModel = require('../models/parkingModel');

const bookingService = {
  /**
   * Create a booking with:
   * - Overlap detection (no double-booking for same time)
   * - Real-time slot check
   * - Automatic cost calculation
   * - Transaction-safe slot decrement
   */
  async createBooking({ parkingId, userId, vehicleNumber, date, startTime, endTime }) {
    // ── Validate required fields ──
    if (!parkingId || !userId || !date || !startTime || !endTime) {
      throw { status: 400, message: 'All fields are required: parkingId, userId, date, startTime, endTime' };
    }

    // ── Validate date is not in the past ──
    const bookingDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      throw { status: 400, message: 'Cannot book for a past date' };
    }

    // ── Validate time ──
    if (startTime >= endTime) {
      throw { status: 400, message: 'Start time must be before end time' };
    }

    // ── Calculate duration ──
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const durationHours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;

    if (durationHours <= 0) {
      throw { status: 400, message: 'End time must be after start time' };
    }
    if (durationHours > 12) {
      throw { status: 400, message: 'Maximum booking duration is 12 hours' };
    }

    // ── Check parking lot exists ──
    const lot = await parkingModel.findById(parkingId);
    if (!lot) {
      throw { status: 404, message: 'Parking lot not found' };
    }

    // ── Check if lot is full (static check first) ──
    if (lot.available_slots <= 0) {
      throw { status: 409, message: 'This parking lot is currently full. No slots available.' };
    }

    // ── Calculate total cost ──
    const pricePerHour = parseFloat(lot.price_per_hour) || 20;
    const totalCost = Math.round(pricePerHour * durationHours * 100) / 100;

    // ── Start transaction ──
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // ── Overlap check — are there already bookings at this lot during this time? ──
      const overlapCount = await bookingModel.findOverlapping(parkingId, date, startTime, endTime, client);

      // Check if overlapping bookings would exceed total slots
      if (overlapCount >= lot.total_slots) {
        throw {
          status: 409,
          message: `No slots available for this time period. All ${lot.total_slots} slots are booked between ${startTime} and ${endTime}.`
        };
      }

      // ── Atomically decrement slot ──
      const updated = await parkingModel.decrementSlot(parkingId, client);
      if (!updated) {
        throw { status: 409, message: 'No parking slots available. Someone may have just booked the last one.' };
      }

      // ── Create booking ──
      const bookingId = uuidv4();
      const booking = await bookingModel.create(
        {
          id: bookingId,
          parkingId,
          userId,
          vehicleNumber: vehicleNumber || null,
          date,
          startTime,
          endTime,
          durationHours,
          totalCost,
        },
        client
      );

      await client.query('COMMIT');

      return {
        id: booking.id,
        parkingId: booking.parking_id,
        parkingName: lot.name,
        parkingAddress: lot.address,
        latitude: lot.latitude,
        longitude: lot.longitude,
        userId: booking.user_id,
        vehicleNumber: booking.vehicle_number,
        date: booking.date,
        startTime: booking.start_time,
        endTime: booking.end_time,
        durationHours: booking.duration_hours,
        totalCost: booking.total_cost,
        pricePerHour: lot.price_per_hour,
        status: booking.status,
        createdAt: booking.created_at,
        availableSlots: updated.available_slots,
        totalSlots: updated.total_slots,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Cancel a booking — sets status='cancelled', increments slot back
   */
  async cancelBooking(bookingId, userId) {
    if (!bookingId) {
      throw { status: 400, message: 'Booking ID is required' };
    }

    // Find the booking first
    const booking = await bookingModel.findById(bookingId);
    if (!booking) {
      throw { status: 404, message: 'Booking not found' };
    }

    if (booking.status === 'cancelled') {
      throw { status: 400, message: 'This booking is already cancelled' };
    }

    if (booking.status === 'completed') {
      throw { status: 400, message: 'Cannot cancel a completed booking' };
    }

    // Optional: verify the user owns this booking
    if (userId && booking.user_id !== userId) {
      throw { status: 403, message: 'You can only cancel your own bookings' };
    }

    // Check if booking is in the past
    const now = new Date();
    const bookingDateTime = new Date(booking.date);
    const [sh, sm] = booking.start_time.split(':').map(Number);
    bookingDateTime.setHours(sh, sm, 0, 0);

    const isPast = bookingDateTime < now;

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Cancel the booking
      const cancelled = await bookingModel.cancelBooking(bookingId, client);
      if (!cancelled) {
        throw { status: 409, message: 'Failed to cancel booking. It may have already been cancelled.' };
      }

      // Increment the slot back (only if not already past)
      let updatedLot = null;
      if (!isPast) {
        updatedLot = await parkingModel.incrementSlot(booking.parking_id, client);
      }

      await client.query('COMMIT');

      return {
        id: cancelled.id,
        parkingId: cancelled.parking_id,
        parkingName: booking.parking_name,
        parkingAddress: booking.address,
        latitude: booking.latitude,
        longitude: booking.longitude,
        userId: cancelled.user_id,
        vehicleNumber: cancelled.vehicle_number,
        date: cancelled.date,
        startTime: cancelled.start_time,
        endTime: cancelled.end_time,
        durationHours: cancelled.duration_hours,
        totalCost: cancelled.total_cost,
        status: cancelled.status,
        cancelledAt: cancelled.cancelled_at,
        availableSlots: updatedLot ? updatedLot.available_slots : null,
        totalSlots: updatedLot ? updatedLot.total_slots : null,
        refundNote: isPast
          ? 'No refund — booking time has already passed'
          : 'Slot has been released. Refund will be processed.',
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Get a single booking by ID
   */
  async getBookingById(bookingId) {
    if (!bookingId) {
      throw { status: 400, message: 'Booking ID is required' };
    }
    const booking = await bookingModel.findById(bookingId);
    if (!booking) {
      throw { status: 404, message: 'Booking not found' };
    }
    return {
      id: booking.id,
      parkingId: booking.parking_id,
      parkingName: booking.parking_name,
      parkingAddress: booking.address,
      latitude: booking.latitude,
      longitude: booking.longitude,
      userId: booking.user_id,
      vehicleNumber: booking.vehicle_number,
      date: booking.date,
      startTime: booking.start_time,
      endTime: booking.end_time,
      durationHours: booking.duration_hours,
      totalCost: booking.total_cost,
      pricePerHour: booking.price_per_hour,
      status: booking.status,
      cancelledAt: booking.cancelled_at,
      createdAt: booking.created_at,
    };
  },

  /**
   * Get all bookings for a user
   */
  async getUserBookings(userId) {
    if (!userId) {
      throw { status: 400, message: 'User ID is required' };
    }
    const bookings = await bookingModel.findByUserId(userId);
    return bookings.map((b) => ({
      id: b.id,
      parkingId: b.parking_id,
      parkingName: b.parking_name,
      parkingAddress: b.address,
      latitude: b.latitude,
      longitude: b.longitude,
      userId: b.user_id,
      vehicleNumber: b.vehicle_number,
      date: b.date,
      startTime: b.start_time,
      endTime: b.end_time,
      durationHours: b.duration_hours,
      totalCost: b.total_cost,
      pricePerHour: b.price_per_hour,
      status: b.status,
      cancelledAt: b.cancelled_at,
      createdAt: b.created_at,
    }));
  },
};

module.exports = bookingService;
