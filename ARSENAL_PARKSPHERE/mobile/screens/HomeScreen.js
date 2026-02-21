import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Dimensions, Platform, Animated, TextInput, Keyboard,
  FlatList, ScrollView,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import ParkingMarker from '../components/ParkingMarker';
import { fetchNearbyParking } from '../services/api';
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const CARD_W   = width - 48;
const CARD_GAP = 14;
const SNAP_INT = CARD_W + CARD_GAP;

const SH_FULL      = height * 0.44;
const SH_COLLAPSED = 58;

/* ── Design System ── */
const C = {
  open:    '#22C55E',
  low:     '#F59E0B',
  full:    '#EF4444',
  dark:    '#060B18',
  primary: '#0F172A',
  sec:     '#1E293B',
  muted:   '#64748B',
  light:   '#94A3B8',
  bg:      '#F1F5F9',
  surface: '#FFFFFF',
  border:  '#E2E8F0',
  accent:  '#10B981',
  indigo:  '#6366F1',
};

const RADIUS_OPTIONS = [2, 5, 10, 25, 50, 100];
const DEFAULT_CENTER = { latitude: 23.0225, longitude: 72.5714 };
const DEFAULT_REGION = { ...DEFAULT_CENTER, latitudeDelta: 0.15, longitudeDelta: 0.15 };

