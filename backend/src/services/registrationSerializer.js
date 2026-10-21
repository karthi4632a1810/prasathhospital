'use strict';

function deliverySummary(reg) {
  const d = reg.delivery || {};
  return {
    email: d.email?.status || 'pending',
    whatsapp: d.whatsapp?.status || 'pending',
  };
}

/**
 * Returned to the attendee right after they register — their own data only.
 * The qrToken is included because it is *their* ticket link; delivery
 * errors and provider ids stay admin-only.
 */
function serializeRegistrationForPublic(reg, { event, ticketType, company } = {}) {
  const att = reg.attendee || {};
  return {
    registrationCode: reg.registrationCode,
    status: reg.status,
    attendee: {
      name: att.name,
      title: att.title || '',
      firstName: att.firstName || '',
      lastName: att.lastName || '',
      gender: att.gender || '',
      email: att.email,
      phone: att.phone,
      medicalCouncilRegNo: att.medicalCouncilRegNo || '',
      institution: att.institution || '',
      designation: att.designation || '',
      address: att.address || '',
      country: att.country || 'India',
      state: att.state || '',
      city: att.city || '',
      pincode: att.pincode || '',
      category: att.category || '',
      registrationCategory: att.registrationCategory || '',
      workshop: att.workshop || '',
      accompanyingPerson: att.accompanyingPerson || { hasAccompanyingPerson: false, name: '' },
    },
    company: company ? { name: company.name } : null,
    couponCode: reg.couponCode || '',
    pricing: reg.pricing,
    qrToken: reg.qrToken || null,
    event: event ? { title: event.title, slug: event.slug, startDate: event.startDate, endDate: event.endDate } : undefined,
    ticketType: ticketType ? { name: ticketType.name } : undefined,
    delivery: deliverySummary(reg),
    createdAt: reg.createdAt,
  };
}

/** Admin sees everything, plus the joined event/ticket-type/company/coupon summaries when populated. */
function serializeRegistrationForAdmin(reg) {
  const obj = reg.toObject({ virtuals: true });
  return {
    ...obj,
    id: obj._id,
    event: reg.event && reg.event.title ? { id: reg.event._id, title: reg.event.title, slug: reg.event.slug } : obj.event,
    ticketType: reg.ticketType && reg.ticketType.name
      ? { id: reg.ticketType._id, name: reg.ticketType.name, code: reg.ticketType.code }
      : obj.ticketType,
    company: reg.company && reg.company.name ? { id: reg.company._id, name: reg.company.name } : obj.company,
    coupon: reg.coupon && reg.coupon.code ? { id: reg.coupon._id, code: reg.coupon.code } : obj.coupon,
    delivery: {
      email: { status: 'pending', attempts: 0, ...(obj.delivery?.email || {}) },
      whatsapp: { status: 'pending', attempts: 0, ...(obj.delivery?.whatsapp || {}) },
    },
    deliveryLog: obj.deliveryLog || [],
    qrStatus: !reg.qrToken ? 'not issued' : reg.status === 'confirmed' ? 'active' : 'void',
  };
}

module.exports = { serializeRegistrationForPublic, serializeRegistrationForAdmin, deliverySummary };
