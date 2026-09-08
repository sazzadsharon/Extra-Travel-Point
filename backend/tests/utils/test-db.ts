import { prisma } from '../../src/prisma';
import { resetMockGatewayStore } from '../../src/utils/payment-gateways';

export async function cleanup() {
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.payoutRequest.deleteMany();
  await prisma.qrLog.deleteMany();
  await prisma.review.deleteMany();
  await prisma.seatLock.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.hotelAvailability.deleteMany();
  await prisma.ratePlan.deleteMany();
  await prisma.hotelImage.deleteMany();
  await prisma.hotelAmenity.deleteMany();
  await prisma.hotelPolicy.deleteMany();
  await prisma.hotelPromotion.deleteMany();
  await prisma.housekeepingTask.deleteMany();
  await prisma.hotelMaintenanceRequest.deleteMany();
  await prisma.hotelTax.deleteMany();
  await prisma.hotelStaff.deleteMany();
  await prisma.serviceAvailability.deleteMany();
  await prisma.service.deleteMany();
  await prisma.flight.deleteMany();
  await prisma.busTrip.deleteMany();
  await prisma.busRoute.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.room.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
  resetMockGatewayStore();
}
