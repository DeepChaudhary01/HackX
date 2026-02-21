import axios from 'axios';

/*
 * ─────────────────────────────────────────────
 *   HOW TO FIND YOUR PC's LOCAL IP:
 *   Windows: open CMD and run `ipconfig`
 *            look for "IPv4 Address" under your WiFi adapter
 *   Example: 192.168.1.42  →  use http://192.168.1.42:5000/api
 *
 *   Make sure your phone and PC are on the SAME WiFi network!
 * ─────────────────────────────────────────────
 */
const YOUR_PC_IP = '10.186.242.18'; // ← Change this to your PC's IP

const API_BASE_URL = `http://${YOUR_PC_IP}:5000/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Mock user ID (no auth yet)
export const MOCK_USER_ID = 'mock-user-001';

// ── Parking ──

export const fetchNearbyParking = async (lat, lng, radius = 10) => {
  const response = await api.get('/parking/nearby', {
    params: { lat, lng, radius },
  });
  return response.data;
};

export const fetchParkingById = async (id) => {
  const response = await api.get(`/parking/${id}`);
  return response.data;
};

// ── Booking ──

export const createBooking = async (bookingData) => {
  const response = await api.post('/booking', bookingData);
  return response.data;
};

export const cancelBooking = async (bookingId, userId = MOCK_USER_ID) => {
  const response = await api.patch(`/booking/${bookingId}/cancel`, { userId });
  return response.data;
};

export const fetchBookingById = async (bookingId) => {
  const response = await api.get(`/booking/detail/${bookingId}`);
  return response.data;
};

export const fetchUserBookings = async (userId = MOCK_USER_ID) => {
  const response = await api.get(`/booking/${userId}`);
  return response.data;
};

// Helper to update IP at runtime (optional)
export const setBaseUrl = (ip) => {
  api.defaults.baseURL = `http://${ip}:5000/api`;
};

export default api;
