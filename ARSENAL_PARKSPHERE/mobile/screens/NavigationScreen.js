import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

// Decode Google-format encoded polyline (used by OSRM)
function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0; result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

// Turn type → emoji icon
function getStepIcon(type, modifier) {
  if (type === 'depart') return '→';
  if (type === 'arrive') return '●';
  if (type === 'turn' || type === 'end of road' || type === 'fork') {
    if (modifier?.includes('left')) return '⬅️';
    if (modifier?.includes('right')) return '➡️';
    if (modifier?.includes('straight')) return '⬆️';
    return '↗️';
  }
  if (type === 'roundabout' || type === 'rotary') return '↻';
  if (type === 'merge') return '⇢';
  if (type === 'new name' || type === 'continue') return '⬆️';
  return '⬆️';
}

export default function NavigationScreen({ route, navigation }) {
  const { parking } = route.params;
  const [userLocation, setUserLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [steps, setSteps] = useState([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [followUser, setFollowUser] = useState(true);
  const mapRef = useRef(null);
  const locationSub = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const destination = {
    latitude: parking.latitude,
    longitude: parking.longitude,
  };

  useEffect(() => {
    startNavigation();
    startPulse();
    return () => {
      if (locationSub.current) {
        locationSub.current.remove();
      }
    };
  }, []);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  };

  const startNavigation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoadingRoute(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const origin = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setUserLocation(origin);

      // Fetch real road route from OSRM
      await fetchRoute(origin, destination);

      // Start live tracking
      locationSub.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 5,
        },
        (location) => {
          const newCoord = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setUserLocation(newCoord);

          // Update current step based on proximity
          updateCurrentStep(newCoord);

          // Check arrival
          const dist = getDistanceMeters(newCoord, destination);
          if (dist < 30) setArrived(true);

          // Follow user on map
          if (followUser && mapRef.current) {
            mapRef.current.animateCamera({
              center: newCoord,
              pitch: 45,
              heading: location.coords.heading || 0,
              zoom: 17,
            }, { duration: 1000 });
          }
        }
      );
    } catch (err) {
      console.log('Navigation error:', err.message);
      setLoadingRoute(false);
    }
  };

  const fetchRoute = async (origin, dest) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${dest.longitude},${dest.latitude}?overview=full&geometries=polyline&steps=true`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];

        // Decode the full route geometry
        const coords = decodePolyline(route.geometry);
        setRouteCoords(coords);

        // Extract turn-by-turn steps
        const legs = route.legs[0];
        const navSteps = legs.steps.map((step, idx) => ({
          id: idx,
          instruction: step.maneuver.type,
          modifier: step.maneuver.modifier || '',
          name: step.name || 'unnamed road',
          distance: step.distance,
          duration: step.duration,
          icon: getStepIcon(step.maneuver.type, step.maneuver.modifier),
          location: {
            latitude: step.maneuver.location[1],
            longitude: step.maneuver.location[0],
          },
        }));
        setSteps(navSteps);

        // Set totals
        setTotalDistance(route.distance);
        setTotalDuration(route.duration);

        // Fit map to route
        if (mapRef.current && coords.length > 0) {
          setTimeout(() => {
            mapRef.current.fitToCoordinates(coords, {
              edgePadding: { top: 120, right: 60, bottom: 260, left: 60 },
              animated: true,
            });
          }, 500);
        }
      }
    } catch (err) {
      console.log('OSRM route error:', err.message);
    } finally {
      setLoadingRoute(false);
    }
  };

  const updateCurrentStep = (userCoord) => {
    if (steps.length === 0) return;

    // Find closest upcoming step
    let closestIdx = currentStepIdx;
    let minDist = Infinity;

    for (let i = currentStepIdx; i < Math.min(currentStepIdx + 3, steps.length); i++) {
      const d = getDistanceMeters(userCoord, steps[i].location);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }

    // Advance step if within 30m of next step
    if (closestIdx > currentStepIdx && minDist < 30) {
      setCurrentStepIdx(closestIdx);
    } else if (currentStepIdx + 1 < steps.length) {
      const nextDist = getDistanceMeters(userCoord, steps[currentStepIdx + 1].location);
      if (nextDist < 40) {
        setCurrentStepIdx(currentStepIdx + 1);
      }
    }
  };

  // Haversine distance in meters
  const getDistanceMeters = (a, b) => {
    const R = 6371000;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const c = sinLat * sinLat +
      Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      sinLng * sinLng;
    return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
  };

  const formatDistance = (meters) => {
    if (!meters && meters !== 0) return '...';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '...';
    const mins = Math.round(seconds / 60);
    if (mins < 1) return '< 1 min';
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const getRemainingDistance = () => {
    if (!userLocation) return totalDistance;
    const dist = getDistanceMeters(userLocation, destination);
    return dist;
  };

  const getRemainingDuration = () => {
    const remaining = getRemainingDistance();
    // Approximate: same avg speed as route
    if (totalDistance > 0) {
      return (remaining / totalDistance) * totalDuration;
    }
    return (remaining / 1000 / 30) * 3600; // 30 km/h fallback
  };

  const getStepInstruction = (step) => {
    if (!step) return '';
    const type = step.instruction;
    const mod = step.modifier;
    const name = step.name !== 'unnamed road' ? step.name : '';

    if (type === 'depart') return `Head out${name ? ` on ${name}` : ''}`;
    if (type === 'arrive') return 'You have arrived!';
    if (type === 'turn') return `Turn ${mod}${name ? ` onto ${name}` : ''}`;
    if (type === 'continue') return `Continue${name ? ` on ${name}` : ' straight'}`;
    if (type === 'new name') return `Continue onto ${name || 'road'}`;
    if (type === 'roundabout' || type === 'rotary') return `Take the roundabout${name ? ` to ${name}` : ''}`;
    if (type === 'merge') return `Merge${name ? ` onto ${name}` : ''}`;
    if (type === 'fork') return `Take the ${mod || ''} fork${name ? ` onto ${name}` : ''}`;
    if (type === 'end of road') return `Turn ${mod || ''}${name ? ` onto ${name}` : ''}`;
    return `Continue${name ? ` on ${name}` : ''}`;
  };

  const recenterMap = () => {
    setFollowUser(true);
    if (userLocation && mapRef.current) {
      mapRef.current.animateCamera({
        center: userLocation,
        pitch: 45,
        zoom: 17,
      }, { duration: 500 });
    }
  };

  const overviewMap = () => {
    setFollowUser(false);
    if (mapRef.current && routeCoords.length > 0) {
      mapRef.current.fitToCoordinates(routeCoords, {
        edgePadding: { top: 120, right: 60, bottom: 260, left: 60 },
        animated: true,
      });
    }
  };

  const openExternalMaps = () => {
    const lat = parking.latitude;
    const lng = parking.longitude;
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    });
  };

  const currentStep = steps[currentStepIdx] || null;
  const nextStep = steps[currentStepIdx + 1] || null;

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: destination.latitude,
          longitude: destination.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        showsTraffic
        onPanDrag={() => setFollowUser(false)}
      >
        {/* Real road route */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#3b82f6"
            strokeWidth={5}
            lineJoin="round"
            lineCap="round"
          />
        )}

        {/* Destination marker */}
        <Marker coordinate={destination}>
          <View style={styles.destMarker}>
            <Text style={styles.destMarkerText}>P</Text>
          </View>
        </Marker>
      </MapView>

      {/* Loading overlay */}
      {loadingRoute && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Calculating route...</Text>
          </View>
        </View>
      )}

      {/* Turn-by-turn instruction card */}
      {currentStep && !arrived && (
        <View style={styles.instructionCard}>
          <View style={styles.instructionRow}>
            <View style={styles.instructionIconBox}>
              <Text style={styles.instructionIcon}>{currentStep.icon}</Text>
            </View>
            <View style={styles.instructionDetails}>
              <Text style={styles.instructionText} numberOfLines={2}>
                {getStepInstruction(currentStep)}
              </Text>
              {currentStep.distance > 0 && (
                <Text style={styles.instructionDist}>
                  {formatDistance(currentStep.distance)}
                </Text>
              )}
            </View>
          </View>
          {nextStep && (
            <View style={styles.nextStepRow}>
              <Text style={styles.nextLabel}>Next: </Text>
              <Text style={styles.nextIcon}>{nextStep.icon}</Text>
              <Text style={styles.nextText} numberOfLines={1}>
                {getStepInstruction(nextStep)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Arrived overlay */}
      {arrived && (
        <View style={styles.arrivedCard}>
          <Text style={styles.arrivedEmoji}>✓</Text>
          <Text style={styles.arrivedTitle}>You've arrived!</Text>
          <Text style={styles.arrivedSubtitle}>{parking.name || parking.parkingName}</Text>
        </View>
      )}

      {/* Map control buttons */}
      <View style={styles.mapControls}>
        <TouchableOpacity style={styles.controlBtn} onPress={recenterMap}>
          <Text style={styles.controlIcon}>◎</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={overviewMap}>
          <Text style={styles.controlIcon}>⊞</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Animated.Text style={[styles.statNumber, styles.statDistance, { transform: [{ scale: pulseAnim }] }]}>
              {formatDistance(getRemainingDistance())}
            </Animated.Text>
            <Text style={styles.statLabel}>Remaining</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>
              {formatDuration(getRemainingDuration())}
            </Text>
            <Text style={styles.statLabel}>ETA</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: '#22c55e' }]}>
              {parking.availableSlots != null ? parking.availableSlots : '—'}
            </Text>
            <Text style={styles.statLabel}>Slots</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.gmapsBtn} onPress={openExternalMaps}>
            <Text style={styles.gmapsBtnText}>Open in Google Maps</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.endBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.endBtnText}>End</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>←</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 20,
    alignItems: 'center',
    elevation: 6,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },

  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },

  instructionCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 16,
    left: 64,
    right: 16,
    backgroundColor: '#1f2937',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  instructionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instructionIcon: {
    fontSize: 22,
  },
  instructionDetails: { flex: 1 },
  instructionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 19,
  },
  instructionDist: {
    fontSize: 12,
    color: '#93c5fd',
    fontWeight: '600',
    marginTop: 3,
  },
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  nextLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  nextIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  nextText: {
    fontSize: 11,
    color: '#d1d5db',
    flex: 1,
    fontWeight: '500',
  },

  arrivedCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 26,
    alignSelf: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  arrivedEmoji: { fontSize: 28, marginBottom: 4 },
  arrivedTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  arrivedSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },

  mapControls: {
    position: 'absolute',
    right: 16,
    bottom: 220,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  controlIcon: {
    fontSize: 20,
    color: '#3b82f6',
    fontWeight: '700',
  },

  destMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    elevation: 6,
  },
  destMarkerText: {
    fontSize: 24,
  },

  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2937',
  },
  statDistance: {
    color: '#3b82f6',
  },
  statLabel: {
    fontSize: 9,
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 3,
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#f3f4f6',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gmapsBtn: {
    flex: 2,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  gmapsBtnText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
  endBtn: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  endBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
