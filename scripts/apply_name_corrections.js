'use strict';

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const path = require('path');
const fs = require('fs');
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));
const Registration = require(path.resolve(__dirname, '../backend/src/models/Registration'));

const uri =
  process.env.MONGODB_URI ||
  'mongodb+srv://jiokarthikeyan18_db_user:Oe8OhnOrD164A0dJ@prashantdb.ma6fim0.mongodb.net/prashanth_events?retryWrites=true&w=majority';

// Exact specifications based on check name correction.xlsx (Sheet 3)
const CORRECTIONS = [
  {
    sl: 1,
    regCode: 'REG-E34FD15F',
    couponCode: 'PFRCCIIM016B2B',
    name: 'Dr JEGATHEESHWARI',
    title: 'Dr',
    firstName: 'JEGATHEESHWARI',
    lastName: ''
  },
  {
    sl: 2,
    regCode: 'REG-1D1226AF',
    couponCode: 'PFRCCIIM048B2B',
    name: 'Dr Tamilarasi S',
    title: 'Dr',
    firstName: 'Tamilarasi',
    lastName: 'S'
  },
  {
    sl: 3,
    regCode: 'REG-B027BA6D',
    couponCode: 'PFRCCIIM050B2B',
    name: 'Dr Sandhya',
    title: 'Dr',
    firstName: 'Sandhya',
    lastName: ''
  },
  {
    sl: 4,
    regCode: 'REG-9D820582',
    couponCode: 'PFRCCIIM066B2B',
    name: 'Dr HEMA R R',
    title: 'Dr',
    firstName: 'HEMA',
    lastName: 'R R'
  },
  {
    sl: 6,
    regCode: 'REG-F47E4911',
    couponCode: 'PFRCCIIM117B2B',
    name: 'Dr VAISHNAVI',
    title: 'Dr',
    firstName: 'VAISHNAVI',
    lastName: ''
  },
  {
    sl: 7,
    regCode: 'REG-FF859B1E',
    couponCode: 'PFRCCIIM145B2B',
    name: 'Dr N TAMILSELVI',
    title: 'Dr',
    firstName: 'N',
    lastName: 'TAMILSELVI'
  },
  {
    sl: 9,
    regCode: 'REG-3707A0C1',
    couponCode: 'PFRCCIIM175B2B',
    name: 'Dr Manju Gnanasekaran',
    title: 'Dr',
    firstName: 'Manju',
    lastName: 'Gnanasekaran'
  },
  {
    sl: 10,
    regCode: 'REG-7F77CAD9',
    couponCode: 'PFRCCIIM179B2B',
    name: 'Dr Chandrika Palani',
    title: 'Dr',
    firstName: 'Chandrika',
    lastName: 'Palani'
  },
  {
    sl: 11,
    regCode: 'REG-D522CA2E',
    couponCode: 'PFRCCIIM256B2B',
    name: 'Dr PRINCY MICHAELRAJ',
    title: 'Dr',
    firstName: 'PRINCY',
    lastName: 'MICHAELRAJ'
  },
  {
    sl: 12,
    regCode: 'REG-5688BD30',
    couponCode: 'PFRCCIIM269B2B',
    name: 'Dr M S HEMALATHA',
    title: 'Dr',
    firstName: 'M S',
    lastName: 'HEMALATHA'
  },
  {
    sl: 13,
    regCode: 'REG-281B6C72',
    couponCode: 'PFRCCIIM281B2B',
    name: 'Dr NIRANJANA',
    title: 'Dr',
    firstName: 'NIRANJANA',
    lastName: ''
  },
  {
    sl: 15,
    regCode: 'REG-141229CB',
    couponCode: 'PFRCCIIM001SLV19',
    name: 'Dr Shwetha',
    title: 'Dr',
    firstName: 'Shwetha',
    lastName: ''
  },
  {
    sl: 17,
    regCode: 'REG-15858008',
    couponCode: 'PFRCCIIM324B2B',
    name: 'Dr SURYA',
    title: 'Dr',
    firstName: 'SURYA',
    lastName: ''
  },
  {
    sl: 20,
    regCode: 'REG-D0110B7B',
    couponCode: 'PFRCCIIM466B2B',
    name: 'Dr T SIVAKAMI',
    title: 'Dr',
    firstName: 'T',
    lastName: 'SIVAKAMI'
  },
  {
    sl: 21,
    regCode: 'REG-6BC62160',
    couponCode: 'PFRCCIIM491B2B',
    name: 'Dr JAMUNA RANI',
    title: 'Dr',
    firstName: 'JAMUNA',
    lastName: 'RANI'
  },
  {
    sl: 22,
    regCode: 'REG-FBC434CC',
    couponCode: 'PFRCCIIM004B2B',
    name: 'Dr MUBEEN',
    title: 'Dr',
    firstName: 'MUBEEN',
    lastName: ''
  },
  {
    sl: 23,
    regCode: 'REG-469309A7',
    couponCode: 'PFRCCIIM294B2B',
    name: 'Dr BANUMATHI L',
    title: 'Dr',
    firstName: 'BANUMATHI',
    lastName: 'L'
  },
  {
    sl: 24,
    regCode: 'REG-91866E10',
    couponCode: 'PFRCCIIM300B2B',
    name: 'Dr V.Raghavi',
    title: 'Dr',
    firstName: 'V.Raghavi',
    lastName: '',
    medicalCouncilRegNo: '197752' // Council Reg No change requested
  },
  {
    sl: 25,
    regCode: 'REG-9DD1D87D',
    couponCode: 'PFRCCIIM434B2B',
    name: 'Dr C. JAHNAVI',
    title: 'Dr',
    firstName: 'C.',
    lastName: 'JAHNAVI'
  },
  {
    sl: 26,
    regCode: 'REG-3C7173E3',
    couponCode: 'PFRCCIIM113B2B',
    name: 'Dr REGINA LEO',
    title: 'Dr',
    firstName: 'REGINA',
    lastName: 'LEO'
  },
  {
    sl: 27,
    regCode: 'REG-B1270EDB',
    couponCode: 'PFRCCIIM111B2B',
    name: 'Dr T S CHITRA',
    title: 'Dr',
    firstName: 'T S',
    lastName: 'CHITRA'
  },
  {
    sl: 28,
    regCode: 'REG-074AC210',
    couponCode: 'PFRCCIIM101B2B',
    name: 'Dr Niranjanadevi S G',
    title: 'Dr',
    firstName: 'Niranjanadevi',
    lastName: 'S G'
  },
  {
    sl: 29,
    regCode: 'REG-467862BD',
    couponCode: 'PFRCCIIM288B2B',
    name: 'Dr ANURADHA S',
    title: 'Dr',
    firstName: 'ANURADHA',
    lastName: 'S'
  },
  {
    sl: 30,
    regCode: 'REG-8A82CC77',
    couponCode: 'PFRCCIIM454B2B',
    name: 'Dr M.Manoprakash',
    title: 'Dr',
    firstName: 'M.',
    lastName: 'Manoprakash'
  },
  {
    sl: 31,
    regCode: 'REG-0E07AD40',
    couponCode: 'PFRCCIIM442B2B',
    name: 'Dr Prashaanth M K',
    title: 'Dr',
    firstName: 'Prashaanth',
    lastName: 'M K'
  }
];

