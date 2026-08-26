import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';

interface BookingData {
  tripId: string;
  passengerName: string;
  phone: string;
  seats: string[];
  totalFare: number;
  departure: string;
  arrival: string;
  date: string;
}

export default function BookingConfirmation({ route, navigation }: any) {
  const [bookingData, setBookingData] = useState<BookingData>({
    tripId: `BKG-${Date.now()}`,
    passengerName: '',
    phone: '',
    seats: route?.params?.seats || [],
    totalFare: route?.params?.fare || 1200,
    departure: route?.params?.departure || '07:00 AM',
    arrival: route?.params?.arrival || '11:30 AM',
    date: route?.params?.date || new Date().toISOString().split('T')[0],
  });

  const handlePayment = async (method: string) => {
    try {
      const response = await fetch('http://localhost:5000/api/v1/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: 1,
          method,
          amount: bookingData.totalFare,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Payment Initiated', `Transaction ID: ${data.transactionId}\nPay using ${method}`);
      } else {
        Alert.alert('Error', data.error || 'Payment initiation failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  const qrPayload = JSON.stringify({
    booking_id: bookingData.tripId,
    passenger: bookingData.passengerName,
    seats: bookingData.seats,
    fare: bookingData.totalFare,
    date: bookingData.date,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Confirm Booking</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Passenger Information</Text>
        <TextInput style={styles.input} placeholder="Full Name" value={bookingData.passengerName} onChangeText={(e) => setBookingData({ ...bookingData, passengerName: e })} />
        <TextInput style={styles.input} placeholder="Phone Number" keyboardType="phone-pad" value={bookingData.phone} onChangeText={(e) => setBookingData({ ...bookingData, phone: e })} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trip Details</Text>
        <Text>Trip ID: {bookingData.tripId}</Text>
        <Text>Date: {bookingData.date}</Text>
        <Text>Departure: {bookingData.departure}</Text>
        <Text>Arrival: {bookingData.arrival}</Text>
        <Text>Seats: {bookingData.seats.join(', ')}</Text>
        <Text style={styles.fare}>Total Fare: ৳{bookingData.totalFare}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <TouchableOpacity style={styles.paymentBtn} onPress={() => handlePayment('bkash')}>
          <Text style={styles.paymentBtnText}>bKash</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.paymentBtn} onPress={() => handlePayment('nagad')}>
          <Text style={styles.paymentBtnText}>Nagad</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.paymentBtn} onPress={() => handlePayment('card')}>
          <Text style={styles.paymentBtnText}>Card / SSLCommerz</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FFF' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  section: { marginBottom: 20, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 8 },
  fare: { fontSize: 20, fontWeight: 'bold', color: '#34C759', marginTop: 8 },
  paymentBtn: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, marginBottom: 8, alignItems: 'center' },
  paymentBtnText: { color: '#FFF', fontWeight: 'bold' },
});
