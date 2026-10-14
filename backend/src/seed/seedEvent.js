'use strict';

/**
 * Seeds one complete, realistic event so the microsite can be demoed end to end.
 * Safe to re-run: it upserts by slug.
 *
 *   npm run seed
 */

const { connectDatabase, disconnectDatabase } = require('../config/database');
const Event = require('../models/Event');
const TicketType = require('../models/TicketType');
const logger = require('../utils/logger');

const SLUG = 'fertility-gynaecology-summit-2026';

/** Returns a date N days from today at the given hour (IST-ish wall clock). */
function daysFromNow(days, hours = 9, minutes = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

const eventData = {
  title: 'CIIM 2026',
  slug: SLUG,
  tagline: 'Breaking Boundaries, Elevating Surgical Precision & ART Outcomes',
  summary:
    'The 5th Annual Conference on Controversies in Infertility Management — in-person at The Leela Palace, Chennai, with live tele-transmission of a historic cross-geography robotic surgery demonstration. High-impact debates, masterclasses and emerging-tech sessions for 800+ delegates.',
  description:
    'Greetings from Dr. Geetha Haripriya, Chairperson, Prashanth Fertility and Research Centre Pvt. Ltd. We are delighted to welcome you to the prestigious 5th CIIM, to be held from November 21st – 22nd, 2026. CIIM 2026 will truly be an unforgettable conference for all who attend.\n\nThe conference aims to ideate, analyze, and share inventive, feasible, and implementable ways to encourage and disseminate knowledge, education, and research to make a high level of care available to women. The Organizing Committee is working hard to put together an educational and scientific program for what will be an academic extravaganza, packaged with cuisine to tantalize your taste buds, and a complete cultural fest.',

  category: 'conference',
  mode: 'in-person',
  status: 'published',

  startDate: new Date('2026-11-21T09:00:00+05:30'),
  endDate: new Date('2026-11-22T17:30:00+05:30'),
  timezone: 'Asia/Kolkata',

  registrationOpensAt: daysFromNow(-10, 0, 0),
  registrationClosesAt: new Date('2026-11-20T23:59:00+05:30'),

  capacity: 800,
  registeredCount: 182,

  organizer: {
    name: 'Prashanth Fertility and Research Centre Pvt. Ltd.',
    department: 'Prashanth Fertility',
    logoUrl: '/assets/prashanth-hospitals-crest.jpg',
    websiteUrl: 'https://www.prashanthhospitals.com',
  },

  venue: {
    name: 'The Leela Palace',
    addressLine1: '',
    addressLine2: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '',
    landmark: '',
    mapEmbedUrl: 'https://www.google.com/maps?q=The+Leela+Palace+Chennai&output=embed',
    mapLink: 'https://maps.google.com/?q=The+Leela+Palace+Chennai',
    latitude: null,
    longitude: null,
    parkingInfo: '',
  },

  highlights: [
    'Live Tele-Robotics: streamed high-definition remote surgical demonstration',
    'Debates & Panels: high-impact sessions on contested infertility & ART protocols',
    'Masterclasses: hands-on insights led by renowned international & national faculty',
    'Emerging Tech: innovations in embryology, AI in IVF and reproductive surgery',
  ],

  // No real agenda speakers (with session topics) confirmed yet — only the
  // organising/scientific committee roster. Speakers to be added once the
  // scientific programme is finalised.
  speakers: [],

  committee: [
    { name: 'Dr Geetha Haripriya', role: 'Organising Chairperson', group: 'leadership', photoUrl: '/assets/chairperson-geetha-haripriya.png', order: 1 },
    { name: 'Dr Samhitha Moturi', role: 'Organising Secretary', group: 'leadership', photoUrl: '', order: 2 },

    { name: 'Dr Swathi', role: '', group: 'scientific', photoUrl: '', order: 1 },
    { name: 'Dr Malsri', role: '', group: 'scientific', photoUrl: '', order: 2 },
    { name: 'Dr Anuradha', role: '', group: 'scientific', photoUrl: '', order: 3 },
    { name: 'Dr Veena', role: '', group: 'scientific', photoUrl: '', order: 4 },
    { name: 'Dr Usha Todadri', role: '', group: 'scientific', photoUrl: '', order: 5 },
    { name: 'Dr Abrajdha', role: '', group: 'scientific', photoUrl: '', order: 6 },
    { name: 'Dr Sailaja', role: '', group: 'scientific', photoUrl: '', order: 7 },
    { name: 'Dr Sughija', role: '', group: 'scientific', photoUrl: '', order: 8 },
    { name: 'Dr Madhumitha', role: '', group: 'scientific', photoUrl: '', order: 9 },
    { name: 'Dr Selvapriya', role: '', group: 'scientific', photoUrl: '', order: 10 },
    { name: 'Dr Pushpalatha', role: '', group: 'scientific', photoUrl: '', order: 11 },
    { name: 'Dr Sabia Nikath', role: '', group: 'scientific', photoUrl: '', order: 12 },

    { name: 'Dr Jenifer', role: '', group: 'organising', photoUrl: '', order: 1 },
    { name: 'Dr Radhika', role: '', group: 'organising', photoUrl: '', order: 2 },
    { name: 'Dr Sreejanani', role: '', group: 'organising', photoUrl: '', order: 3 },
    { name: 'Dr Seeniammal', role: '', group: 'organising', photoUrl: '', order: 4 },
    { name: 'Dr Divya', role: '', group: 'organising', photoUrl: '', order: 5 },
    { name: 'Dr Priyanka', role: '', group: 'organising', photoUrl: '', order: 6 },
    { name: 'Dr Divya', role: '', group: 'organising', photoUrl: '', order: 7 },
    { name: 'Dr Subhasree', role: '', group: 'organising', photoUrl: '', order: 8 },
    { name: 'Dr Sobhana', role: '', group: 'organising', photoUrl: '', order: 9 },
  ],

  agenda: [
    {
      date: new Date('2026-11-21T00:00:00+05:30'),
      label: 'Day 1 — The Leela Palace (sample programme)',
      items: [
        {
          startTime: '08:30',
          endTime: '09:00',
          title: 'Delegate Registration & Welcome Coffee',
          description: 'Scan your QR ticket at the registration desk to collect your delegate kit.',
          type: 'registration',
          track: 'Foyer',
          order: 1,
        },
        {
          startTime: '09:00',
          endTime: '09:20',
          title: 'Inaugural Address',
          description: 'Welcome by the Management and Department of Fertility & Gynaecology.',
          type: 'other',
          track: 'Main Hall',
          order: 2,
        },
        {
          startTime: '09:20',
          endTime: '10:05',
          title: 'Keynote: Individualising Ovarian Stimulation',
          description:
            'What the 2026 evidence says about protocol selection, dosing and freeze-all strategies.',
          speakerNames: [],
          type: 'keynote',
          track: 'Main Hall',
          order: 3,
        },
        {
          startTime: '10:05',
          endTime: '10:45',
          title: 'PCOS Across the Life Course: Beyond Fertility',
          description: 'Long-term metabolic and cardiovascular considerations in PCOS care.',
          speakerNames: [],
          type: 'session',
          track: 'Main Hall',
          order: 4,
        },
        {
          startTime: '10:45',
          endTime: '11:10',
          title: 'Networking Tea Break',
          type: 'break',
          track: 'Foyer',
          order: 5,
        },
        {
          startTime: '11:10',
          endTime: '11:55',
          title: 'Endometriosis: Surgical Decision-Making Before ART',
          description: 'Live surgical video demonstration with case-based discussion.',
          speakerNames: [],
          type: 'session',
          track: 'Main Hall',
          order: 6,
        },
        {
          startTime: '11:55',
          endTime: '12:40',
          title: 'Time-Lapse Imaging and AI-Assisted Embryo Selection',
          description: 'Laboratory evidence, practical limitations and what to tell patients.',
          speakerNames: [],
          type: 'session',
          track: 'Main Hall',
          order: 7,
        },
        {
          startTime: '12:40',
          endTime: '13:40',
          title: 'Lunch',
          type: 'break',
          track: 'Banquet Hall',
          order: 8,
        },
        {
          startTime: '13:40',
          endTime: '14:25',
          title: 'Recurrent Implantation Failure: Separating Signal from Noise',
          speakerNames: [],
          type: 'session',
          track: 'Main Hall',
          order: 9,
        },
        {
          startTime: '14:25',
          endTime: '15:10',
          title: 'Oncofertility: Counselling the Young Cancer Patient',
          speakerNames: [],
          type: 'session',
          track: 'Main Hall',
          order: 10,
        },
        {
          startTime: '15:10',
          endTime: '16:10',
          title: 'Hands-on Workshop: Ultrasound in Early Pregnancy',
          description: 'Limited to 40 delegates. Requires a VIP or Workshop pass.',
          type: 'workshop',
          track: 'Skills Lab',
          order: 11,
        },
        {
          startTime: '16:10',
          endTime: '17:00',
          title: 'Expert Panel: Ethics and Regulation in ART',
          description: 'Moderated panel with all faculty, followed by open floor Q&A.',
          speakerNames: [],
          type: 'panel',
          track: 'Main Hall',
          order: 12,
        },
        {
          startTime: '17:00',
          endTime: '17:30',
          title: 'Valedictory, Certificates & High Tea',
          type: 'networking',
          track: 'Foyer',
          order: 13,
        },
      ],
    },
  ],

  sponsors: [
    { name: 'Prashanth Fertility Research Centre', tier: 'title', logoUrl: '', order: 1 },
    { name: 'Merck Healthcare', tier: 'platinum', logoUrl: '', order: 2 },
    { name: 'Ferring Pharmaceuticals', tier: 'gold', logoUrl: '', order: 3 },
    { name: 'Vitrolife', tier: 'gold', logoUrl: '', order: 4 },
    { name: 'Chennai OBGYN Society', tier: 'partner', logoUrl: '', order: 5 },
  ],

  faqs: [
    {
      question: 'Who should attend CIIM 2026?',
      answer:
        'Reproductive medicine specialists & IVF consultants, gynaecological endoscopic & robotic surgeons, embryologists & clinical reproductive scientists, and obstetricians, gynaecologists & postgraduates.',
      order: 1,
    },
    {
      question: 'Will CME credit points be awarded?',
      answer:
        'Yes. The summit is accredited for 6 CME credit points by the Tamil Nadu Medical Council. Credit requires check-in at the venue and attendance until the valedictory session.',
      order: 2,
    },
    {
      question: 'How do I receive my ticket after registering?',
      answer:
        'Immediately after registration you receive a digital ticket with a unique QR code on WhatsApp and email. Show that QR code at the registration desk on event day.',
      order: 3,
    },
    {
      question: 'Can I register a colleague along with me?',
      answer:
        'Yes. The Couple/Duo pass admits two delegates on a single registration. Each delegate still receives an individual QR code and certificate.',
      order: 4,
    },
    {
      question: 'What is the cancellation and refund policy?',
      answer:
        'Cancellations requested in writing up to 14 days before the event are eligible for a refund less a 10% processing fee. Registrations are transferable to another delegate at no cost.',
      order: 5,
    },
    {
      question: 'Is accommodation provided?',
      answer:
        'Accommodation is not included. Our delegate desk can share a list of partner hotels near the venue with negotiated rates on request.',
      order: 6,
    },
  ],

  announcements: [
    {
      message: 'Early bird pricing closes in 7 days — register now to save ₹500 on delegate passes.',
      level: 'info',
      isActive: true,
      publishedAt: new Date(),
      expiresAt: daysFromNow(7, 23, 59),
    },
    {
      message: 'The hands-on ultrasound workshop has limited seats and is filling quickly.',
      level: 'info',
      isActive: true,
      publishedAt: new Date(),
      expiresAt: null,
    },
  ],

  contact: {
    name: 'CIIM 2026 Conference Secretariat',
    phone: '+914442279999',
    whatsapp: '+919840012345',
    email: 'secretariat@ciim2026.com',
  },

  seo: {
    metaTitle: 'CIIM 2026 | Controversies in Infertility Management',
    metaDescription:
      '5th Annual Conference on Controversies in Infertility Management, 21–22 Nov 2026 at The Leela Palace, Chennai. Register now.',
    keywords: [
      'CIIM 2026',
      'infertility conference chennai',
      'IVF conference india',
      'controversies in infertility management',
      'prashanth fertility',
    ],
    ogImageUrl: '/assets/og-summit-2026.jpg',
    noIndex: false,
  },

  theme: {
    primaryColor: '#0E5C8A',
    accentColor: '#E4859B',
    heroImageUrl: '',
    logoUrl: '/assets/prashanth-hospitals-crest.jpg',
  },

  isFeatured: true,
};

const ticketTypesData = [
  {
    name: 'Delegate — Regular',
    code: 'REG',
    description: 'Full-day access to all main hall sessions, delegate kit, lunch and certificate.',
    kind: 'paid',
    price: 2500,
    taxPercent: 18,
    admitsCount: 1,
    quantityTotal: 250,
    quantitySold: 118,
    minPerOrder: 1,
    maxPerOrder: 5,
    benefits: [
      'Access to all main hall sessions',
      'Delegate kit and printed programme',
      'Lunch and high tea',
      '6 CME credit points',
      'E-certificate of participation',
    ],
    isPubliclyVisible: true,
    isActive: true,
    order: 1,
  },
  {
    name: 'PG Student / Resident',
    code: 'PGS',
    description: 'Concessional pass for postgraduates. Valid institutional ID required at check-in.',
    kind: 'paid',
    price: 1200,
    taxPercent: 18,
    admitsCount: 1,
    quantityTotal: 80,
    quantitySold: 44,
    minPerOrder: 1,
    maxPerOrder: 2,
    benefits: [
      'Access to all main hall sessions',
      'Delegate kit',
      'Lunch and high tea',
      'E-certificate of participation',
    ],
    allowedParticipantTypes: ['PG Student', 'Resident'],
    isPubliclyVisible: true,
    isActive: true,
    order: 2,
  },
  {
    name: 'Duo Pass (2 Delegates)',
    code: 'CPL',
    description: 'One registration admitting two delegates. Each receives an individual QR ticket.',
    kind: 'couple',
    price: 4500,
    taxPercent: 18,
    admitsCount: 2,
    quantityTotal: 60,
    quantitySold: 12,
    minPerOrder: 1,
    maxPerOrder: 3,
    benefits: [
      'Admits two delegates',
      'Two delegate kits and two certificates',
      'Reserved seating block',
      'Lunch and high tea for both',
    ],
    isPubliclyVisible: true,
    isActive: true,
    order: 3,
  },
  {
    name: 'VIP + Hands-on Workshop',
    code: 'VIP',
    description:
      'Includes the limited-capacity ultrasound skills workshop and faculty networking dinner.',
    kind: 'vip',
    price: 6500,
    taxPercent: 18,
    admitsCount: 1,
    quantityTotal: 40,
    quantitySold: 33,
    minPerOrder: 1,
    maxPerOrder: 2,
    benefits: [
      'Everything in the Regular pass',
      'Seat in the hands-on ultrasound workshop',
      'Front-row reserved seating',
      'Faculty networking dinner',
      'Printed session resource compendium',
    ],
    isPubliclyVisible: true,
    isActive: true,
    order: 4,
  },
  {
    name: 'Invited Faculty / Complimentary',
    code: 'COMP',
    description: 'Issued by the organising committee. Not available for public purchase.',
    kind: 'complimentary',
    price: 0,
    admitsCount: 1,
    quantityTotal: 30,
    quantitySold: 18,
    benefits: ['Full access', 'Faculty lounge', 'Networking dinner'],
    isPubliclyVisible: false,
    isActive: true,
    order: 5,
  },
];

async function seed() {
  await connectDatabase();

  // Load-then-save (rather than findOneAndUpdate) so document middleware and
  // validators run: slug derivation, publishedAt, and the date-order checks.
  let event = await Event.findOne({ slug: SLUG });
  if (!event) {
    event = new Event(eventData);
  } else {
    event.set(eventData);
  }
  await event.save();

  logger.info(`Seeded event: ${event.title} (${event.slug})`);

  for (const ticket of ticketTypesData) {
    let doc = await TicketType.findOne({ event: event._id, code: ticket.code });
    if (!doc) {
      doc = new TicketType({ ...ticket, event: event._id });
    } else {
      doc.set({ ...ticket, event: event._id });
    }
    await doc.save();
  }

  logger.info(`Seeded ${ticketTypesData.length} ticket types`);
  logger.info(`Microsite URL: /events/${event.slug}`);

  await disconnectDatabase();
}

seed().catch(async (err) => {
  logger.error('Seeding failed', err);
  try {
    await disconnectDatabase();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
