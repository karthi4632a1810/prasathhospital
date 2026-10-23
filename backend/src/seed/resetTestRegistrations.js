'use strict';

const { connectDatabase, disconnectDatabase } = require('../config/database');
const Registration = require('../models/Registration');
const Coupon = require('../models/Coupon');
const Company = require('../models/Company');
const Event = require('../models/Event');
const logger = require('../utils/logger');

async function main() {
  await connectDatabase();

  const event = await Event.findOne({}).sort({ createdAt: -1 });
  if (!event) {
    throw new Error('No event found in database.');
  }
  console.log(`Working with event: "${event.title}" (${event._id})`);

  // 1. Find the test registrations to delete
  const targetCodes = ['REG-81D03A11', 'REG-3B25413C'];
  const testRegs = await Registration.find({
    $or: [
      { registrationCode: { $in: targetCodes } },
      { couponCode: { $in: ['PFRCCIIM299B2B', 'PFRCCIIM300B2B'] } },
    ],
  });

  console.log(`Found ${testRegs.length} test registration(s) to remove:`);
  for (const reg of testRegs) {
    console.log(` - ${reg.registrationCode} (${reg.attendee?.name}, Coupon: ${reg.couponCode})`);
  }

  // Delete the test registrations
  if (testRegs.length > 0) {
    const ids = testRegs.map((r) => r._id);
    const delResult = await Registration.deleteMany({ _id: { $in: ids } });
    console.log(`Deleted ${delResult.deletedCount} registration(s) from database.`);
  }

  // 2. Reset the usageCount on the coupons PFRCCIIM299B2B and PFRCCIIM300B2B
  const resetCoupons = await Coupon.find({
    code: { $in: ['PFRCCIIM299B2B', 'PFRCCIIM300B2B'] },
  });

  for (const c of resetCoupons) {
    c.usageCount = 0;
    await c.save();
    console.log(`Reset coupon "${c.code}": usageCount is now ${c.usageCount}/${c.maxAllowedRegistrations}`);
  }

  // 3. Find or ensure Company for in-house test coupons
  let company = await Company.findOne({ name: /CIIM INHOUSE/i });
  if (!company) {
    company = await Company.findOne({ name: /INHOUSE/i });
  }
  if (!company) {
    company = await Company.findOne({});
  }
  console.log(`Using company: "${company?.name}" (${company?._id})`);

  // 4. Create 5 fresh test coupons for production testing
  const testCoupons = [
    { code: 'CIIMTEST01', description: 'VIP Production Test Coupon 1' },
    { code: 'CIIMTEST02', description: 'VIP Production Test Coupon 2' },
    { code: 'CIIMTEST03', description: 'VIP Production Test Coupon 3' },
    { code: 'CIIMTEST04', description: 'VIP Production Test Coupon 4' },
    { code: 'CIIMTEST05', description: 'VIP Production Test Coupon 5' },
  ];

  console.log('--- Ensuring 5 Production Test Coupons ---');
  for (const item of testCoupons) {
    let existing = await Coupon.findOne({ code: item.code });
    if (!existing) {
      existing = await Coupon.create({
        event: event._id,
        company: company._id,
        code: item.code,
        description: item.description,
        maxAllowedRegistrations: 10,
        usageCount: 0,
        isActive: true,
      });
      console.log(`Created new coupon: ${existing.code} (max: ${existing.maxAllowedRegistrations}, usage: 0)`);
    } else {
      existing.usageCount = 0;
      existing.isActive = true;
      await existing.save();
      console.log(`Updated existing coupon: ${existing.code} (reset usage to 0, active)`);
    }
  }

  // Summary
  const remainingRegsCount = await Registration.countDocuments({});
  console.log(`\nAll done! Total remaining registrations in database: ${remainingRegsCount}`);

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('Error running script:', err);
  await disconnectDatabase();
  process.exit(1);
});