export default function HomeScreen({ navigation }) {
  const [lots,         setLots]         = useState([]);
  const [filtered,     setFiltered]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [searching,    setSearching]    = useState(false);
  const [selectedId,   setSelectedId]   = useState(null);
  const [search,       setSearch]       = useState('');
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [radius,       setRadius]       = useState(10);
  const [center,       setCenter]       = useState(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState(null);
  const [tapPin,       setTapPin]       = useState(null);
  const [sheetOpen,    setSheetOpen]    = useState(true);

  const mapRef     = useRef(null);
  const listRef    = useRef(null);
  const searchAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim  = useRef(new Animated.Value(SH_FULL)).current;

  const toggleSheet = useCallback(() => {
    const next = !sheetOpen;
    setSheetOpen(next);
    Animated.spring(sheetAnim, {
      toValue: next ? SH_FULL : SH_COLLAPSED,
      tension: 70, friction: 12, useNativeDriver: false,
    }).start();
  }, [sheetOpen]);

  const loadData = useCallback(async ({
    lat = center.latitude, lng = center.longitude,
    km = radius, silent = false,
  } = {}) => {
    try {
      if (!silent) setLoading(true); else setSearching(true);
      const res  = await fetchNearbyParking(lat, lng, km);
      const data = res.data || [];
      setLots(data); setFiltered(data);
      if (data.length > 0) {
        setSelectedId(data[0].id);
        setTimeout(() => fitAll(data, { latitude: lat, longitude: lng }), 600);
      } else if (silent) {
        Alert.alert('No Parking', `No spots within ${km} km.`);
      }
    } catch {
      Alert.alert('Connection Error',
        'Check: backend running, same WiFi, correct IP in api.js',
        [{ text: 'Retry', onPress: () => loadData({ lat, lng, km }) }, { text: 'OK' }]
      );
    } finally { setLoading(false); setSearching(false); }
  }, [center, radius]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserLocation(c); setCenter(c);
          loadData({ lat: c.latitude, lng: c.longitude, km: radius });
          return;
        }
      } catch (_) {}
      loadData({ lat: DEFAULT_CENTER.latitude, lng: DEFAULT_CENTER.longitude, km: radius });
    })();
  }, []);

  // ── Fix 2: Auto-refresh when screen gains focus (after booking/cancel) ──
  useFocusEffect(
    useCallback(() => {
      // Only silent-refresh if we already have data (skip initial load)
      if (lots.length > 0) {
        loadData({ lat: center.latitude, lng: center.longitude, km: radius, silent: true });
      }
    }, [center, radius, lots.length])
  );

  useEffect(() => {
    const q = search.trim().toLowerCase();
    setFiltered(q
      ? lots.filter(l => l.name.toLowerCase().includes(q) || l.address.toLowerCase().includes(q))
      : lots
    );
  }, [search, lots]);

  const onRadiusChange = (km) => {
    setRadius(km);
    loadData({ lat: center.latitude, lng: center.longitude, km, silent: true });
  };

  const onMapLongPress = ({ nativeEvent: { coordinate } }) => {
    setTapPin(coordinate); setCenter(coordinate);
    loadData({ lat: coordinate.latitude, lng: coordinate.longitude, km: radius, silent: true });
    mapRef.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 400);
    if (!sheetOpen) {
      setSheetOpen(true);
      Animated.spring(sheetAnim, { toValue: SH_FULL, tension: 70, friction: 12, useNativeDriver: false }).start();
    }
  };

  const resetToMyLocation = () => {
    const c = userLocation || DEFAULT_CENTER;
    setTapPin(null); setCenter(c);
    loadData({ lat: c.latitude, lng: c.longitude, km: radius, silent: true });
    mapRef.current?.animateToRegion({ ...c, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 400);
  };

  const fitAll = (data, ctr) => {
    if (!mapRef.current || !data.length) return;
    const coords = data.map(l => ({ latitude: l.latitude, longitude: l.longitude }));
    if (ctr) coords.push(ctr);
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 100, right: 30, bottom: SH_FULL + 20, left: 30 }, animated: true,
    });
  };

  const focusLot = useCallback((lot, idx) => {
    setSelectedId(lot.id);
    mapRef.current?.animateToRegion({
      latitude: lot.latitude, longitude: lot.longitude,
      latitudeDelta: 0.01, longitudeDelta: 0.01,
    }, 380);
    if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
    // Auto-expand sheet when user taps a marker
    if (!sheetOpen) {
      setSheetOpen(true);
      Animated.spring(sheetAnim, { toValue: SH_FULL, tension: 70, friction: 12, useNativeDriver: false }).start();
    }
  }, [sheetOpen]);

  const toggleSearch = () => {
    const next = !searchOpen;
    setSearchOpen(next);
    Animated.spring(searchAnim, { toValue: next ? 1 : 0, tension: 120, friction: 14, useNativeDriver: false }).start();
    if (!next) { setSearch(''); Keyboard.dismiss(); }
  };

  if (loading) {
    return (
      <View style={s.loadWrap}>
        <View style={s.loadIcon}><View style={s.loadRing} /><View style={s.loadDot} /></View>
        <Text style={s.loadTitle}>Finding Parking</Text>
        <Text style={s.loadSub}>Searching within {radius} km…</Text>
      </View>
    );
  }

  const searchH = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 50] });
  const sheetOpacity = sheetAnim.interpolate({
    inputRange: [SH_COLLAPSED, SH_FULL * 0.6], outputRange: [0, 1], extrapolate: 'clamp',
  });
  const chevronRotate = sheetAnim.interpolate({
    inputRange: [SH_COLLAPSED, SH_FULL], outputRange: ['180deg', '0deg'],
  });

  const openCount = filtered.filter(l => l.availableSlots > Math.ceil(l.totalSlots * 0.2)).length;
  const lowCount  = filtered.filter(l => l.availableSlots > 0 && l.availableSlots <= Math.ceil(l.totalSlots * 0.2)).length;
  const fullCount = filtered.filter(l => l.availableSlots <= 0).length;

  return (
    <View style={s.root}>
      {/* ── MAP ── */}
      <MapView
        ref={mapRef} style={s.map} initialRegion={DEFAULT_REGION}
        showsUserLocation showsMyLocationButton={false}
        showsCompass={false} toolbarEnabled={false}
        onLongPress={onMapLongPress}
      >
        <Circle center={center} radius={radius * 1000}
          strokeWidth={1.5} strokeColor="rgba(16,185,129,0.4)" fillColor="rgba(16,185,129,0.06)"
        />
        {tapPin && (
          <Marker coordinate={tapPin} anchor={{ x: 0.5, y: 1 }}>
            <View style={s.tapPin} collapsable={false}>
              <View style={s.tapPinDot} collapsable={false} />
              <View style={s.tapPinTail} collapsable={false} />
            </View>
          </Marker>
        )}
        {filtered.map((lot, i) => (
          <Marker key={lot.id}
            coordinate={{ latitude: lot.latitude, longitude: lot.longitude }}
            onPress={() => focusLot(lot, i)} tracksViewChanges={true}
            anchor={{ x: 0.5, y: 1 }}
          >
            <ParkingMarker availableSlots={lot.availableSlots} totalSlots={lot.totalSlots} />
          </Marker>
        ))}
      </MapView>

      {/* ── FLOATING STATUS BAR ── */}
      <View style={s.floatingBar}>
        {/* Status chips */}
        <View style={s.statusPill}>
          <StatusChip color={C.open}  count={openCount} label="Open" />
          <View style={s.chipSep} />
          <StatusChip color={C.low}   count={lowCount}  label="Low" />
          <View style={s.chipSep} />
          <StatusChip color={C.full}  count={fullCount}  label="Full" />
        </View>

        <View style={{ flex: 1 }} />

        {/* Action buttons */}
        <FloatBtn icon="⌕" onPress={toggleSearch} active={searchOpen} />
        <FloatBtn icon="⟳" onPress={() => loadData({ silent: true })} busy={searching} />
        <FloatBtn icon="📋" onPress={() => navigation.navigate('MyBookings')} />
        {tapPin && <FloatBtn icon="◎" onPress={resetToMyLocation} color={C.indigo} />}
      </View>

      {/* ── SEARCH ── */}
      <Animated.View style={[s.searchWrap, { height: searchH, opacity: searchAnim }]}>
        <View style={s.searchBar}>
          <Text style={s.searchIco}>⌕</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search parking by name or area…"
            placeholderTextColor={C.light}
            value={search} onChangeText={setSearch} autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.clearX}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* ── TAP BANNER ── */}
      {tapPin && !searchOpen && (
        <View style={s.tapBanner}>
          <View style={s.tapBannerDot} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.tapBannerTitle}>Exploring custom point</Text>
            <Text style={s.tapBannerSub}>{filtered.length} spots within {radius} km</Text>
          </View>
          <TouchableOpacity style={s.resetBtn} onPress={resetToMyLocation}>
            <Text style={s.resetBtnTxt}>My Location</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── BOTTOM SHEET ── */}
      <Animated.View style={[s.sheet, { height: sheetAnim }]}>
        <TouchableOpacity style={s.handleArea} onPress={toggleSheet} activeOpacity={0.8}>
          <View style={s.handle} />
          <View style={s.handleRow}>
            <View style={s.handleLeft}>
              <View style={s.handlePulse} />
              <Text style={s.handleTitle}>
                {sheetOpen ? 'Nearby Parking' : `${filtered.length} spots · ${radius} km`}
              </Text>
            </View>
            <Animated.Text style={[s.chevron, { transform: [{ rotate: chevronRotate }] }]}>⌄</Animated.Text>
          </View>
        </TouchableOpacity>

        <Animated.View style={[s.sheetBody, { opacity: sheetOpacity }]}>
          {/* Radius selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.radiusRow}>
            <Text style={s.radiusLbl}>Radius</Text>
            {RADIUS_OPTIONS.map(km => (
              <TouchableOpacity key={km}
                style={[s.rBtn, km === radius && s.rBtnOn]}
                onPress={() => onRadiusChange(km)} activeOpacity={0.75}
              >
                <Text style={[s.rBtnTxt, km === radius && s.rBtnTxtOn]}>{km}</Text>
                <Text style={[s.rBtnUnit, km === radius && s.rBtnTxtOn]}>km</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Cards */}
          <FlatList ref={listRef} data={filtered} keyExtractor={item => item.id}
            horizontal showsHorizontalScrollIndicator={false}
            snapToInterval={SNAP_INT} decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 2 }}
            getItemLayout={(_, i) => ({ length: SNAP_INT, offset: SNAP_INT * i, index: i })}
            onMomentumScrollEnd={e => {
              const i = Math.round(e.nativeEvent.contentOffset.x / SNAP_INT);
              if (filtered[i]) focusLot(filtered[i], -1);
            }}
            renderItem={({ item, index }) => (
              <ParkCard lot={item} selected={item.id === selectedId}
                onPress={() => { focusLot(item, index); navigation.navigate('ParkingDetail', { parking: item }); }}
                onBook={() => navigation.navigate('ParkingDetail', { parking: item })}
              />
            )}
            ListEmptyComponent={
              <View style={s.emptyBox}>
                <Text style={s.emptyIco}>P</Text>
                <Text style={s.emptyTxt}>No parking found</Text>
                <Text style={s.emptyHint}>Increase radius or long-press map</Text>
              </View>
            }
          />
          <Text style={s.hint}>Long-press anywhere on the map to explore that area</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/* ─── PARK CARD ─── */
