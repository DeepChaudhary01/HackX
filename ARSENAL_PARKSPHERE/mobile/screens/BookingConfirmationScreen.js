import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Animated, Alert, ActivityIndicator,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { cancelBooking, MOCK_USER_ID } from '../services/api';

export default function BookingConfirmationScreen({ route, navigation }) {
  const { booking } = route.params;
  const [status, setStatus]       = useState(booking.status || 'confirmed');
  const [cancelling, setCancelling] = useState(false);

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(40)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(checkScale, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (t) => {
    if (!t) return '';
    const parts = t.split(':');
    const hour = parseInt(parts[0]);
    const min = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h}:${min} ${ampm}`;
  };

  const startNavigation = () => {
    navigation.navigate('Navigation', {
      parking: {
        name: booking.parkingName,
        address: booking.parkingAddress,
        latitude: booking.latitude,
        longitude: booking.longitude,
        availableSlots: null,
      },
    });
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Booking?',
      'Are you sure you want to cancel this booking? Your parking slot will be released.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const result = await cancelBooking(booking.id, MOCK_USER_ID);
              setStatus('cancelled');
              Alert.alert(
                'Booking Cancelled',
                result.data?.refundNote || 'Your booking has been cancelled and the slot has been released.',
                [{ text: 'OK' }]
              );
            } catch (err) {
              const msg = err.response?.data?.error || err.message || 'Failed to cancel';
              Alert.alert('Cancel Failed', msg);
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const isConfirmed = status === 'confirmed';
  const isCancelled = status === 'cancelled';
  const totalCost   = booking.totalCost || booking.total_cost;
  const durationHrs = booking.durationHours || booking.duration_hours;

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>

      {/* Success / Cancelled Icon */}
      <Animated.View style={[
        st.checkCircle,
        { transform: [{ scale: checkScale }] },
        isCancelled && { backgroundColor: '#64748b' },
      ]}>
        <Text style={st.checkIcon}>{isCancelled ? '✕' : '✓'}</Text>
      </Animated.View>
      <Animated.Text style={[st.title, { opacity: fadeAnim }]}>
        {isCancelled ? 'Booking Cancelled' : 'Booking Confirmed!'}
      </Animated.Text>
      <Animated.Text style={[st.subtitle, { opacity: fadeAnim }]}>
        {isCancelled ? 'Your slot has been released' : 'Your parking spot has been reserved'}
      </Animated.Text>

      {/* Map */}
      <Animated.View style={[st.mapBox, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity activeOpacity={0.9} onPress={startNavigation} style={{ flex: 1 }}>
          <MapView
            style={st.map}
            initialRegion={{
              latitude: booking.latitude, longitude: booking.longitude,
              latitudeDelta: 0.01, longitudeDelta: 0.01,
            }}
            scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}
          >
            <Marker coordinate={{ latitude: booking.latitude, longitude: booking.longitude }}>
              <View style={st.mapMarker}>
                <Text style={st.mapMarkerTxt}>P</Text>
              </View>
            </Marker>
          </MapView>
          <View style={st.mapOverlay}>
            <Text style={st.mapOverlayTxt}>Tap to navigate →</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Booking Details */}
      <Animated.View style={[st.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <DetailRow label="Booking ID" value={booking.id?.slice(0, 8).toUpperCase()} mono />
        <View style={st.div} />
        <DetailRow label="Parking"    value={booking.parkingName} />
        <View style={st.div} />
        <DetailRow label="Address"    value={booking.parkingAddress} />
        <View style={st.div} />
        <DetailRow label="Date"       value={formatDate(booking.date)} />
        <View style={st.div} />
        <DetailRow label="Time"       value={`${formatTime(booking.startTime)} — ${formatTime(booking.endTime)}`} />
        {booking.vehicleNumber && (
          <>
            <View style={st.div} />
            <DetailRow label="Vehicle" value={booking.vehicleNumber} mono />
          </>
        )}

        {/* Duration + Cost */}
        {(durationHrs || totalCost) && (
          <>
            <View style={st.div} />
            <View style={st.costSection}>
              {durationHrs && <DetailRow label="Duration" value={`${parseFloat(durationHrs).toFixed(1)} hours`} />}
              {totalCost && (
                <View style={st.costRow}>
                  <Text style={st.costLabel}>Total Cost</Text>
                  <Text style={st.costValue}>₹{parseFloat(totalCost).toFixed(2)}</Text>
                </View>
              )}
            </View>
          </>
        )}

        <View style={st.div} />
        <View style={st.statusRow}>
          <Text style={st.detailLbl}>Status</Text>
          <View style={[st.statusBadge, isCancelled && { backgroundColor: '#fee2e2' }]}>
            <Text style={[st.statusTxt, isCancelled && { color: '#dc2626' }]}>
              {status.toUpperCase()}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Action Buttons */}
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], width: '100%' }}>

        {/* Navigate */}
        {isConfirmed && (
          <TouchableOpacity style={st.navBtn} onPress={startNavigation}>
            <Text style={st.navBtnTxt}>Start Navigation →</Text>
          </TouchableOpacity>
        )}

        {/* Cancel */}
        {isConfirmed && (
          <TouchableOpacity
            style={st.cancelBtn}
            onPress={handleCancel}
            disabled={cancelling}
            activeOpacity={0.7}
          >
            {cancelling
              ? <ActivityIndicator size="small" color="#dc2626" />
              : <Text style={st.cancelBtnTxt}>Cancel Booking</Text>
            }
          </TouchableOpacity>
        )}

        {/* Done */}
        <TouchableOpacity style={st.doneBtn} onPress={() => navigation.popToTop()}>
          <Text style={st.doneBtnTxt}>Done — Back to Map</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <View style={st.detailRow}>
      <Text style={st.detailLbl}>{label}</Text>
      <Text style={[st.detailVal, mono && st.monoVal]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content:   { alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36 },

  checkCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#22c55e', justifyContent: 'center', alignItems: 'center',
    marginBottom: 12, elevation: 6,
    shadowColor: '#22c55e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10,
  },
  checkIcon: { fontSize: 34, color: '#fff', fontWeight: '800' },
  title:     { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  subtitle:  { fontSize: 13, color: '#64748b', marginBottom: 18 },

  mapBox: {
    width: '100%', height: 180, borderRadius: 16, overflow: 'hidden', marginBottom: 16,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  map:           { width: '100%', height: '100%' },
  mapMarker:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  mapMarkerTxt:  { fontSize: 18, fontWeight: '800', color: '#fff' },
  mapOverlay:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(6,11,24,0.85)', paddingVertical: 8, alignItems: 'center' },
  mapOverlayTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  card: {
    width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 16,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 9 },
  detailLbl: { fontSize: 12, color: '#94a3b8', fontWeight: '500', minWidth: 75 },
  detailVal: { fontSize: 13, color: '#0f172a', fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 12 },
  monoVal:   { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#64748b' },
  div:       { height: 1, backgroundColor: '#f1f5f9' },

  costSection: { paddingVertical: 4 },
  costRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  costLabel:   { fontSize: 13, color: '#64748b', fontWeight: '600' },
  costValue:   { fontSize: 20, fontWeight: '900', color: '#16a34a' },

  statusRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  statusBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  statusTxt:   { color: '#16a34a', fontSize: 11, fontWeight: '700' },

  navBtn:    { width: '100%', backgroundColor: '#0f172a', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  navBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },

  cancelBtn:    { width: '100%', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10, borderWidth: 2, borderColor: '#fca5a5' },
  cancelBtnTxt: { color: '#dc2626', fontSize: 14, fontWeight: '700' },

  doneBtn:    { width: '100%', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 15, alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0' },
  doneBtnTxt: { color: '#374151', fontSize: 15, fontWeight: '600' },
});
