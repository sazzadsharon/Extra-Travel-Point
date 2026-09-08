import { datesInRange } from './pricing';

export async function expireHotelBookingIfNeeded(tx: any, booking: any): Promise<boolean> {
  if (
    booking.category !== 'hotel' ||
    booking.status !== 'pending' ||
    booking.paymentStatus !== 'pending' ||
    !booking.expiresAt ||
    booking.expiresAt > new Date()
  ) return false;

  const expired = await tx.booking.updateMany({
    where: { id: booking.id, status: 'pending', paymentStatus: 'pending', expiresAt: { lte: new Date() } },
    data: { status: 'expired', cancelledAt: new Date(), rejectionReason: 'Payment window expired' }
  });
  if (expired.count !== 1) return false;

  if (booking.roomId && booking.travelDate && booking.returnDate) {
    for (const date of datesInRange(new Date(booking.travelDate), new Date(booking.returnDate))) {
      await tx.hotelAvailability.updateMany({
        where: { roomId: booking.roomId, date, bookedRooms: { gte: booking.numberOfRooms || 1 } },
        data: { bookedRooms: { decrement: booking.numberOfRooms || 1 } }
      });
    }
  }
  await tx.auditLog.create({
    data: {
      action: 'HOTEL_BOOKING_EXPIRED',
      actorId: booking.userId,
      details: `Hotel booking ${booking.bookingCode} expired`,
      metadata: JSON.stringify({ bookingId: booking.id, providerId: booking.providerId })
    }
  });
  return true;
}
