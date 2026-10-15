'use strict';

const TicketType = require('../models/TicketType');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const ApiError = require('../utils/ApiError');
const { sendSuccess, asyncHandler } = require('../utils/response');
const { serializeTicketTypeForAdmin } = require('../services/adminTicketTypeSerializer');
const { recordAudit } = require('../services/auditLog');

const EDITABLE_FIELDS = [
  'name',
  'code',
  'description',
  'kind',
  'price',
  'currency',
  'taxPercent',
  'admitsCount',
  'quantityTotal',
  'minPerOrder',
  'maxPerOrder',
  'salesStartAt',
  'salesEndAt',
  'benefits',
  'isPubliclyVisible',
  'isActive',
  'requiresApproval',
  'allowedParticipantTypes',
  'order',
];

function applyEditableFields(ticket, body) {
  for (const field of EDITABLE_FIELDS) {
    if (field in body) ticket[field] = body[field];
  }
}

async function findOr404(id) {
  const ticket = await TicketType.findById(id);
  if (!ticket) throw ApiError.notFound('Ticket type not found');
  return ticket;
}

/** GET /api/v1/admin/ticket-types?event=<eventId> */
const listTicketTypes = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.event) filter.event = String(req.query.event);
  const tickets = await TicketType.find(filter).sort({ event: 1, order: 1, price: 1 });
  return sendSuccess(res, tickets.map(serializeTicketTypeForAdmin));
});

/** POST /api/v1/admin/ticket-types */
const createTicketType = asyncHandler(async (req, res) => {
  const { event: eventId } = req.body;
  if (!eventId) throw ApiError.badRequest('An "event" id is required.');
  const event = await Event.findById(eventId).select('_id');
  if (!event) throw ApiError.notFound('Event not found');

  const ticket = new TicketType({ event: eventId });
  applyEditableFields(ticket, req.body || {});
  await ticket.save();
  recordAudit(req, { action: 'ticketType.create', entityType: 'TicketType', entityId: ticket._id, meta: { name: ticket.name } });
  return sendSuccess(res, serializeTicketTypeForAdmin(ticket), { status: 201 });
});

/** PATCH /api/v1/admin/ticket-types/:id */
const updateTicketType = asyncHandler(async (req, res) => {
  const ticket = await findOr404(req.params.id);
  applyEditableFields(ticket, req.body || {});
  await ticket.save();
  recordAudit(req, { action: 'ticketType.update', entityType: 'TicketType', entityId: ticket._id, meta: { fields: Object.keys(req.body || {}) } });
  return sendSuccess(res, serializeTicketTypeForAdmin(ticket));
});

/** DELETE /api/v1/admin/ticket-types/:id — only before anyone has bought one. */
const deleteTicketType = asyncHandler(async (req, res) => {
  const ticket = await findOr404(req.params.id);
  if (ticket.quantitySold > 0 || (await Registration.exists({ ticketType: ticket._id }))) {
    throw ApiError.conflict('This pass has registrations against it. Deactivate it instead of deleting.');
  }
  await ticket.deleteOne();
  recordAudit(req, { action: 'ticketType.delete', entityType: 'TicketType', entityId: ticket._id, meta: { name: ticket.name } });
  return sendSuccess(res, null, { status: 200, message: 'Ticket type deleted' });
});

module.exports = { listTicketTypes, createTicketType, updateTicketType, deleteTicketType };