async function applyCorrections() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri);

  const backupDir = path.resolve(__dirname, '../exports');
  const backupFile = path.join(backupDir, `backup_before_name_corrections_${Date.now()}.json`);

  // Step 1: Backup all 31 documents first
  const allCodes = [
    'REG-E34FD15F', 'REG-1D1226AF', 'REG-B027BA6D', 'REG-9D820582', 'REG-A2E2CA48',
    'REG-F47E4911', 'REG-FF859B1E', 'REG-109EEAC9', 'REG-3707A0C1', 'REG-7F77CAD9',
    'REG-D522CA2E', 'REG-5688BD30', 'REG-281B6C72', 'REG-2D1C2EA4', 'REG-141229CB',
    'REG-BDF6B611', 'REG-15858008', 'REG-E94AB1FC', 'REG-CB542D7D', 'REG-D0110B7B',
    'REG-6BC62160', 'REG-FBC434CC', 'REG-469309A7', 'REG-91866E10', 'REG-9DD1D87D',
    'REG-3C7173E3', 'REG-B1270EDB', 'REG-074AC210', 'REG-467862BD', 'REG-8A82CC77',
    'REG-0E07AD40'
  ];

  const docsToBackup = await Registration.find({ registrationCode: { $in: allCodes } }).lean();
  fs.writeFileSync(backupFile, JSON.stringify(docsToBackup, null, 2));
  console.log(`Backed up ${docsToBackup.length} registrations to ${backupFile}`);

  console.log(`\nStarting updates for ${CORRECTIONS.length} registrations...\n`);

  let updatedCount = 0;

  for (const c of CORRECTIONS) {
    const reg = await Registration.findOne({ registrationCode: c.regCode });
    if (!reg) {
      console.error(`❌ Registration ${c.regCode} not found!`);
      continue;
    }

    const before = {
      name: reg.attendee.name,
      title: reg.attendee.title,
      firstName: reg.attendee.firstName,
      lastName: reg.attendee.lastName,
      medicalCouncilRegNo: reg.attendee.medicalCouncilRegNo
    };

    // Update attendee fields
    reg.attendee.name = c.name;
    reg.attendee.title = c.title;
    reg.attendee.firstName = c.firstName;
    reg.attendee.lastName = c.lastName;

    if (c.medicalCouncilRegNo && c.medicalCouncilRegNo !== reg.attendee.medicalCouncilRegNo) {
      reg.attendee.medicalCouncilRegNo = c.medicalCouncilRegNo;
      if (reg.activeCouncilKey !== undefined) {
        reg.activeCouncilKey = Registration.activeCouncilKeyFor(reg.event, c.medicalCouncilRegNo);
      }
    }

    await reg.save();
    updatedCount++;

    console.log(`✅ SL ${c.sl} (${c.regCode} / ${c.couponCode}):`);
    console.log(`   Name: "${before.name}" ➔ "${reg.attendee.name}"`);
    if (c.medicalCouncilRegNo) {
      console.log(`   Council Reg No: "${before.medicalCouncilRegNo}" ➔ "${reg.attendee.medicalCouncilRegNo}"`);
    }
  }

  console.log(`\n🎉 Successfully updated ${updatedCount} registrations in MongoDB Atlas!`);

  // Verify all
  console.log('\n--- VERIFICATION PASS ---');
  for (const c of CORRECTIONS) {
    const verified = await Registration.findOne({ registrationCode: c.regCode }).lean();
    const nameMatches = verified.attendee.name === c.name;
    const medMatches = !c.medicalCouncilRegNo || verified.attendee.medicalCouncilRegNo === c.medicalCouncilRegNo;
    if (nameMatches && medMatches) {
      console.log(`✔ SL ${c.sl} (${c.regCode}): Verified name = "${verified.attendee.name}"`);
    } else {
      console.error(`❌ SL ${c.sl} (${c.regCode}): Verification mismatch!`);
    }
  }

  await mongoose.disconnect();
}

applyCorrections().catch((err) => {
  console.error('Fatal error during update:', err);
  process.exit(1);
});
