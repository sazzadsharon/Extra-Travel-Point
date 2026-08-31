const BASE = 'http://localhost:5000/api/v1';
const results = [];
function check(name, cond, extra) {
  results.push({ name, ok: !!cond, extra: extra || '' });
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${extra ? ' :: ' + extra : ''}`);
}

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

(async () => {
  const ts = Date.now();
  const vPhone = '015' + String(ts).slice(-8);
  const vPass = 'vendor123';

  // 1. Register vendor -> PENDING
  let r = await call('POST', '/vendors/register', {
    phone: vPhone, password: vPass, fullName: 'Smoke Vendor', email: 'smoke@example.com',
    businessName: 'Smoke Bus Co', category: 'bus', ownerName: 'Smoke Owner',
    address: 'Dhaka', city: 'Dhaka', description: 'test'
  });
  check('Vendor registers (PENDING)', r.status === 201 && r.data?.provider?.status === 'PENDING_VERIFICATION', `status=${r.status}`);
  const vToken = r.data?.tokens?.accessToken;

  // 2. Admin login
  r = await call('POST', '/auth/login', { phone: '01712345678', password: 'admin123' });
  check('Admin login', r.status === 200 && r.data?.user?.role === 'admin', `status=${r.status}`);
  const aToken = r.data?.tokens?.accessToken;

  // 3. Unapproved vendor cannot publish service
  r = await call('POST', '/vendors/services', { providerId: 2, name: 'X', category: 'bus', price: 1000 }, vToken);
  check('Unapproved vendor blocked from publishing', r.status === 403, `status=${r.status}`);

  // 4. Admin lists vendors, finds new one, approves
  r = await call('GET', '/admin/vendors', null, aToken);
  const newV = r.data?.providers?.find(p => p.businessName === 'Smoke Bus Co');
  check('Admin sees new vendor', !!newV, `found=${!!newV}`);
  r = await call('PATCH', `/admin/vendors/${newV.id}/approve`, {}, aToken);
  check('Admin approves vendor', r.status === 200 && r.data?.provider?.status === 'APPROVED', `status=${r.data?.provider?.status}`);

  // 5. Vendor creates service (approved)
  const me = await call('GET', '/vendors/me', null, vToken);
  const pid = me.data?.id;
  r = await call('POST', '/vendors/services', { providerId: pid, name: 'Dhaka->CBus', category: 'bus', price: 1200, route: 'Dhaka -> Cox', capacity: 40 });
  check('Approved vendor creates service', r.status === 201, `status=${r.status}`);
  const serviceId = r.data?.service?.id;
  const unitPrice = r.data?.service?.price;

  // 6. Vendor cannot create service for another provider
  r = await call('POST', '/vendors/services', { providerId: 99999, name: 'Y', category: 'bus', price: 1 }, vToken);
  check('Vendor cannot create service for others provider', r.status === 403, `status=${r.status}`);

  // 7. Customer login
  r = await call('POST', '/auth/login', { phone: '01812345678', password: 'customer123' });
  const cToken = r.data?.tokens?.accessToken;

  // 8. Customer booking with serviceId -> authoritative price = 2 seats * 1200
  r = await call('POST', '/bookings', {
    providerId: pid, category: 'bus', bookingDate: '2026-09-01', travelDate: '2026-09-10',
    numberOfPeople: 2, seatNumbers: ['A1', 'A2'], passengers: [
      { name: 'Cust One', email: 'c1@x.com', phone: '01811111111', seatNumber: 'A1' },
      { name: 'Cust Two', email: 'c2@x.com', phone: '01822222222', seatNumber: 'A2' }
    ], serviceId, totalAmount: 999999
  }, cToken);
  check('Customer booking created', r.status === 201, `status=${r.status}`);
  const booking = r.data?.booking;
  check('Backend authoritative price (2*1200=2400, ignores client 999999)', booking?.finalAmount === 2400, `finalAmount=${booking?.finalAmount}`);
  check('Booking stores serviceId', booking?.serviceId === serviceId, `serviceId=${booking?.serviceId}`);
  const bookingId = booking?.id;

  // 9. Vendor sees own booking
  r = await call('GET', '/vendors/bookings', null, vToken);
  check('Vendor sees own booking', Array.isArray(r.data) && r.data.some(b => b.id === bookingId), `count=${r.data?.length}`);

  // 10. Vendor accepts booking
  r = await call('PATCH', `/vendors/bookings/${bookingId}`, { status: 'confirmed' }, vToken);
  check('Vendor accepts booking', r.status === 200 && r.data?.booking?.status === 'confirmed', `status=${r.data?.booking?.status}`);

  // 11. Vendor cannot accept another vendor's booking (use demo vendor)
  const dv = await call('POST', '/auth/login', { phone: '01912345678', password: 'vendor123' });
  const dvToken = dv.data?.tokens?.accessToken;
  r = await call('PATCH', `/vendors/bookings/${bookingId}`, { status: 'cancelled' }, dvToken);
  check('Other vendor blocked from managing booking', r.status === 404, `status=${r.status}`);

  // 12. Customer still sees own booking/ticket
  r = await call('GET', `/bookings/${bookingId}`, null, cToken);
  check('Customer can fetch own booking', r.status === 200 && r.data?.id === bookingId, `status=${r.status}`);

  const failed = results.filter(x => !x.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('SMOKE ERROR', e); process.exit(2); });