function ParkCard({ lot, selected, onPress, onBook }) {
  const isFull = lot.availableSlots <= 0;
  const isLow  = !isFull && lot.availableSlots <= Math.ceil(lot.totalSlots * 0.2);
  const color  = isFull ? C.full : isLow ? C.low : C.open;
  const fill   = Math.min(100, Math.round(
    ((lot.totalSlots - lot.availableSlots) / Math.max(lot.totalSlots, 1)) * 100
  ));
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress}
      style={[s.card, { width: CARD_W }, selected && s.cardSel]}>

      {/* Header strip */}
      <View style={[s.cardHead, { backgroundColor: color }]}>
        <View style={s.cardHeadLeft}>
          <View style={s.cardDotWhite} />
          <Text style={s.cardStatus}>
            {isFull ? 'FULL' : isLow ? 'LOW AVAILABILITY' : 'OPEN'}
          </Text>
        </View>
        <Text style={s.cardDist}>{lot.distanceKm ?? '—'} km</Text>
      </View>

      <View style={s.cardBody}>
        <View style={s.cardTitleRow}>
          <Text style={s.cardName} numberOfLines={1}>{lot.name}</Text>
          <View style={s.cardPriceBadge}>
            <Text style={s.cardPriceTxt}>₹{lot.pricePerHour || 20}/hr</Text>
          </View>
        </View>
        <Text style={s.cardAddr} numberOfLines={1}>{lot.address}</Text>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statCol}>
            <Text style={[s.statNum, { color }]}>{lot.availableSlots}</Text>
            <Text style={s.statLabel}>FREE</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statCol}>
            <Text style={s.statNum}>{lot.totalSlots}</Text>
            <Text style={s.statLabel}>TOTAL</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statCol}>
            <Text style={s.statNum}>{fill}%</Text>
            <Text style={s.statLabel}>USED</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={s.barTrack}>
          <View style={[s.barFill, { width: `${fill}%`, backgroundColor: color }]} />
        </View>

        {/* Book CTA */}
        <TouchableOpacity
          style={[s.ctaBtn, { backgroundColor: isFull ? C.sec : color }]}
          onPress={onBook} activeOpacity={0.8}
        >
          <Text style={s.ctaTxt}>{isFull ? 'View Details' : 'Book Spot'}</Text>
          {!isFull && <Text style={s.ctaArrow}>→</Text>}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/* ─── SMALL COMPONENTS ─── */
