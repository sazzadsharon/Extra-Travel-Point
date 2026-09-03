import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, Image, ScrollView
} from 'react-native';
import APIConfig from '../config/api';

interface TravelPass {
  bookingId: number;
  bookingCode: string;
  status: string;
  validFrom: string;
  validUntil: string;
  category: string;
  provider: { id: number; businessName: string };
  qrToken: string | null;
  qrCode: string | null;
}

interface Props {
  // navigation prop accepted from RN stack navigator
  navigation?: any;
  route?: any;
}

export default function TravelPassScreen({ route }: Props) {
  const initialCode: string = route?.params?.bookingCode || '';
  const [bookingCode, setBookingCode] = useState(initialCode);
  const [pass, setPass] = useState<TravelPass | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string>(''); // in real app: from context

  const loadPass = async () => {
    if (!bookingCode.trim()) {
      setError('Please enter a booking code');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // The mobile app must authenticate first; here we rely on the same
      // /api/v1/travel-passes/:bookingCode endpoint as the web app.
      const res = await fetch(`${APIConfig.API_BASE_URL}/travel-passes/${bookingCode}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load travel pass');
        setPass(null);
      } else {
        setPass(data);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) loadPass();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Travel Pass</Text>
        <Text style={styles.subtitle}>View your secure boarding pass</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Booking Code</Text>
          <TextInput
            style={styles.input}
            value={bookingCode}
            onChangeText={setBookingCode}
            placeholder="Enter booking code (e.g. a1b2c3...)"
            autoCapitalize="none"
          />
          <Text style={styles.label}>Auth Token (paste from login)</Text>
          <TextInput
            style={styles.input}
            value={authToken}
            onChangeText={setAuthToken}
            placeholder="JWT token"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.btn} onPress={loadPass} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Load Pass</Text>}
          </TouchableOpacity>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {pass && (
          <View style={styles.passCard}>
            <Text style={styles.passHeader}>Extra Travel Point · Travel Pass</Text>
            <Text style={styles.passCode}>{pass.bookingCode}</Text>
            <Text style={styles.passStatus}>{pass.status.toUpperCase()}</Text>

            {pass.qrCode ? (
              <Image source={{ uri: pass.qrCode }} style={styles.qrImage} resizeMode="contain" />
            ) : (
              <Text style={styles.error}>No QR generated for this booking yet.</Text>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Category</Text>
              <Text style={styles.detailValue}>{pass.category}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Provider</Text>
              <Text style={styles.detailValue}>{pass.provider.businessName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Valid From</Text>
              <Text style={styles.detailValue}>{pass.validFrom}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Valid Until</Text>
              <Text style={styles.detailValue}>{pass.validUntil}</Text>
            </View>
            <Text style={styles.note}>
              Show this QR at the boarding counter. The backend is always the source of truth.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  scroll: { padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 16 },
  section: { marginBottom: 16 },
  label: { fontSize: 13, color: '#444', marginBottom: 4, marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 8 },
  btn: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold' },
  error: { color: '#c0392b', marginTop: 8 },
  passCard: { backgroundColor: '#f5f5f5', padding: 16, borderRadius: 12, alignItems: 'center' },
  passHeader: { fontWeight: 'bold', fontSize: 14, color: '#007AFF' },
  passCode: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  passStatus: { marginTop: 4, color: '#34C759', fontWeight: 'bold' },
  qrImage: { width: 220, height: 220, marginVertical: 16, backgroundColor: '#fff' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 4 },
  detailLabel: { color: '#666' },
  detailValue: { fontWeight: '600' },
  note: { marginTop: 12, fontSize: 11, color: '#888', textAlign: 'center' }
});