'use strict';

const mongoose = require('mongoose');
const slugify = require('slugify');

const { Schema } = mongoose;

/* -------------------------------------------------------------------------- */
/* Sub-schemas                                                                */
/* -------------------------------------------------------------------------- */

const SpeakerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    credentials: { type: String, trim: true, default: '' }, // e.g. MBBS, MD (OBG), DNB
    designation: { type: String, trim: true, default: '' },
    organization: { type: String, trim: true, default: '' },
    photoUrl: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, default: '', maxlength: 1500 },
    topic: { type: String, trim: true, default: '' },
    isKeynote: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: true, timestamps: false }
);

const AgendaItemSchema = new Schema(
  {
    startTime: { type: String, required: true, trim: true }, // "09:30"
    endTime: { type: String, trim: true, default: '' }, // "10:15"
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    speakerNames: [{ type: String, trim: true }],
    track: { type: String, trim: true, default: '' }, // Hall A / Workshop
    type: {
      type: String,
      enum: ['session', 'keynote', 'panel', 'workshop', 'break', 'registration', 'networking', 'other'],
      default: 'session',
    },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const AgendaDaySchema = new Schema(
  {
    date: { type: Date, required: true },
    label: { type: String, trim: true, default: '' }, // "Day 1 - Clinical Track"
    items: [AgendaItemSchema],
  },
  { _id: true }
);

const CommitteeMemberSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, trim: true, default: '' }, // e.g. "Organising Chairperson"
    group: {
      type: String,
      enum: ['leadership', 'scientific', 'organising'],
      default: 'organising',
    },
    photoUrl: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const SponsorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    logoUrl: { type: String, trim: true, default: '' },
    websiteUrl: { type: String, trim: true, default: '' },
    tier: {
      type: String,
      enum: ['title', 'platinum', 'gold', 'silver', 'bronze', 'partner'],
      default: 'partner',
    },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const FaqSchema = new Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const AnnouncementSchema = new Schema(
  {
    message: { type: String, required: true, trim: true },
    level: { type: String, enum: ['info', 'success', 'warning'], default: 'info' },
    isActive: { type: Boolean, default: true },
    publishedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
  },
  { _id: true }
);

const VenueSchema = new Schema(
  {
    name: { type: String, trim: true, default: '' },
    addressLine1: { type: String, trim: true, default: '' },
    addressLine2: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    landmark: { type: String, trim: true, default: '' },
    mapEmbedUrl: { type: String, trim: true, default: '' },
    mapLink: { type: String, trim: true, default: '' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    parkingInfo: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const ContactSchema = new Schema(
  {
    name: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    whatsapp: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
  },
  { _id: false }
);

const SeoSchema = new Schema(
  {
    metaTitle: { type: String, trim: true, default: '', maxlength: 70 },
    metaDescription: { type: String, trim: true, default: '', maxlength: 200 },
    keywords: [{ type: String, trim: true }],
    ogImageUrl: { type: String, trim: true, default: '' },
    canonicalUrl: { type: String, trim: true, default: '' },
    noIndex: { type: Boolean, default: false },
  },
  { _id: false }
);

const ThemeSchema = new Schema(
  {
    primaryColor: { type: String, trim: true, default: '#96291F' },
    accentColor: { type: String, trim: true, default: '#96291F' },
    heroImageUrl: { type: String, trim: true, default: '' },
    logoUrl: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

/* -------------------------------------------------------------------------- */
/* Main schema                                                                */
/* -------------------------------------------------------------------------- */

const EventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, unique: true, index: true, lowercase: true, trim: true },
    tagline: { type: String, trim: true, default: '', maxlength: 220 },
    summary: { type: String, trim: true, default: '', maxlength: 600 },
    description: { type: String, trim: true, default: '' }, // long form / rich text

    category: {
      type: String,
      enum: ['cme', 'conference', 'workshop', 'awareness-camp', 'public-seminar', 'other'],
      default: 'conference',
    },
    mode: { type: String, enum: ['in-person', 'virtual', 'hybrid'], default: 'in-person' },

    status: {
      type: String,
      enum: ['draft', 'published', 'registration-closed', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },

    startDate: { type: Date, required: true, index: true },
    endDate: {
      type: Date,
      required: true,
      // Path validator rather than a hook: this runs under validateSync() and
      // update validators too, not just on save().
      validate: {
        validator: function endsAfterStart(value) {
          if (!this || typeof this.get !== 'function') return true; // query-update context
          const start = this.get('startDate');
          if (!start || !value) return true;
          return value >= start;
        },
        message: 'endDate must be on or after startDate',
      },
    },
    timezone: { type: String, default: 'Asia/Kolkata' },

    registrationOpensAt: { type: Date, default: null },
    registrationClosesAt: {
      type: Date,
      default: null,
      validate: {
        validator: function closesAfterOpens(value) {
          if (!this || typeof this.get !== 'function') return true;
          const opens = this.get('registrationOpensAt');
          if (!opens || !value) return true;
          return value >= opens;
        },
        message: 'registrationClosesAt must be after registrationOpensAt',
      },
    },

    capacity: { type: Number, default: 0, min: 0 }, // 0 = unlimited
    registeredCount: { type: Number, default: 0, min: 0 },

    organizer: {
      name: { type: String, trim: true, default: 'Prashanth Hospitals' },
      department: { type: String, trim: true, default: 'Fertility & Gynaecology' },
      logoUrl: { type: String, trim: true, default: '' },
      websiteUrl: { type: String, trim: true, default: '' },
    },

    venue: { type: VenueSchema, default: () => ({}) },
    virtualLink: { type: String, trim: true, default: '' },

    speakers: [SpeakerSchema],
    committee: [CommitteeMemberSchema],
    agenda: [AgendaDaySchema],
    sponsors: [SponsorSchema],
    faqs: [FaqSchema],
    announcements: [AnnouncementSchema],
    highlights: [{ type: String, trim: true }], // "6 CME credit points"

    contact: { type: ContactSchema, default: () => ({}) },
    seo: { type: SeoSchema, default: () => ({}) },
    theme: { type: ThemeSchema, default: () => ({}) },

    isFeatured: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* -------------------------------------------------------------------------- */
/* Virtuals                                                                   */
/* -------------------------------------------------------------------------- */

EventSchema.virtual('isSoldOut').get(function isSoldOut() {
  if (!this.capacity || this.capacity === 0) return false;
  return this.registeredCount >= this.capacity;
});

EventSchema.virtual('seatsRemaining').get(function seatsRemaining() {
  if (!this.capacity || this.capacity === 0) return null; // unlimited
  return Math.max(this.capacity - this.registeredCount, 0);
});

EventSchema.virtual('isUpcoming').get(function isUpcoming() {
  return this.startDate instanceof Date && this.startDate.getTime() > Date.now();
});

/**
 * Single source of truth for "can someone register right now?".
 * Registration/ticketing modules reuse this rather than re-deriving the rules.
 */
EventSchema.virtual('registrationState').get(function registrationState() {
  const now = Date.now();

  if (this.status === 'cancelled') return 'cancelled';
  if (this.status === 'completed') return 'completed';
  if (this.status === 'registration-closed') return 'closed';
  if (this.status !== 'published') return 'unavailable';
  if (this.endDate instanceof Date && this.endDate.getTime() < now) return 'completed';
  if (this.registrationOpensAt && this.registrationOpensAt.getTime() > now) return 'not-yet-open';
  if (this.registrationClosesAt && this.registrationClosesAt.getTime() < now) return 'closed';
  if (this.capacity > 0 && this.registeredCount >= this.capacity) return 'sold-out';

  return 'open';
});

EventSchema.virtual('activeAnnouncements').get(function activeAnnouncements() {
  const now = Date.now();
  return (this.announcements || []).filter(
    (a) => a.isActive && (!a.expiresAt || a.expiresAt.getTime() > now)
  );
});

/* -------------------------------------------------------------------------- */
/* Hooks                                                                      */
/* -------------------------------------------------------------------------- */

EventSchema.pre('validate', function generateSlug(next) {
  if (!this.slug && this.title) {
    this.slug = slugify(this.title, { lower: true, strict: true, trim: true }).slice(0, 90);
  }
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

/**
 * Slug/publishedAt derivation, callable directly so code paths that bypass
 * document middleware (findOneAndUpdate, bulk imports) stay consistent.
 */
EventSchema.statics.deriveFields = function deriveFields(doc) {
  const next = { ...doc };
  if (!next.slug && next.title) {
    next.slug = slugify(next.title, { lower: true, strict: true, trim: true }).slice(0, 90);
  }
  if (next.status === 'published' && !next.publishedAt) {
    next.publishedAt = new Date();
  }
  return next;
};

/* -------------------------------------------------------------------------- */
/* Indexes                                                                    */
/* -------------------------------------------------------------------------- */

EventSchema.index({ status: 1, startDate: -1 });
EventSchema.index({ title: 'text', tagline: 'text', summary: 'text' });

/* -------------------------------------------------------------------------- */
/* Statics                                                                    */
/* -------------------------------------------------------------------------- */

EventSchema.statics.findPublishedBySlug = function findPublishedBySlug(slug) {
  return this.findOne({
    slug: String(slug || '').toLowerCase().trim(),
    status: { $in: ['published', 'registration-closed', 'completed'] },
  });
};

module.exports = mongoose.model('Event', EventSchema);
