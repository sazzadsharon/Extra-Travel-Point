import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';

interface Trip {
  id: string;
  operator: string;
  departure: string;
  arrival: string;
  fare: number;
}

interface SeatSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  trip: Trip;
  onConfirm: (seats: string[]) => void;
}

export default function SeatSelectionModal({ visible, onClose, trip, onConfirm }: SeatSelectionModalProps) {
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const rows = ['A', 'B', 'C', 'D'];
  const cols = [1, 2, 3, 4];

  const toggleSeat = (seat: string) => {
    if (selectedSeats.includes(seat)) {
      setSelectedSeats(selectedSeats.filter((s) => s !== seat));
    } else {
      setSelectedSeats([...selectedSeats, seat]);
    }
  };

  const totalFare = selectedSeats.length * trip.fare;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Select Seats - {trip.operator}</Text>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ccc' }]} />
              <Text>Available</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#007AFF' }]} />
              <Text>Selected</Text>
            </View>
          </View>

          <View style={styles.seatGrid}>
            {rows.map((row) => (
              <View key={row} style={styles.seatRow}>
                {cols.map((col) => {
                  const seat = `${row}${col}`;
                  const isSelected = selectedSeats.includes(seat);
                  return (
                    <TouchableOpacity
                      key={seat}
                      style={[styles.seat, isSelected && styles.seatSelected]}
                      onPress={() => toggleSeat(seat)}
                    >
                      <Text style={styles.seatText}>{seat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <Text style={styles.total}>Total: ৳{totalFare}</Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, selectedSeats.length === 0 && styles.confirmBtnDisabled]}
                onPress={() => onConfirm(selectedSeats)}
                disabled={selectedSeats.length === 0}
              >
                <Text style={styles.confirmBtnText}>Confirm ({selectedSeats.length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#FFF', margin: 16, padding: 16, borderRadius: 12 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12 },
  legendDot: { width: 16, height: 16, borderRadius: 4, marginRight: 6 },
  seatGrid: { alignItems: 'center', marginBottom: 16 },
  seatRow: { flexDirection: 'row', marginBottom: 8 },
  seat: { width: 48, height: 48, backgroundColor: '#ccc', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4 },
  seatSelected: { backgroundColor: '#007AFF' },
  seatText: { color: '#FFF', fontWeight: 'bold' },
  footer: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 16 },
  total: { fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  closeBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', marginRight: 8, alignItems: 'center' },
  closeBtnText: { fontWeight: 'bold' },
  confirmBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#34C759', marginLeft: 8, alignItems: 'center' },
  confirmBtnDisabled: { backgroundColor: '#ccc' },
  confirmBtnText: { color: '#FFF', fontWeight: 'bold' },
});
