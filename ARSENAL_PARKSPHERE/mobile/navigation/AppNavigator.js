import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen               from '../screens/HomeScreen';
import ParkingDetailScreen      from '../screens/ParkingDetailScreen';
import BookingConfirmationScreen from '../screens/BookingConfirmationScreen';
import MyBookingsScreen          from '../screens/MyBookingsScreen';
import NavigationScreen          from '../screens/NavigationScreen';

const Stack = createNativeStackNavigator();

/* ─── Custom header title for Home ─── */
function BrandTitle() {
  return (
    <View style={hdr.row}>
      {/* Animated-looking icon: layered circles */}
      <View style={hdr.iconWrap}>
        <View style={hdr.iconRing} />
        <View style={hdr.iconCore} />
      </View>
      <View>
        <Text style={hdr.brandName}>
          PARK<Text style={hdr.brandAccent}>SPHERE</Text>
        </Text>
        <Text style={hdr.brandSub}>Smart Parking</Text>
      </View>
    </View>
  );
}

const hdr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 30, height: 30,
    justifyContent: 'center', alignItems: 'center',
  },
  iconRing: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: 'rgba(16,185,129,0.35)',
  },
  iconCore: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#10B981',
  },
  brandName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2.5,
  },
  brandAccent: {
    color: '#10B981',
    fontWeight: '800',
  },
  brandSub: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 1.5,
    marginTop: -1,
  },
});

/* ─── Sub-page header title (cleaner) ─── */
function SubTitle({ title }) {
  return <Text style={sub.title}>{title}</Text>;
}
const sub = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
});

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#060B18" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#060B18',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '600', fontSize: 16 },
          headerShadowVisible: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: '#F8FAFC' },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            headerTitle: () => <BrandTitle />,
            headerTitleAlign: 'center',
            headerStyle: {
              backgroundColor: '#060B18',
              height: Platform.OS === 'android' ? 70 : undefined,
            },
          }}
        />
        <Stack.Screen
          name="ParkingDetail"
          component={ParkingDetailScreen}
          options={{
            headerTitle: () => <SubTitle title="Parking Details" />,
            headerStyle: { backgroundColor: '#060B18' },
          }}
        />
        <Stack.Screen
          name="BookingConfirmation"
          component={BookingConfirmationScreen}
          options={{
            headerTitle: () => <SubTitle title="Booking Confirmed" />,
            headerBackVisible: false,
            headerStyle: { backgroundColor: '#060B18' },
          }}
        />
        <Stack.Screen
          name="Navigation"
          component={NavigationScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyBookings"
          component={MyBookingsScreen}
          options={{
            headerTitle: () => <SubTitle title="My Bookings" />,
            headerStyle: { backgroundColor: '#060B18' },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
