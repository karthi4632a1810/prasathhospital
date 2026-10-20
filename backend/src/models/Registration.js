'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');

const { Schema } = mongoose;

const AttendeeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    title: { type: String, trim: true, default: '' },
    firstName: { type: String, trim: true, default: '' },
    lastName: { type: String, trim: true, default: '' },
    gender: { type: String, trim: true, default: '' },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    institution: { type: String, trim: true, default: '' },
    designation: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: 'India' },
    state: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    registrationCategory: { type: String, trim: true, default: '' },
    workshop: { type: String, trim: true, default: '' },
    accompanyingPerson: {
      hasAccompanyingPerson: { type: Boolean, default: false },
      name: { type: String, trim: true, default: '' },
    },
    // Legacy: the coupon flow no longer asks for this. Kept so historical
    // registrations still load and export unchanged.
    participantType: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const PricingSchema = new Schema(
  {
    basePrice: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
  },
  { _id: false }
);

const DELIVERY_STATUSES = ['pending', 'sent', 'failed', 'retryable', 'not_configured'];

/** Current state of one delivery channel (email or WhatsApp). */
const DeliveryChannelSchema = new Schema(
  {
    status: { type: String, enum: DELIVERY_STATUSES, default: 'pending' },
    attempts: { type: Number, default: 0, min: 0 },
    lastAttemptAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    error: { type: String, default: '' },
    providerMessageId: { type: String, default: '' },
  },
  { _id: false }
);

/** One row per send attempt — the history admins see when diagnosing a failure. */
const DeliveryAttemptSchema = new Schema(
  {
    channel: { type: String, enum: ['email', 'whatsapp'], required: true },
    status: { type: String, enum: DELIVERY_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    error: { type: String, default: '' },
    providerMessageId: { type: String, default: '' },
    trigger: { type: String, enum: ['auto', 'admin'], default: 'auto' },
    actorName: { type: String, default: '' },
  },
  { _id: false }
);

/**
 * One attendee's registration for one pass. The ticket (QR/PDF), delivery
 * and check-in all key off this document.
 *
 * Since the coupon flow, every new registration is created `confirmed` at
 * ₹0 with a coupon + company attached. `pending_payment`/`refunded` and the
 * `payment`/`promoCode` refs stay in the schema only so registrations made
 * under the old paid flow still load.
 */
const RegistrationSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    ticketType: { type: Schema.Types.ObjectId, ref: 'TicketType', required: true },

    attendee: { type: AttendeeSchema, required: true },
    coupon: { type: Schema.Types.ObjectId, ref: 'Coupon', default: null, index: true },
    company: { type: Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    couponCode: { type: String, default: '' }, // snapshot, survives coupon edits
    pricing: { type: PricingSchema, required: true },

    status: {
      type: String,
      enum: ['pending_payment', 'confirmed', 'cancelled', 'refunded'],
      default: 'confirmed',
      index: true,
    },

    // Legacy refs from the retired paid flow (read-only history).
    promoCode: { type: Schema.Types.ObjectId, ref: 'PromoCode', default: null },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },

    registrationCode: { type: String, unique: true, index: true },
    qrToken: { type: String, unique: true, sparse: true, index: true },

    // Client-generated per form session, so a double-clicked or retried
    // submit returns the first registration instead of creating a second.
    idempotencyKey: { type: String, unique: true, sparse: true },
    // `${event}:${email}` while the registration is active, unset on
    // cancel. The unique index makes "one active registration per email
    // per event" hold even under concurrent submits.
    activeKey: { type: String, unique: true, sparse: true },

    delivery: {
      email: { type: DeliveryChannelSchema, default: () => ({}) },
      whatsapp: { type: DeliveryChannelSchema, default: () => ({}) },
    },
    deliveryLog: { type: [DeliveryAttemptSchema], default: [] },

    checkedInAt: { type: Date, default: null },
    checkedInBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    certificateIssuedAt: { type: Date, default: null },

    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    cancellationReason: { type: String, trim: true, default: '' },

    campaignSource: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

RegistrationSchema.index({ event: 1, status: 1 });
RegistrationSchema.index({ event: 1, createdAt: -1 });
RegistrationSchema.index({ 'attendee.email': 1 });
RegistrationSchema.index({ 'attendee.phone': 1 });
RegistrationSchema.index({ 'delivery.email.status': 1 });
RegistrationSchema.index({ 'delivery.whatsapp.status': 1 });

RegistrationSchema.statics.DELIVERY_STATUSES = DELIVERY_STATUSES;

RegistrationSchema.statics.activeKeyFor = function activeKeyFor(eventId, email) {
  return `${String(eventId)}:${String(email).trim().toLowerCase()}`;
};

RegistrationSchema.virtual('isFree').get(function isFree() {
  return this.pricing.totalAmount === 0;
});

RegistrationSchema.pre('validate', function assignCodesOnCreate(next) {
  if (this.isNew && !this.registrationCode) {
    this.registrationCode = `REG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  next();
});

/** Generates the ticket's scan token (48 hex chars of CSPRNG output). Called once, at confirmation. */
RegistrationSchema.methods.issueQrToken = function issueQrToken() {
  this.qrToken = crypto.randomBytes(24).toString('hex');
  return this.qrToken;
};

module.exports = mongoose.model('Registration', RegistrationSchema);
