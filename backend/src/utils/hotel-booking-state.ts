export type HotelBookingStatus = 'pending' | 'confirmed' | 'paid' | 'completed' | 'cancelled' | 'expired';

const transitions: Record<HotelBookingStatus, HotelBookingStatus[]> = {
  pending: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['completed', 'cancelled'],
  paid: ['confirmed', 'cancelled'],
  completed: [],
  cancelled: [],
  expired: []
};

export function canTransitionHotelBooking(
  from: string,
  to: HotelBookingStatus
): boolean {
  return (transitions[from as HotelBookingStatus] ?? []).includes(to);
}
