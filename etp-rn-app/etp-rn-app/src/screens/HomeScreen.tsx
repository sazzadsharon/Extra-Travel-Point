import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import SeatSelectionModal from '../components/SeatSelectionModal';
import BookingConfirmation from '../screens/BookingConfirmation';

interface Trip {
  id: string;
  operator: string;
  departure: string;
  arrival: string;
  fare: number;
  duration: string;
  availableSeats: number;
}

export default function HomeScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [from, setFrom] = useState('Dhaka');
  const [to, setTo] = useState('Kuakata');
  const [date, setDate] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  const searchTrips = () => {
    const mockTrip: Trip = {
      id: '1',
      operator: 'Sakura Paribahan',
      departure: '07:00 AM',
      arrival: '11:30 AM',
      fare: 1200,
      duration: '4h 30m',
      availableSeats: 24,
    };
    setTrips([mockTrip]);
  };

  const handleBooking = (trip: Trip) => {
    setSelectedTrip(trip);
    setShowSeatModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>এক্সট্রাভেল পয়েন্ট</Text>
      <View style={styles.searchBox}>
        <TextInput style={styles.input} placeholder="From" value={from} onChangeText={setFrom} />
        <TextInput style={styles.input} placeholder="To" value={to} onChangeText={setTo} />
        <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
        <TextInput style={styles.input} placeholder="Passengers" value={String(passengers)} onChangeText={(e) => setPassengers(Number(e.nativeEvent.text))} keyboardType="numeric" />
        <TouchableOpacity style={styles.searchBtn} onPress={searchTrips}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.tripCard}>
            <Text style={styles.tripOperator}>{item.operator}</Text>
            <Text>Departure: {item.departure}</Text>
            <Text>Arrival: {item.arrival}</Text>
            <Text>Fare: ৳{item.fare}</Text>
            <Text>Duration: {item.duration}</Text>
            <Text>Available Seats: {item.availableSeats}</Text>
            <TouchableOpacity style={styles.bookBtn} onPress={() => handleBooking(item)}>
              <Text style={styles.bookBtnText}>Book Now</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.noTrips}>No trips found. Try searching.</Text>}
      />

      {showSeatModal && selectedTrip && (
        <SeatSelectionModal
          visible={showSeatModal}
          onClose={() => setShowSeatModal(false)}
          trip={selectedTrip}
          onConfirm={(seats) => {
            setShowSeatModal(false);
            // Navigate to BookingConfirmation or trigger payment
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FFF' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 16, textAlign: 'center' },
  searchBox: { marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 8 },
  searchBtn: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center' },
  searchBtnText: { color: '#FFF', fontWeight: 'bold' },
  tripCard: { backgroundColor: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 12 },
  tripOperator: { fontSize: 18, fontWeight: 'bold' },
  bookBtn: { backgroundColor: '#34C759', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 8 },
  bookBtnText: { color: '#FFF', fontWeight: 'bold' },
  noTrips: { textAlign: 'center', marginTop: 32, color: '#888' },
});

export type { Trip };