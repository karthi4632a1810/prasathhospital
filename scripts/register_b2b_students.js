'use strict';

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const crypto = require('crypto');
const mongoose = require('mongoose');

const uri =
  process.env.MONGODB_URI ||
  'mongodb+srv://jiokarthikeyan18_db_user:Oe8OhnOrD164A0dJ@prashantdb.ma6fim0.mongodb.net/prashanth_events?retryWrites=true&w=majority';

const attendeesToRegister = [
  {
    name: 'Dr. Sowbarnika',
    title: 'Dr',
    firstName: 'Sowbarnika',
    lastName: '',
    gender: 'Female',
    email: 'sowbee01@gmail.com',
    phone: '8939682144',
    area: 'Kelambakkam',
  },
  {
    name: 'Ms Abinaya M. R',
    title: 'Ms',
    firstName: 'Abinaya',
    lastName: 'M. R',
    gender: 'Female',
    email: 'mrabimani1372@gmail.com',
    phone: '9629984019',
    area: 'Egattur',
  },
  {
    name: 'Ms. Akshaya Priya S',
    title: 'Ms',
    firstName: 'Akshaya Priya',
    lastName: 'S',
    gender: 'Female',
    email: 'priyashyamsundar1@gmail.com',
    phone: '9840555489',
    area: 'Kelambakkam',
  },
  {
    name: 'Ms Anulakshmi Ravi',
    title: 'Ms',
    firstName: 'Anulakshmi',
    lastName: 'Ravi',
    gender: 'Female',
    email: 'anulakshmiravi369@gmail.com',
    phone: '9567692915',
    area: 'Kelambakkam',
  },
  {
    name: 'Ms Samyuktha G',
    title: 'Ms',
    firstName: 'Samyuktha',
    lastName: 'G',
    gender: 'Female',
    email: 'samyuktha.020904@gmail.com',
    phone: '7358184369',
    area: 'Kelambakkam',
  },
  {
    name: 'Ms M.Shakthii Bagavathy',
    title: 'Ms',
    firstName: 'M.Shakthii',
    lastName: 'Bagavathy',
    gender: 'Female',
    email: 'shakthiimagalanathan@gmail.com',
    phone: '7708274505',
    area: 'Kelambakkam',
  },
  {
    name: 'Ms. Ajeesha S Reji',
    title: 'Ms',
    firstName: 'Ajeesha',
    lastName: 'S Reji',
    gender: 'Female',
    email: 'ajeeshareji112233@gmail.com',
    phone: '6282178832',
    area: 'Kelambakkam',
  },
  {
    name: 'Ms Lisha Sharma',
    title: 'Ms',
    firstName: 'Lisha',
    lastName: 'Sharma',
    gender: 'Female',
    email: 'lishasharma1103@gmail.com',
    phone: '7995741103',
    area: 'Urappakkam',
  },
  {
    name: 'Ms. Prathiba',
    title: 'Ms',
    firstName: 'Prathiba',
    lastName: '',
    gender: 'Female',
    email: 'prathiba.17904@gmail.com',
    phone: '6379719732',
    area: 'Kelambakkam',
  },
  {
    name: 'Ms Roshini.R',
    title: 'Ms',
    firstName: 'Roshini',
    lastName: 'R',
    gender: 'Female',
    email: 'roshiniramesh2004@gmail.com',
    phone: '8508202244',
    area: 'Sengammal',
  },
  {
    name: 'Mr. Vijayakumar P',
    title: 'Mr',
    firstName: 'Vijayakumar',
    lastName: 'P',
    gender: 'Male',
    email: 'vijaypp2000@gmail.com',
    phone: '8220781919',
    area: 'Kelambakkam',
  },
];

