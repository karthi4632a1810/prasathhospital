'use strict';

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb+srv://jiokarthikeyan18_db_user:Oe8OhnOrD164A0dJ@prashantdb.ma6fim0.mongodb.net/prashanth_events?retryWrites=true&w=majority';

async function run() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  // 1. Get Event
  const event = await db.collection('events').findOne({ slug: 'fertility-gynaecology-summit-2026' });
  if (!event) throw new Error('Event "fertility-gynaecology-summit-2026" not found!');
  console.log(`✓ Event: ${event.title} (${event._id})`);

  // 2. Get Company (CIIM INHOUSE)
  const company = await db.collection('companies').findOne({ name: 'CIIM INHOUSE' });
  if (!company) throw new Error('Company "CIIM INHOUSE" not found!');
  console.log(`✓ Company: ${company.name} (${company._id})`);

  // 3. Get Admin User
  const admin = await db.collection('users').findOne({ email: 'admin@prashanthhospitals.com' });
  const adminId = admin ? admin._id : null;
  console.log(`✓ Creator: ${admin?.name || 'Admin'} (${adminId})`);

  // Define the 3 series batches
  const seriesConfig = [
    {
      label: 'B2B',
      prefix: 'PFRCCIIM',
      suffix: 'B2B',
      startNum: 301,
      endNum: 500,
      count: 200,
      digits: 3,
    },
    {
      label: 'B2BV',
      prefix: 'PFRCCIIM',
      suffix: 'B2BV',
      startNum: 401,
      endNum: 450,
      count: 50,
      digits: 3,
    },
    {
      label: 'GLD',
      prefix: 'PFRCCIIM',
      suffix: 'GLD',
      startNum: 1,
      endNum: 30,
      count: 30,
      digits: 3,
    },
  ];

  let totalInserted = 0;
  const results = [];
  const now = new Date();

  for (const s of seriesConfig) {
    const docs = [];
    const codes = [];

    for (let i = s.startNum; i <= s.endNum; i++) {
      const padded = String(i).padStart(s.digits, '0');
      const code = `${s.prefix}${padded}${s.suffix}`.toUpperCase();
      codes.push(code);

      docs.push({
        event: event._id,
        company: company._id,
        code,
        description: `Series ${s.prefix}${String(s.startNum).padStart(s.digits, '0')}${s.suffix} to ${s.prefix}${String(s.endNum).padStart(s.digits, '0')}${s.suffix}`,
        maxAllowedRegistrations: 1,
        usageCount: 0,
        startDate: null,
        expiryDate: null,
        isActive: true,
        isTest: false,
        createdBy: adminId,
        createdAt: now,
        updatedAt: now,
        __v: 0,
      });
    }

    // Safety check collisions
    const clashes = await db.collection('coupons').find({ code: { $in: codes } }).toArray();
    if (clashes.length > 0) {
      throw new Error(`Collision detected in ${s.label}: ${clashes.map(c => c.code).join(', ')}`);
    }

    // Insert batch
    const insertRes = await db.collection('coupons').insertMany(docs, { ordered: true });
    totalInserted += insertRes.insertedCount;

    // Record audit log
    await db.collection('auditlogs').insertOne({
      actor: adminId,
      actorName: admin?.name || 'Platform Admin',
      action: 'coupon.create_series',
      entityType: 'Coupon',
      entityId: null,
      meta: {
        company: company.name,
        event: event._id,
        count: docs.length,
        firstCode: codes[0],
        lastCode: codes[codes.length - 1],
        seriesField: 2,
        startNum: s.startNum,
        endNum: s.endNum,
        digits: s.digits,
        maxAllowedRegistrations: 1,
      },
      ip: '127.0.0.1',
      at: now,
      __v: 0,
    });

    results.push({
      category: s.label,
      count: docs.length,
      firstCode: codes[0],
      lastCode: codes[codes.length - 1],
    });

    console.log(`✓ Inserted ${docs.length} ${s.label} coupons (${codes[0]} → ${codes[codes.length - 1]})`);
  }

  console.log('\n======================================================');
  console.log(`TOTAL COUPONS CREATED SUCCESSFULLY: ${totalInserted}`);
  console.log('======================================================');
  results.forEach(r => console.log(`• ${r.category}: ${r.count} coupons (${r.firstCode} to ${r.lastCode})`));

  const newTotalInDb = await db.collection('coupons').countDocuments({});
  console.log(`Total coupons now in database: ${newTotalInDb}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('FAILED TO CREATE COUPONS:', err);
  process.exit(1);
});

