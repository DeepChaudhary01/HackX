import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, Platform, Animated, Modal, TextInput,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createBooking, fetchParkingById, MOCK_USER_ID } from '../services/api';

/* ── Smart time defaults (Fix 3) ── */
function getNextHalfHour() {
  const now = new Date();
  const mins = now.getMinutes();
  const roundUp = mins < 30 ? 30 : 60;
  const start = new Date(now);
  start.setMinutes(roundUp, 0, 0);
  if (roundUp === 60) start.setHours(start.getHours() + 1, 0, 0, 0);
  return start;
}

export default function ParkingDetailScreen({ route, navigation }) {
  const { parking } = route.params;

  // ── Fix 1: Track slots in state, not from frozen route params ──
  const [availableSlots, setAvailableSlots] = useState(parking.availableSlots ?? 0);
  const [totalSlots, setTotalSlots]         = useState(parking.totalSlots ?? 0);

  const smartStart = getNextHalfHour();
  const smartEnd   = new Date(smartStart.getTime() + 2 * 60 * 60 * 1000);

  const [date, setDate]               = useState(new Date());
  const [startTime, setStartTime]     = useState(smartStart);
  const [endTime, setEndTime]         = useState(smartEnd);
  const [showDatePicker, setShowDatePicker]   = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker]     = useState(false);
  const [vehicleNumber, setVehicleNumber]     = useState('');
  const [loading, setLoading]                 = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const slotFlash   = useRef(new Animated.Value(0)).current;   // Fix 6: flash anim
  const bannerAnim  = useRef(new Animated.Value(0)).current;   // Fix 6: banner slide

  const pricePerHour = parking.pricePerHour || parking.price_per_hour || 20;

  // ── Fix 1: Fetch fresh data on mount ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchParkingById(parking.id);
        if (res.data) {
          setAvailableSlots(res.data.availableSlots ?? availableSlots);
          setTotalSlots(res.data.totalSlots ?? totalSlots);
        }
      } catch (_) {} // Silently fall back to route params
    })();
  }, []);

  // ── Derived values ──
  const isFull      = availableSlots <= 0;
  const isLow       = !isFull && availableSlots <= 5;
  const isLastSlot   = availableSlots === 1;
  const fillPercent = totalSlots > 0 ? ((totalSlots - availableSlots) / totalSlots) * 100 : 0;

  const getSlotColor = () => {
    if (isFull) return '#ef4444';
    if (availableSlots <= Math.ceil(totalSlots * 0.2)) return '#f59e0b';
    return '#22c55e';
  };
  const slotColor = getSlotColor();

  const formatDate = (d) =>
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (t) =>
    t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const getDurationHours = () => {
    const diff = endTime.getTime() - startTime.getTime();
    return diff > 0 ? diff / 3600000 : 0;
  };
  const getDurationLabel = () => {
    const hrs = getDurationHours();
    if (hrs <= 0) return 'Invalid';
    const h = Math.floor(hrs);
    const m = Math.round((hrs - h) * 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };
  const getEstimatedCost = () => {
    const hrs = getDurationHours();
    if (hrs <= 0) return 0;
    return Math.round(pricePerHour * hrs * 100) / 100;
  };

  // ── Fix 3: Smart time picking — clamp past times for today ──
  const handleDateChange = (e, d) => {
    setShowDatePicker(false);
    if (!d) return;
    setDate(d);
    // If picked today, clamp start time to be at least now
    const now = new Date();
    if (d.toDateString() === now.toDateString() && startTime < now) {
      const smart = getNextHalfHour();
      setStartTime(smart);
      setEndTime(new Date(smart.getTime() + 2 * 60 * 60 * 1000));
    }
  };

  const handleStartTimeChange = (e, t) => {
    setShowStartPicker(false);
    if (!t) return;
    // Fix 3: If booking today, don't allow past start
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      const minStart = new Date(now.getTime() + 5 * 60 * 1000); // 5 min buffer
      if (t < minStart) {
        Alert.alert('Past Time', 'Start time must be in the future. Adjusted to next available slot.');
        t = getNextHalfHour();
      }
    }
    setStartTime(t);
    // Auto-adjust end if end <= start
    if (endTime <= t) {
      setEndTime(new Date(t.getTime() + 60 * 60 * 1000));
    }
  };

  const handleEndTimeChange = (e, t) => {
    setShowEndPicker(false);
    if (t) setEndTime(t);
  };

  const validateBooking = () => {
    if (isFull) {
      Alert.alert('No Slots', 'This parking lot is currently full.');
      return false;
    }
    const now = new Date();
    const bookingStart = new Date(date);
    bookingStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    if (bookingStart < now) {
      Alert.alert('Invalid Time', 'Cannot book in the past. Please select a future time.');
      return false;
    }
    if (endTime <= startTime) {
      Alert.alert('Invalid Time', 'End time must be after start time.');
      return false;
    }
    const diffHours = getDurationHours();
    if (diffHours > 12) {
      Alert.alert('Too Long', 'Maximum booking duration is 12 hours.');
      return false;
    }
    if (diffHours < 0.5) {
      Alert.alert('Too Short', 'Minimum booking duration is 30 minutes.');
      return false;
    }
    return true;
  };

  const showConfirmation = () => {
    if (!validateBooking()) return;
    setShowConfirmModal(true);
  };

  // ── Fix 6: Success animation ──
  const playSuccessAnimation = (newSlots) => {
    setAvailableSlots(newSlots);
    setShowSuccessBanner(true);

    // Flash the slot number green
    Animated.sequence([
      Animated.timing(slotFlash, { toValue: 1, duration: 150, useNativeDriver: false }),
      Animated.timing(slotFlash, { toValue: 0, duration: 400, useNativeDriver: false }),
    ]).start();

    // Slide in success banner
    Animated.timing(bannerAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const handleBooking = async () => {
    setShowConfirmModal(false);
    setLoading(true);

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    try {
      const bookingData = {
        parkingId: parking.id,
        userId: MOCK_USER_ID,
        vehicleNumber: vehicleNumber.trim() || undefined,
        date: date.toISOString().split('T')[0],
        startTime: `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`,
        endTime: `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`,
      };

      const result = await createBooking(bookingData);

      // ── Fix 1: Update slot count with server response ──
      const newSlots = result.data?.availableSlots ?? (availableSlots - 1);

      // ── Fix 6: Play success animation, then navigate ──
      playSuccessAnimation(newSlots);

      setTimeout(() => {
        setShowSuccessBanner(false);
        bannerAnim.setValue(0);
        navigation.navigate('BookingConfirmation', { booking: result.data });
      }, 1500);

    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Booking failed. Please try again.';
      if (msg.includes('overlap') || msg.includes('No slots available for this time')) {
        Alert.alert('Time Slot Unavailable', 'This time slot is already fully booked. Please choose a different time.', [{ text: 'OK' }]);
      } else if (msg.includes('No parking slots')) {
        setAvailableSlots(0); // Update to reflect reality
        Alert.alert('Fully Booked', 'Someone just booked the last slot. Please try another lot.');
      } else {
        Alert.alert('Booking Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const navigateHere = () => {
    navigation.navigate('Navigation', { parking });
  };

  const cost   = getEstimatedCost();
  const durHrs = getDurationHours();

  // Animated slot background for flash effect
  const slotBgColor = slotFlash.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', '#dcfce7'],
  });

  return (
    <View style={st.wrapper}>
      <ScrollView style={st.container} contentContainerStyle={st.content}>

        {/* Mini Map */}
        <View style={st.mapBox}>
          <MapView
            style={st.map}
            initialRegion={{
              latitude: parking.latitude, longitude: parking.longitude,
              latitudeDelta: 0.008, longitudeDelta: 0.008,
            }}
            scrollEnabled={false} zoomEnabled={false}
          >
            <Marker coordinate={{ latitude: parking.latitude, longitude: parking.longitude }}>
              <View style={[st.marker, { backgroundColor: slotColor }]}>
                <Text style={st.markerTxt}>{isFull ? '✕' : availableSlots}</Text>
              </View>
            </Marker>
          </MapView>
          <TouchableOpacity style={st.navOverlay} onPress={navigateHere}>
            <Text style={st.navOverlayTxt}>Navigate Here →</Text>
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={st.card}>
          <Text style={st.name}>{parking.name}</Text>
          <Text style={st.addr}>{parking.address}</Text>

          {/* Price badge */}
          <View style={st.priceRow}>
            <View style={st.priceBadge}>
              <Text style={st.priceSign}>₹</Text>
              <Text style={st.priceVal}>{pricePerHour}</Text>
              <Text style={st.priceUnit}>/hr</Text>
            </View>
            {parking.distanceKm && (
              <Text style={st.distBadge}>{parking.distanceKm} km away</Text>
            )}
          </View>

          {/* Slot stats — Fix 1: uses state, not frozen params */}
          <Animated.View style={[st.slotRow, { backgroundColor: slotBgColor, borderRadius: 12, padding: 4 }]}>
            <View style={st.slotItem}>
              <Text style={[st.slotNum, { color: slotColor }]}>{availableSlots}</Text>
              <Text style={st.slotLbl}>Available</Text>
            </View>
            <View style={st.slotDiv} />
            <View style={st.slotItem}>
              <Text style={st.slotNum}>{totalSlots}</Text>
              <Text style={st.slotLbl}>Total</Text>
            </View>
            <View style={st.slotDiv} />
            <View style={st.slotItem}>
              <Text style={st.slotNum}>{Math.round(fillPercent)}%</Text>
              <Text style={st.slotLbl}>Used</Text>
            </View>
          </Animated.View>

          <View style={[st.barBg, { marginTop: 6 }]}>
            <View style={[st.barFg, { width: `${Math.min(fillPercent, 100)}%`, backgroundColor: slotColor }]} />
          </View>

          {/* ── Fix 4: Low availability warnings ── */}
          {isFull && (
            <View style={[st.availBanner, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
              <Text style={st.availIcon}>🔴</Text>
              <Text style={[st.availTxt, { color: '#dc2626' }]}>Fully booked — no slots available</Text>
            </View>
          )}
          {isLastSlot && (
            <View style={[st.availBanner, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
              <Text style={st.availIcon}>🔴</Text>
              <Text style={[st.availTxt, { color: '#dc2626' }]}>Last slot remaining — book now!</Text>
            </View>
          )}
          {isLow && !isLastSlot && (
            <View style={[st.availBanner, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
              <Text style={st.availIcon}>⚠️</Text>
              <Text style={[st.availTxt, { color: '#92400e' }]}>Only {availableSlots} slots left — filling fast!</Text>
            </View>
          )}
          {!isFull && !isLow && (
            <View style={[st.statusBadge, { backgroundColor: slotColor + '15' }]}>
              <View style={[st.statusDot, { backgroundColor: slotColor }]} />
              <Text style={[st.statusTxt, { color: slotColor }]}>{availableSlots} slots open</Text>
            </View>
          )}
        </View>

        {/* Booking Card */}
        {!isFull && (
          <View style={st.bookCard}>
            <Text style={st.bookTitle}>Book a Slot</Text>

            {/* Vehicle Number */}
            <View style={st.inputRow}>
              <Text style={st.inputLabel}>Vehicle Number</Text>
              <TextInput
                style={st.vehicleInput}
                placeholder="e.g. GJ 01 AB 1234"
                placeholderTextColor="#9ca3af"
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
                autoCapitalize="characters"
                maxLength={15}
              />
            </View>

            {/* Date */}
            <TouchableOpacity style={st.pickerBtn} onPress={() => setShowDatePicker(true)}>
              <Text style={st.pickerLbl}>Date</Text>
              <Text style={st.pickerVal}>{formatDate(date)}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker value={date} mode="date" minimumDate={new Date()} onChange={handleDateChange} />
            )}

            {/* Start Time */}
            <TouchableOpacity style={st.pickerBtn} onPress={() => setShowStartPicker(true)}>
              <Text style={st.pickerLbl}>Start Time</Text>
              <Text style={st.pickerVal}>{formatTime(startTime)}</Text>
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker value={startTime} mode="time" onChange={handleStartTimeChange} />
            )}

            {/* End Time */}
            <TouchableOpacity style={st.pickerBtn} onPress={() => setShowEndPicker(true)}>
              <Text style={st.pickerLbl}>End Time</Text>
              <Text style={st.pickerVal}>{formatTime(endTime)}</Text>
            </TouchableOpacity>
            {showEndPicker && (
              <DateTimePicker value={endTime} mode="time" onChange={handleEndTimeChange} />
            )}

            {/* Duration + Cost summary */}
            <View style={st.summaryCard}>
              <View style={st.summaryRow}>
                <Text style={st.summaryLbl}>Duration</Text>
                <Text style={st.summaryVal}>{getDurationLabel()}</Text>
              </View>
              <View style={st.summaryDiv} />
              <View style={st.summaryRow}>
                <Text style={st.summaryLbl}>Rate</Text>
                <Text style={st.summaryVal}>₹{pricePerHour}/hr</Text>
              </View>
              <View style={st.summaryDiv} />
              <View style={st.summaryRow}>
                <Text style={st.summaryLbl}>Estimated Cost</Text>
                <Text style={[st.summaryVal, st.costHighlight]}>₹{cost.toFixed(2)}</Text>
              </View>
            </View>

            {/* Duration warnings */}
            {durHrs > 6 && durHrs <= 12 && (
              <View style={st.warnBox}>
                <Text style={st.warnTxt}>Long duration booking — consider if you need the full time</Text>
              </View>
            )}
            {durHrs > 12 && (
              <View style={[st.warnBox, { borderLeftColor: '#ef4444' }]}>
                <Text style={[st.warnTxt, { color: '#ef4444' }]}>Maximum duration is 12 hours</Text>
              </View>
            )}

            {/* Book Button */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                style={[st.bookBtn, loading && st.bookBtnLoading]}
                onPress={showConfirmation}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={st.bookBtnTxt}>Book Now — ₹{cost.toFixed(0)}</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* Navigate button */}
        <TouchableOpacity style={st.navBtn} onPress={navigateHere}>
          <Text style={st.navBtnTxt}>Navigate to Parking →</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Fix 6: Success banner ── */}
      {showSuccessBanner && (
        <Animated.View style={[st.successBanner, { opacity: bannerAnim, transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }] }]}>
          <Text style={st.successIcon}>✓</Text>
          <View>
            <Text style={st.successTitle}>Slot Secured!</Text>
            <Text style={st.successSub}>Redirecting to confirmation...</Text>
          </View>
        </Animated.View>
      )}

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <View style={st.modalCard}>
            <Text style={st.modalTitle}>Confirm Booking</Text>

            <ModalRow label="Parking"  value={parking.name} />
            <ModalRow label="Date"     value={formatDate(date)} />
            <ModalRow label="Time"     value={`${formatTime(startTime)} — ${formatTime(endTime)}`} />
            <ModalRow label="Duration" value={getDurationLabel()} />
            <ModalRow label="Vehicle"  value={vehicleNumber.trim() || 'Not provided'} />
            <View style={st.modalDiv} />
            <ModalRow label="Rate"     value={`₹${pricePerHour}/hr`} />
            <ModalRow label="Total"    value={`₹${cost.toFixed(2)}`} highlight />

            <View style={st.modalBtns}>
              <TouchableOpacity style={st.modalCancelBtn} onPress={() => setShowConfirmModal(false)}>
                <Text style={st.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.modalConfirmBtn} onPress={handleBooking}>
                <Text style={st.modalConfirmTxt}>Confirm — ₹{cost.toFixed(0)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ModalRow({ label, value, highlight }) {
  return (
    <View style={st.modalRow}>
      <Text style={st.modalLbl}>{label}</Text>
      <Text style={[st.modalVal, highlight && { color: '#22c55e', fontWeight: '800', fontSize: 16 }]}
        numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  wrapper:   { flex: 1, backgroundColor: '#f1f5f9' },
  container: { flex: 1 },
  content:   { paddingBottom: 36 },

  mapBox:       { height: 200, overflow: 'hidden' },
  map:          { flex: 1 },
  marker:       { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  markerTxt:    { color: '#fff', fontSize: 14, fontWeight: '800' },
  navOverlay:   { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(6,11,24,0.88)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  navOverlayTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: -16,
    borderRadius: 18, padding: 18,
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8,
  },
  name:  { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 3 },
  addr:  { fontSize: 13, color: '#64748b', marginBottom: 12 },

  priceRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  priceBadge:{ flexDirection: 'row', alignItems: 'baseline', backgroundColor: '#f0fdf4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0' },
  priceSign: { fontSize: 14, fontWeight: '700', color: '#16a34a' },
  priceVal:  { fontSize: 22, fontWeight: '900', color: '#16a34a', marginLeft: 2 },
  priceUnit: { fontSize: 11, fontWeight: '600', color: '#4ade80', marginLeft: 2 },
  distBadge: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  slotRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  slotItem: { flex: 1, alignItems: 'center' },
  slotNum:  { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  slotLbl:  { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  slotDiv:  { width: 1, height: 32, backgroundColor: '#e2e8f0' },
  barBg:    { height: 5, borderRadius: 3, backgroundColor: '#f1f5f9', overflow: 'hidden', marginBottom: 12 },
  barFg:    { height: '100%', borderRadius: 3 },

  // Fix 4: Low availability banners
  availBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1, marginBottom: 4,
  },
  availIcon: { fontSize: 16 },
  availTxt:  { fontSize: 13, fontWeight: '700', flex: 1 },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  statusDot:   { width: 8, height: 8, borderRadius: 4 },
  statusTxt:   { fontSize: 13, fontWeight: '700' },

  // Fix 6: Success banner
  successBanner: {
    position: 'absolute', top: Platform.OS === 'ios' ? 50 : 10, left: 16, right: 16,
    backgroundColor: '#22c55e', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    elevation: 10, shadowColor: '#22c55e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10,
  },
  successIcon:  { fontSize: 24, color: '#fff', fontWeight: '800' },
  successTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  successSub:   { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },

  bookCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 18, padding: 18,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6,
  },
  bookTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 14 },

  inputRow:     { marginBottom: 10 },
  inputLabel:   { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 5 },
  vehicleInput: {
    backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '700',
    color: '#0f172a', letterSpacing: 1,
  },

  pickerBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8,
  },
  pickerLbl: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  pickerVal: { fontSize: 14, color: '#0f172a', fontWeight: '700' },

  summaryCard: {
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 14,
    marginTop: 6, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0',
  },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  summaryDiv:  { height: 1, backgroundColor: '#e2e8f0', marginVertical: 4 },
  summaryLbl:  { fontSize: 13, color: '#64748b', fontWeight: '500' },
  summaryVal:  { fontSize: 13, color: '#0f172a', fontWeight: '700' },
  costHighlight: { color: '#16a34a', fontSize: 17, fontWeight: '900' },

  warnBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fffbeb', borderLeftWidth: 3, borderLeftColor: '#f59e0b',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 10,
  },
  warnTxt: { fontSize: 12, color: '#92400e', fontWeight: '600' },

  bookBtn:        { backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  bookBtnLoading: { opacity: 0.7 },
  bookBtnTxt:     { color: '#fff', fontSize: 16, fontWeight: '800' },

  navBtn:    { marginHorizontal: 16, marginTop: 12, backgroundColor: '#0f172a', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  navBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:    { backgroundColor: '#fff', borderRadius: 20, padding: 22, width: '100%', maxWidth: 360, elevation: 10 },
  modalTitle:   { fontSize: 19, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 16 },
  modalRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  modalLbl:     { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  modalVal:     { fontSize: 13, color: '#0f172a', fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 12 },
  modalDiv:     { height: 1, backgroundColor: '#e2e8f0', marginVertical: 4 },
  modalBtns:    { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalCancelTxt: { color: '#374151', fontSize: 14, fontWeight: '600' },
  modalConfirmBtn:{ flex: 1, backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalConfirmTxt:{ color: '#fff', fontSize: 14, fontWeight: '700' },
});
