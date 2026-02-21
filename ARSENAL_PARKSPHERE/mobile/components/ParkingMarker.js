import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * DEFINITIVE FIX for react-native-maps Android custom markers:
 * → collapsable={false} prevents React Native from optimizing away the view
 * → No elevation/shadow (breaks Android marker rendering)
 * → No borderWidth on outer container (can cause invisible views)
 * → Explicit width/height on every View
 */
export default function ParkingMarker({ availableSlots, totalSlots }) {
  const isFull = availableSlots <= 0;
  const isLow  = !isFull && availableSlots <= Math.ceil(totalSlots * 0.2);

  const bg    = isFull ? '#EF4444' : isLow ? '#F59E0B' : '#16A34A';
  const label = isFull ? 'FULL' : String(availableSlots);
  const status = isFull ? 'Full' : isLow ? 'Low' : 'Open';

  return (
    // collapsable={false} is the KEY fix for Android
    <View style={s.root} collapsable={false}>
      <View style={[s.bubble, { backgroundColor: bg }]} collapsable={false}>
        {/* P icon */}
        <View style={s.pWrap} collapsable={false}>
          <Text style={s.pText}>P</Text>
        </View>
        {/* Separator */}
        <View style={s.sep} collapsable={false} />
        {/* Slot count */}
        <View style={s.countWrap} collapsable={false}>
          <Text style={s.countNum}>{label}</Text>
          <Text style={s.countLbl}>{status}</Text>
        </View>
      </View>
      {/* Pin tip — solid rotated square, no CSS border trick */}
      <View style={[s.tip, { backgroundColor: bg }]} collapsable={false} />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    width: 80,
    height: 56,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  bubble: {
    width: 78,
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  pWrap: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 16,
    includeFontPadding: false,
  },
  sep: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginHorizontal: 7,
  },
  countWrap: {
    alignItems: 'center',
  },
  countNum: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 15,
    includeFontPadding: false,
  },
  countLbl: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 10,
    includeFontPadding: false,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tip: {
    width: 12,
    height: 12,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
    marginTop: -8,
  },
});