async function run() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  // 1. Get Event
  const event = await db.collection('events').findOne({ slug: 'fertility-gynaecology-summit-2026' });
  if (!event) throw new Error('Event not found');
  console.log(`✓ Event: ${event.title} (${event._id})`);

  // 2. Get TicketType
  const ticketType = await db.collection('tickettypes').findOne({ name: 'Delegate — Regular' });
  if (!ticketType) throw new Error('Ticket type not found');
  console.log(`✓ Ticket Type: ${ticketType.name} (${ticketType._id})`);

  // 3. Get Company
  const company = await db.collection('companies').findOne({ name: 'CIIM INHOUSE' });
  if (!company) throw new Error('Company "CIIM INHOUSE" not found');
  console.log(`✓ Company: ${company.name} (${company._id})`);

  // 4. Get Admin User
  const admin = await db.collection('users').findOne({ email: 'admin@prashanthhospitals.com' });
  const adminId = admin ? admin._id : null;
  const adminName = admin?.name || 'Platform Admin';

  // 5. Query 11 Unused B2B Coupons
  const coupons = await db
    .collection('coupons')
    .find({
      code: /^PFRCCIIM3/,
      usageCount: 0,
      isActive: true,
    })
    .sort({ code: 1 })
    .limit(attendeesToRegister.length)
    .toArray();

  if (coupons.length < attendeesToRegister.length) {
    throw new Error(
      `Insufficient unused 300-series B2B coupons. Needed: ${attendeesToRegister.length}, Found: ${coupons.length}`
    );
  }

  console.log(`✓ Selected ${coupons.length} B2B coupons: ${coupons[0].code} to ${coupons[coupons.length - 1].code}`);

  const results = [];

  for (let i = 0; i < attendeesToRegister.length; i++) {
    const item = attendeesToRegister[i];
    const coupon = coupons[i];

    // Check duplicate email or phone
    const existing = await db.collection('registrations').findOne({
      $or: [
        { 'attendee.email': item.email.toLowerCase() },
        { 'attendee.phone': item.phone },
      ],
    });

    if (existing) {
      console.warn(`⚠️ Skipped ${item.name} (${item.phone}): already registered under ${existing.registrationCode}`);
      results.push({
        name: item.name,
        phone: item.phone,
        email: item.email,
        status: 'already_registered',
        registrationCode: existing.registrationCode,
        couponCode: existing.couponCode,
        ticketUrl: `https://ciim.prashanthfertility.com/tickets/${existing.registrationCode}`,
      });
      continue;
    }

    const registrationCode = `REG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const qrToken = crypto.randomBytes(24).toString('hex');
    const now = new Date();

    const regDoc = {
      event: event._id,
      ticketType: ticketType._id,
      attendee: {
        name: item.name,
        title: item.title,
        firstName: item.firstName,
        lastName: item.lastName,
        gender: item.gender,
        email: item.email.toLowerCase().trim(),
        phone: item.phone.trim(),
        medicalCouncilRegNo: 'NA',
        institution: '',
        designation: '',
        address: item.area,
        country: 'India',
        state: 'Tamil Nadu',
        city: item.area === 'Urappakkam' || item.area === 'Egattur' || item.area === 'Sengammal' ? item.area : 'Chennai',
        pincode: '603103',
        category: 'Delegate — Regular',
        registrationCategory: '',
        workshop: '',
        accompanyingPerson: {
          hasAccompanyingPerson: false,
          name: '',
        },
        participantType: '',
      },
      coupon: coupon._id,
      company: company._id,
      couponCode: coupon.code,
      pricing: {
        basePrice: 13000,
        discountAmount: 15340,
        taxAmount: 2340,
        totalAmount: 0,
        currency: 'INR',
      },
      status: 'confirmed',
      promoCode: null,
      payment: null,
      idempotencyKey: crypto.randomUUID(),
      activeKey: `${event._id}:${item.email.toLowerCase().trim()}`,
      activePhoneKey: `${event._id}:${item.phone.trim().slice(-10)}`,
      // activeCouncilKey is omitted (undefined) because TNMC is NA
      delivery: {
        email: {
          status: 'pending',
          attempts: 0,
          lastAttemptAt: null,
          sentAt: null,
          error: '',
          providerMessageId: '',
        },
        whatsapp: {
          status: 'pending',
          attempts: 0,
          lastAttemptAt: null,
          sentAt: null,
          error: '',
          providerMessageId: '',
        },
      },
      checkedInAt: null,
      checkedInBy: null,
      certificateIssuedAt: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: '',
      campaignSource: 'b2b-direct',
      notes: 'Booked via senior doctor B2B request (TNMC: NA)',
      isTest: false,
      deliveryLog: [],
      qrToken,
      registrationCode,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Insert Registration
    const insertRes = await db.collection('registrations').insertOne(regDoc);
    const regId = insertRes.insertedId;

    // 2. Mark coupon used
    await db.collection('coupons').updateOne(
      { _id: coupon._id },
      { $set: { usageCount: 1, updatedAt: now } }
    );

    // 3. Increment ticket type & event capacity
    await db.collection('tickettypes').updateOne({ _id: ticketType._id }, { $inc: { quantitySold: 1 } });
    await db.collection('events').updateOne({ _id: event._id }, { $inc: { registeredCount: 1 } });

    // 4. Audit Log
    await db.collection('auditlogs').insertOne({
      actor: adminId,
      actorName: adminName,
      action: 'registration.create',
      entityType: 'Registration',
      entityId: regId,
      meta: {
        registrationCode,
        attendeeName: item.name,
        couponCode: coupon.code,
        channel: 'b2b-senior-doctor-booking',
      },
      ip: '127.0.0.1',
      at: now,
    });

    console.log(`✓ [${i + 1}/${attendeesToRegister.length}] Registered: ${item.name} -> ${registrationCode} (Coupon: ${coupon.code})`);

    results.push({
      name: item.name,
      phone: item.phone,
      email: item.email,
      area: item.area,
      status: 'confirmed',
      registrationCode,
      couponCode: coupon.code,
      ticketUrl: `https://ciim.prashanthfertility.com/tickets/${registrationCode}`,
    });
  }

  console.log('\n======================================================');
  console.log('✅ ALL REGISTRATIONS COMPLETED SUCCESSFULLY');
  console.log('======================================================\n');
  console.table(
    results.map((r, idx) => ({
      '#': idx + 1,
      Name: r.name,
      Mobile: r.phone,
      'Reg Code': r.registrationCode,
      Coupon: r.couponCode,
      'Ticket URL': r.ticketUrl,
    }))
  );

  process.exit(0);
}

run().catch((err) => {
  console.error('Registration failed:', err);
  process.exit(1);
});
