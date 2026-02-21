-- ParkSphere Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables if they exist (for clean re-init)
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS parking_lots;

-- Parking Lots table
CREATE TABLE parking_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  total_slots INTEGER NOT NULL CHECK (total_slots >= 0),
  available_slots INTEGER NOT NULL CHECK (available_slots >= 0),
  price_per_hour NUMERIC(8,2) NOT NULL DEFAULT 20.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT available_lte_total CHECK (available_slots <= total_slots)
);

-- Bookings table
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parking_id UUID NOT NULL REFERENCES parking_lots(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  vehicle_number VARCHAR(20),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours NUMERIC(5,2),
  total_cost NUMERIC(8,2),
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_parking_location ON parking_lots(latitude, longitude);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_parking ON bookings(parking_id);
CREATE INDEX idx_bookings_overlap ON bookings(parking_id, date, status);
