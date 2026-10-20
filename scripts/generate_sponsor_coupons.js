'use strict';

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('atlas-credentials.env'));
const uri = envConfig.MONGODB_URI + '/prashanth_events?retryWrites=true&w=majority';

async function main() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const event = await db.collection('events').findOne({ slug: 'fertility-gynaecology-summit-2026' });
  if (!event) {
    throw new Error('Event not found');
  }
  console.log('Target Event:', event.title, `(${event._id})`);

  const groups = [
    // Platinum: 5 sponsors, 60 passes each
    { prefix: 'PFRCCIIM', tier: 'Platinum', count: 5, passes: 60, suffixPattern: (i) => `PLT${i}` },
    // Gold: 3 sponsors, 30 passes each
    { prefix: 'PFRCCIIM', tier: 'Gold', count: 3, passes: 30, suffixPattern: (i) => `GLD${i}` },
    // Silver: 19 sponsors, 15 passes each
    { prefix: 'PFRCCIIM', tier: 'Silver', count: 19, passes: 15, suffixPattern: (i) => `SLV${String(i).padStart(2, '0')}` },
  ];

  let totalCompaniesCreated = 0;
  let totalCouponsCreated = 0;

  for (const g of groups) {
    for (let s = 1; s <= g.count; s++) {
      const sponsorNumStr = g.tier === 'Silver' ? String(s).padStart(2, '0') : String(s);
      const companyName = `${g.tier} Sponsor ${sponsorNumStr}`;
      const nameKey = companyName.toLowerCase();
      const suffix = g.suffixPattern(s);

      // Find or create company
      let company = await db.collection('companies').findOne({ nameKey });
      if (!company) {
        const compDoc = {
          name: companyName,
          nameKey: nameKey,
          contactName: '',
          contactEmail: '',
          contactPhone: '',
          notes: `${g.tier} Tier Sponsor (${g.passes} passes)`,
          isActive: true,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          __v: 0
        };
        const compRes = await db.collection('companies').insertOne(compDoc);
        company = { _id: compRes.insertedId, name: companyName };
        totalCompaniesCreated++;
      }

      // Generate coupons for this sponsor
      const couponDocs = [];
      for (let n = 1; n <= g.passes; n++) {
        const numStr = String(n).padStart(3, '0');
        const code = `${g.prefix}${numStr}${suffix}`.toUpperCase();

        couponDocs.push({
          event: event._id,
          company: company._id,
          code: code,
          description: `${companyName} pass #${numStr} (${code})`,
          maxAllowedRegistrations: 1,
          usageCount: 0,
          startDate: null,
          expiryDate: null,
          isActive: true,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          __v: 0
        });
      }

      // Bulk upsert / insert ignore duplicates
      for (const c of couponDocs) {
        const existing = await db.collection('coupons').findOne({ code: c.code });
        if (!existing) {
          await db.collection('coupons').insertOne(c);
          totalCouponsCreated++;
        }
      }

      console.log(`Created/Verified ${companyName}: ${g.prefix}001${suffix} to ${g.prefix}${String(g.passes).padStart(3, '0')}${suffix} (${g.passes} coupons)`);
    }
  }

  const allCouponsCount = await db.collection('coupons').countDocuments({});
  const allCompaniesCount = await db.collection('companies').countDocuments({});

  console.log('\n=============================================');
  console.log(`Total New Companies Created: ${totalCompaniesCreated}`);
  console.log(`Total New Coupons Created:   ${totalCouponsCreated}`);
  console.log(`Total Database Companies:    ${allCompaniesCount}`);
  console.log(`Total Database Coupons:      ${allCouponsCount}`);
  console.log('=============================================');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
