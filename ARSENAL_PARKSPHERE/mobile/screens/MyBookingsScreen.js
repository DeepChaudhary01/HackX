import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, Platform, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchUserBookings, cancelBooking, MOCK_USER_ID } from '../services/api';

export default function MyBookingsScreen({ navigation }) {
  const [bookings, setBookings]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const loadBookings = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetchUserBookings(MOCK_USER_ID);
      const data = res.data || [];
      // Sort: confirmed first, then cancelled, newest first
      data.sort((a, b) => {
        if (a.status === 'confirmed' && b.status !== 'confirmed') return -1;
        if (a.status !== 'confirmed' && b.status === 'confirmed') return 1;
        return new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt);
      });
      setBookings(data);
    } catch (err) {
      if (!silent) Alert.alert('Error', 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadBookings(); }, []);

  useFocusEffect(
    useCallback(() => {
      if (bookings.length >= 0) loadBookings(true);
    }, [])
  );

  const handleCancel = (booking) => {
    const id = booking.id;
    Alert.alert(
      'Cancel Booking?',
      `Cancel your booking at ${booking.parking_name || booking.parkingName || 'this lot'}?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Booking', style: 'destructive',
          onPress: async () => {
            setCancellingId(id);
            try {
              await cancelBooking(id, MOCK_USER_ID);
              // Update local state immediately
              setBookings(prev => prev.map(b =>
                b.id === id ? { ...b, status: 'cancelled' } : b
              ));
              Alert.alert('Cancelled', 'Booking cancelled and slot released.');
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to cancel');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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

  const renderItem = ({ item }) => {
    const isConfirmed = item.status === 'confirmed';
    const isCancelled = item.status === 'cancelled';
    const totalCost = item.total_cost || item.totalCost;
    const parkingName = item.parking_name || item.parkingName || 'Parking Lot';
    const startTime = item.start_time || item.startTime || '';
    const endTime = item.end_time || item.endTime || '';
    const date = item.date;

    return (
      <View style={[s.bookingCard, isCancelled && s.cardCancelled]}>
        {/* Header */}
        <View style={s.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardName} numberOfLines={1}>{parkingName}</Text>
            <Text style={s.cardDate}>{formatDate(date)}</Text>
          </View>
          <View style={[s.statusPill, isCancelled ? s.pillCancelled : s.pillConfirmed]}>
            <Text style={[s.statusPillTxt, isCancelled ? s.pillTxtCancelled : s.pillTxtConfirmed]}>
              {item.status?.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={s.cardBody}>
          <View style={s.detailCol}>
            <Text style={s.detailLbl}>Time</Text>
            <Text style={s.detailVal}>{formatTime(startTime)} — {formatTime(endTime)}</Text>
          </View>
          {totalCost && (
            <View style={s.detailCol}>
              <Text style={s.detailLbl}>Cost</Text>
              <Text style={[s.detailVal, s.costVal]}>₹{parseFloat(totalCost).toFixed(0)}</Text>
            </View>
          )}
          {item.vehicle_number && (
            <View style={s.detailCol}>
              <Text style={s.detailLbl}>Vehicle</Text>
              <Text style={s.detailVal}>{item.vehicle_number}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        {isConfirmed && (
          <View style={s.cardActions}>
            <TouchableOpacity
              style={s.viewBtn}
              onPress={() => navigation.navigate('BookingConfirmation', {
                booking: {
                  id: item.id,
                  parkingName,
                  parkingAddress: item.address || '',
                  latitude: item.latitude || 0,
                  longitude: item.longitude || 0,
                  date, startTime, endTime,
                  vehicleNumber: item.vehicle_number,
                  totalCost,
                  durationHours: item.duration_hours,
                  status: item.status,
                },
              })}
            >
              <Text style={s.viewBtnTxt}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => handleCancel(item)}
              disabled={cancellingId === item.id}
            >
              {cancellingId === item.id
                ? <ActivityIndicator size="small" color="#dc2626" />
                : <Text style={s.cancelBtnTxt}>Cancel</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={s.loadingTxt}>Loading bookings...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header stats */}
      <View style={s.statsBar}>
        <View style={s.statItem}>
          <Text style={s.statNum}>{bookings.filter(b => b.status === 'confirmed').length}</Text>
          <Text style={s.statLbl}>Active</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statNum}>{bookings.filter(b => b.status === 'cancelled').length}</Text>
          <Text style={s.statLbl}>Cancelled</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statNum}>{bookings.length}</Text>
          <Text style={s.statLbl}>Total</Text>
        </View>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadBookings(true); }} />
        }
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={s.emptyTitle}>No bookings yet</Text>
            <Text style={s.emptySub}>Your parking bookings will appear here</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.goBack()}>
              <Text style={s.emptyBtnTxt}>Find Parking</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  loadingTxt: { marginTop: 12, fontSize: 14, color: '#64748b', fontWeight: '600' },

  statsBar: {
    flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 14, padding: 14, alignItems: 'center',
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum:  { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  statLbl:  { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: '#e2e8f0' },

  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },

  bookingCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4,
    borderLeftWidth: 4, borderLeftColor: '#22c55e',
  },
  cardCancelled: { borderLeftColor: '#94a3b8', opacity: 0.75 },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardName:   { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  cardDate:   { fontSize: 12, color: '#64748b', fontWeight: '500' },

  statusPill:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  pillConfirmed: { backgroundColor: '#dcfce7' },
  pillCancelled: { backgroundColor: '#f1f5f9' },
  statusPillTxt: { fontSize: 10, fontWeight: '700' },
  pillTxtConfirmed: { color: '#16a34a' },
  pillTxtCancelled: { color: '#94a3b8' },

  cardBody: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  detailCol: {},
  detailLbl: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  detailVal: { fontSize: 14, color: '#0f172a', fontWeight: '700' },
  costVal:   { color: '#16a34a' },

  cardActions: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  viewBtn:    { flex: 2, backgroundColor: '#0f172a', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  viewBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cancelBtn:    { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5, borderColor: '#fca5a5' },
  cancelBtnTxt: { color: '#dc2626', fontSize: 13, fontWeight: '700' },

  emptyBox:  { paddingVertical: 60, alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  emptySub:  { fontSize: 14, color: '#64748b', marginBottom: 20 },
  emptyBtn:  { backgroundColor: '#0f172a', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  emptyBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