function StatusChip({ color, count, label }) {
  return (
    <View style={s.chipWrap}>
      <View style={[s.chipDot, { backgroundColor: color }]} />
      <Text style={s.chipCount}>{count}</Text>
      <Text style={s.chipLabel}>{label}</Text>
    </View>
  );
}

function FloatBtn({ icon, onPress, active, busy, color }) {
  const bgColor = active ? C.primary : color ? color : 'rgba(255,255,255,0.97)';
  const txtColor = active || color ? '#fff' : C.primary;
  return (
    <TouchableOpacity style={[s.fBtn, { backgroundColor: bgColor }]} onPress={onPress} activeOpacity={0.7}>
      {busy ? <ActivityIndicator size="small" color={C.primary} /> :
        <Text style={[s.fBtnTxt, { color: txtColor }]}>{icon}</Text>}
    </TouchableOpacity>
  );
}

/* ─── STYLES ─── */
const s = StyleSheet.create({
  root: { flex: 1 },
  map:  { flex: 1 },

  /* Loading */
  loadWrap:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  loadIcon:  { width: 48, height: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  loadRing:  { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(16,185,129,0.3)' },
  loadDot:   { width: 16, height: 16, borderRadius: 8, backgroundColor: C.accent },
  loadTitle: { fontSize: 18, fontWeight: '700', color: C.primary },
  loadSub:   { marginTop: 4, fontSize: 13, color: C.muted },

  /* ── Floating status bar ── */
  floatingBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 10,
    left: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },

  /* Status pill — unified bar for all 3 statuses */
  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8,
    elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 5,
  },
  chipWrap:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipDot:   { width: 9, height: 9, borderRadius: 5 },
  chipCount: { fontSize: 14, fontWeight: '900', color: C.primary },
  chipLabel: { fontSize: 9, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  chipSep:   { width: 1, height: 18, backgroundColor: C.border, marginHorizontal: 8 },

  /* Float buttons */
  fBtn: {
    width: 42, height: 42, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 5,
  },
  fBtnTxt: { fontSize: 19 },

  /* Search */
  searchWrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 106 : 62,
    left: 10, right: 10, overflow: 'hidden',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 14, height: 48,
    elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 5,
  },
  searchIco:   { fontSize: 16, color: C.light, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: C.primary },
  clearX:      { fontSize: 14, color: C.muted, padding: 4 },

  /* Tap pin */
  tapPin:     { width: 26, height: 34, alignItems: 'center' },
  tapPinDot:  { width: 26, height: 26, borderRadius: 13, backgroundColor: C.indigo, borderWidth: 3, borderColor: '#fff' },
  tapPinTail: { width: 8, height: 8, borderRadius: 2, backgroundColor: C.indigo, transform: [{ rotate: '45deg' }], marginTop: -5 },

  /* Tap banner */
  tapBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 106 : 62,
    left: 10, right: 10,
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center',
    elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 5,
  },
  tapBannerDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: C.indigo },
  tapBannerTitle: { fontSize: 13, fontWeight: '700', color: C.primary },
  tapBannerSub:   { fontSize: 11, color: C.muted, marginTop: 1 },
  resetBtn:       { backgroundColor: C.indigo, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  resetBtnTxt:    { fontSize: 11, fontWeight: '700', color: '#fff' },

  /* ── Bottom sheet ── */
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    elevation: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.18, shadowRadius: 14,
    overflow: 'hidden',
  },
  handleArea: { paddingTop: 10, paddingBottom: 6, paddingHorizontal: 20, alignItems: 'center' },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 10 },
  handleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  handleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  handlePulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent },
  handleTitle: { fontSize: 14, fontWeight: '800', color: C.primary, letterSpacing: 0.2 },
  chevron:     { fontSize: 22, color: C.muted, lineHeight: 24 },

  sheetBody: { flex: 1 },

  /* Radius */
  radiusRow:  { paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  radiusLbl:  { fontSize: 11, fontWeight: '700', color: C.muted, marginRight: 4 },
  rBtn:       { flexDirection: 'row', alignItems: 'baseline', gap: 2, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  rBtnOn:     { backgroundColor: C.primary, borderColor: C.primary },
  rBtnTxt:    { fontSize: 14, fontWeight: '800', color: C.muted },
  rBtnUnit:   { fontSize: 9, fontWeight: '700', color: C.light },
  rBtnTxtOn:  { color: '#fff' },

  /* ── Card ── */
  card: {
    marginRight: CARD_GAP, backgroundColor: C.surface,
    borderRadius: 18, overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
  },
  cardSel: {
    borderColor: C.accent, borderWidth: 2,
    elevation: 6,
    shadowColor: C.accent, shadowOpacity: 0.15,
  },
  cardHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardDotWhite: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.7)' },
  cardStatus:   { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.8 },
  cardDist:     { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  cardBody:     { padding: 16 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  cardName:     { fontSize: 17, fontWeight: '800', color: C.primary, flex: 1, letterSpacing: 0.1 },
  cardPriceBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0', marginLeft: 8 },
  cardPriceTxt:   { fontSize: 12, fontWeight: '800', color: '#16a34a' },
  cardAddr:     { fontSize: 11, color: C.muted, marginBottom: 14 },

  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statCol:  { flex: 1, alignItems: 'center' },
  statNum:  { fontSize: 22, fontWeight: '900', color: C.primary, lineHeight: 26 },
  statLabel: { fontSize: 8, fontWeight: '700', color: C.light, letterSpacing: 1, marginTop: 2 },
  statDiv:  { width: 1, height: 28, backgroundColor: C.border },

  barTrack: { height: 4, borderRadius: 2, backgroundColor: C.bg, overflow: 'hidden', marginBottom: 14 },
  barFill:  { height: '100%', borderRadius: 2 },

  ctaBtn:   { borderRadius: 12, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  ctaTxt:   { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  ctaArrow: { color: '#fff', fontSize: 16, fontWeight: '700' },

  emptyBox:  { width: CARD_W, paddingVertical: 24, alignItems: 'center' },
  emptyIco:  { fontSize: 30, marginBottom: 10 },
  emptyTxt:  { fontSize: 15, fontWeight: '700', color: C.primary, marginBottom: 4 },
  emptyHint: { fontSize: 11, color: C.muted, textAlign: 'center' },
  hint:      { textAlign: 'center', fontSize: 10, color: C.light, paddingTop: 6, paddingBottom: 4 },
});
