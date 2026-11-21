'use strict';

const crypto = require('crypto');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const env = require('../config/env');
const Registration = require('../models/Registration');
const TicketType = require('../models/TicketType');
const Event = require('../models/Event');
const logger = require('../utils/logger');
const { generateCertificateBuffer } = require('../utils/certificateGenerator');
const { generateIdCardImageBuffer, generateIdCardPdfBuffer } = require('../utils/idCardPdf');

// Temporary in-memory store for generated downloads
const fileStore = new Map();

// Auto-cleanup files older than 2 hours
setInterval(() => {
  const now = Date.now();
  for (const [id, item] of fileStore.entries()) {
    if (now - item.createdAt > 2 * 60 * 60 * 1000) {
      fileStore.delete(id);
    }
  }
}, 10 * 60 * 1000).unref();

function saveFileToStore(buffer, filename, contentType, metadata = {}) {
  const fileId = `dl_${crypto.randomBytes(8).toString('hex')}`;
  fileStore.set(fileId, {
    buffer,
    filename,
    contentType,
    createdAt: Date.now(),
    ...metadata,
  });
  return fileId;
}

function getFileFromStore(fileId) {
  return fileStore.get(fileId);
}

/* -------------------------------------------------------------------------- */
/* Tool Execution Implementations                                             */
/* -------------------------------------------------------------------------- */

function resolveRecordColumn(r, colKey, idx) {
  const k = String(colKey || '').toLowerCase().trim();
  const attendee = r.attendee || {};
  const isCheckedIn = Boolean(
    r.checkedIn ||
    r.checkedInAt ||
    (r.checkins && r.checkins.length > 0) ||
    (r.checkinLocations && r.checkinLocations.length > 0)
  );

  if (k === 's.no' || k === 'sl.no' || k === 'sl no' || k === 'no' || k === '#') {
    return idx + 1;
  }
  if (k.includes('id card') || k.includes('badge') || k === 'card no' || k === 'id no') {
    return r.badgeNo || (r.registrationCode ? r.registrationCode.replace('REG-', '') : String(idx + 1).padStart(4, '0'));
  }
  if (k.includes('name') || k.includes('doctor') || k.includes('delegate')) {
    return attendee.name || 'Delegate';
  }
  if (k.includes('email') || k.includes('mail')) {
    return attendee.email || '';
  }
  if (k.includes('phone') || k.includes('mobile') || k.includes('contact') || k.includes('whatsapp')) {
    return attendee.phone || '';
  }
  if (k.includes('tnmc') || k.includes('council')) {
    return attendee.medicalCouncilRegNo || 'N/A';
  }
  if (k.includes('pass') || k.includes('ticket') || k.includes('category') || k.includes('role')) {
    return attendee.category || attendee.registrationCategory || r.ticketType?.name || 'Delegate';
  }
  if (k.includes('lunch') || k.includes('food')) {
    const hasLunch = Boolean(
      (r.checkins && r.checkins.some((c) => /lunch|food/i.test(c.locationCode || '') || /lunch|food/i.test(c.locationName || ''))) ||
      (r.checkinLocations && r.checkinLocations.some((c) => /lunch|food/i.test(c.locationCode || '') || /lunch|food/i.test(c.locationName || '')))
    );
    return hasLunch ? 'Checked-in' : 'Not Checked-in';
  }
  if (k.includes('check') && k.includes('time')) {
    const checkinDate = r.checkedInAt || (r.checkins && r.checkins[0]?.checkedInAt);
    if (!checkinDate) return 'N/A';
    try {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(checkinDate));
    } catch {
      return new Date(checkinDate).toLocaleString();
    }
  }
  if (k.includes('counter') || k.includes('location') || k.includes('desk') || k.includes('checkpoint')) {
    if (r.checkins && r.checkins.length > 0) {
      return r.checkins.map((c) => c.locationName || c.locationCode).filter(Boolean).join(', ');
    }
    if (r.checkinLocations && r.checkinLocations.length > 0) {
      return r.checkinLocations.map((c) => c.locationName || c.locationCode).filter(Boolean).join(', ');
    }
    return isCheckedIn ? 'Main Entry Desk' : 'N/A';
  }
  if (k.includes('status') || (k.includes('check') && !k.includes('time'))) {
    return isCheckedIn ? 'Checked-in' : 'Pending';
  }
  if (k.includes('institution') || k.includes('college') || k.includes('hospital') || k.includes('workplace')) {
    return attendee.institution || '';
  }
  if (k.includes('city')) {
    return attendee.city || '';
  }
  if (k.includes('state')) {
    return attendee.state || '';
  }
  if (k.includes('designation')) {
    return attendee.designation || 'Doctor';
  }
  if (k.includes('code') || k.includes('reg code') || k.includes('registration code')) {
    return r.registrationCode || '';
  }
  if (k.includes('date') || k.includes('created')) {
    return r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '';
  }

  // Dynamic property fallback
  return attendee[colKey] !== undefined ? attendee[colKey] : (r[colKey] !== undefined ? r[colKey] : '-');
}

function generateTablePdf({ title, subtitle, columns, rows }) {
  return new Promise((resolve, reject) => {
    const isLandscape = columns.length > 5;
    const doc = new PDFDocument({
      size: 'A4',
      layout: isLandscape ? 'landscape' : 'portrait',
      margins: { top: 32, bottom: 32, left: 32, right: 32 },
      bufferPages: true,
    });

    const buffers = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const leftMargin = 32;
    const rightMargin = 32;
    const contentWidth = pageWidth - leftMargin - rightMargin;

    // Header banner
    doc.rect(leftMargin, 32, contentWidth, 50).fill('#381b4e');
    doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold').text(title, leftMargin + 14, 42);
    doc.fillColor('#f8d7e3').fontSize(8.5).font('Helvetica').text(subtitle, leftMargin + 14, 60);

    let y = 96;

    // Column Weights
    const weights = columns.map((col) => {
      const c = col.toLowerCase();
      if (c === 's.no' || c === 'sl.no' || c === '#' || c === 'no') return 0.6;
      if (c.includes('id card') || c.includes('badge')) return 1.1;
      if (c.includes('code')) return 1.1;
      if (c.includes('status') || c.includes('checkin') || c.includes('lunch')) return 1.1;
      if (c.includes('phone') || c.includes('mobile')) return 1.2;
      if (c.includes('tnmc')) return 1.1;
      if (c.includes('name')) return 1.8;
      if (c.includes('email')) return 2.0;
      if (c.includes('institution') || c.includes('college') || c.includes('hospital')) return 1.8;
      return 1.2;
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const colWidths = weights.map((w) => (w / totalWeight) * contentWidth);

    function drawTableHeader() {
      doc.rect(leftMargin, y, contentWidth, 22).fill('#eb3f67');
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
      let curX = leftMargin;
      columns.forEach((col, idx) => {
        const w = colWidths[idx];
        doc.text(col, curX + 5, y + 6, { width: w - 10, ellipsis: true });
        curX += w;
      });
      y += 22;
    }

    drawTableHeader();

    // Rows
    doc.font('Helvetica').fontSize(8);
    rows.forEach((row, rowIdx) => {
      if (y + 20 > pageHeight - 40) {
        doc.addPage();
        y = 36;
        drawTableHeader();
      }

      const rowHeight = 18;
      if (rowIdx % 2 === 1) {
        doc.rect(leftMargin, y, contentWidth, rowHeight).fill('#fcf8fa');
      }
      doc.rect(leftMargin, y, contentWidth, rowHeight).strokeColor('#eedde6').lineWidth(0.5).stroke();

      doc.fillColor('#231238');
      let curX = leftMargin;
      columns.forEach((col, idx) => {
        const w = colWidths[idx];
        const val = String(row[col] ?? '-');
        doc.text(val, curX + 5, y + 5, { width: w - 10, ellipsis: true });
        curX += w;
      });
      y += rowHeight;
    });

    // Page Numbers in Footer
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fillColor('#886e9c').fontSize(7.5).font('Helvetica');
      doc.text(
        `CIIM 2026 Admin Report • Prashanth Fertility Research Centre • Page ${i + 1} of ${totalPages}`,
        leftMargin,
        pageHeight - 24,
        { width: contentWidth, align: 'center' }
      );
    }

    doc.end();
  });
}

function generateCsvBuffer(rows, columns) {
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };
  const headerLine = columns.map(escapeCell).join(',');
  const lines = rows.map((row) => columns.map((col) => escapeCell(row[col])).join(','));
  return Buffer.from([headerLine, ...lines].join('\r\n'), 'utf-8');
}

function generateExcelBuffer(rows, columns, sheetName = 'CIIM2026_Data') {
  const defaultHeaders = columns || (rows.length > 0 ? Object.keys(rows[0]) : ['Data']);
  const ws = rows.length > 0 ? XLSX.utils.json_to_sheet(rows, { header: defaultHeaders }) : XLSX.utils.aoa_to_sheet([defaultHeaders]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function toolExportData({
  category,
  hasTnmc,
  checkedIn,
  locationCode,
  searchQuery,
  columns = [],
  reportTitle,
}) {
  const query = { status: { $ne: 'cancelled' } };
  const andClauses = [];

  if (category) {
    if (/pg\s*student|resident|\bpg\b/i.test(category)) {
      andClauses.push({
        $or: [
          { 'attendee.category': /pg\s*student|resident/i },
          { 'attendee.registrationCategory': /pg\s*student|resident/i },
          { 'attendee.participantType': /pg\s*student|resident/i },
          { 'attendee.designation': /pg\s*student|resident/i },
        ],
      });
    } else {
      andClauses.push({ 'attendee.category': new RegExp(category, 'i') });
    }
  }

  if (hasTnmc === true) {
    andClauses.push({ 'attendee.medicalCouncilRegNo': { $exists: true, $nin: ['', null, 'NA', 'N/A', '-'] } });
  } else if (hasTnmc === false) {
    andClauses.push({
      $or: [
        { 'attendee.medicalCouncilRegNo': { $exists: false } },
        { 'attendee.medicalCouncilRegNo': '' },
        { 'attendee.medicalCouncilRegNo': null },
        { 'attendee.medicalCouncilRegNo': 'NA' },
        { 'attendee.medicalCouncilRegNo': 'N/A' },
        { 'attendee.medicalCouncilRegNo': '-' },
      ],
    });
  }

  if (checkedIn === true) {
    andClauses.push({
      $or: [
        { checkedIn: true },
        { checkedInAt: { $ne: null } },
        { 'checkins.0': { $exists: true } },
        { 'checkinLocations.0': { $exists: true } },
      ],
    });
  } else if (checkedIn === false) {
    andClauses.push({
      checkedIn: { $ne: true },
      checkedInAt: null,
      'checkins.0': { $exists: false },
      'checkinLocations.0': { $exists: false },
    });
  }

  if (locationCode && locationCode.trim()) {
    const locRx = new RegExp(locationCode.trim(), 'i');
    andClauses.push({
      $or: [
        { 'checkins.locationCode': locRx },
        { 'checkins.locationName': locRx },
        { 'checkinLocations.locationCode': locRx },
        { 'checkinLocations.locationName': locRx },
      ],
    });
  }

  if (searchQuery && searchQuery.trim()) {
    const rx = new RegExp(searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    andClauses.push({
      $or: [
        { 'attendee.name': rx },
        { 'attendee.email': rx },
        { 'attendee.phone': rx },
        { registrationCode: rx },
        { badgeNo: rx },
        { 'attendee.medicalCouncilRegNo': rx },
        { 'attendee.institution': rx },
      ],
    });
  }

  if (andClauses.length > 0) {
    query.$and = andClauses;
  }

  const registrations = await Registration.find(query)
    .populate('ticketType', 'name')
    .sort({ createdAt: 1 })
    .lean();

  // Determine headers
  let resolvedHeaders = [];
  if (columns && columns.length > 0) {
    resolvedHeaders = [...columns];
    if (!resolvedHeaders.some((h) => /^s\.?no$|^sl\.?no$/i.test(h.trim()))) {
      resolvedHeaders.unshift('S.No');
    }
  } else {
    resolvedHeaders = [
      'S.No',
      'ID Card Number',
      'Delegate Name',
      'Email',
      'Phone',
      'Category',
      'Check-in Status',
    ];
  }

  const rows = registrations.map((r, idx) => {
    const row = {};
    resolvedHeaders.forEach((h) => {
      row[h] = resolveRecordColumn(r, h, idx);
    });
    return row;
  });

  // Descriptive title and filename
  let baseName = 'CIIM2026';
  let title = reportTitle || 'CIIM 2026 Data Export Report';
  let subtitleTags = [];

  if (category) {
    const cleanCat = category.replace(/[^a-zA-Z0-9]/g, '_');
    baseName += `_${cleanCat}`;
    subtitleTags.push(`Category: ${category}`);
  }
  if (checkedIn === true) {
    baseName += '_CheckedIn';
    subtitleTags.push('Status: Checked-in Only');
  } else if (checkedIn === false) {
    baseName += '_NotCheckedIn';
    subtitleTags.push('Status: Not Checked-in');
  }
  if (hasTnmc === true) {
    baseName += '_TNMC';
    subtitleTags.push('TNMC: Registered Only');
  } else if (hasTnmc === false) {
    baseName += '_NonTNMC';
    subtitleTags.push('TNMC: Non-TNMC');
  }
  if (locationCode) {
    baseName += `_${locationCode.replace(/[^a-zA-Z0-9]/g, '_')}`;
    subtitleTags.push(`Checkpoint: ${locationCode}`);
  }

  subtitleTags.push(`Total: ${rows.length} Records`);
  subtitleTags.push(
    `Generated: ${new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })}`
  );

  const subtitle = subtitleTags.join(' • ');

  // Generate buffers
  const [pdfBuf, csvBuf, xlsxBuf] = await Promise.all([
    generateTablePdf({ title, subtitle, columns: resolvedHeaders, rows }),
    Promise.resolve(generateCsvBuffer(rows, resolvedHeaders)),
    Promise.resolve(generateExcelBuffer(rows, resolvedHeaders, 'Exported_Data')),
  ]);

  const pdfFileId = saveFileToStore(pdfBuf, `${baseName}.pdf`, 'application/pdf', {
    rowCount: rows.length,
    columns: resolvedHeaders,
  });

  const csvFileId = saveFileToStore(csvBuf, `${baseName}.csv`, 'text/csv; charset=utf-8', {
    rowCount: rows.length,
    columns: resolvedHeaders,
  });

  const xlsxFileId = saveFileToStore(
    xlsxBuf,
    `${baseName}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    {
      rowCount: rows.length,
      columns: resolvedHeaders,
    }
  );

  return {
    rowCount: rows.length,
    columnsIncluded: resolvedHeaders,
    samplePreview: rows.slice(0, 5),
    title,
    downloads: [
      {
        format: 'pdf',
        label: 'Download PDF Report',
        filename: `${baseName}.pdf`,
        url: `/api/v1/admin/ai/download/export/${pdfFileId}`,
        fileId: pdfFileId,
      },
      {
        format: 'csv',
        label: 'Download CSV File',
        filename: `${baseName}.csv`,
        url: `/api/v1/admin/ai/download/export/${csvFileId}`,
        fileId: csvFileId,
      },
      {
        format: 'xlsx',
        label: 'Download Excel (.XLSX)',
        filename: `${baseName}.xlsx`,
        url: `/api/v1/admin/ai/download/export/${xlsxFileId}`,
        fileId: xlsxFileId,
      },
    ],
    excelDownload: {
      fileId: xlsxFileId,
      filename: `${baseName}.xlsx`,
      url: `/api/v1/admin/ai/download/export/${xlsxFileId}`,
      rowCount: rows.length,
      columns: resolvedHeaders,
    },
  };
}

async function toolExportExcel({ hasTnmc, checkedIn, searchQuery, columns = [] }) {
  return toolExportData({ hasTnmc, checkedIn, searchQuery, columns });
}

async function toolCheckStats() {
  const [total, confirmed, cancelled, checkedIn, withTnmc] = await Promise.all([
    Registration.countDocuments(),
    Registration.countDocuments({ status: 'confirmed' }),
    Registration.countDocuments({ status: 'cancelled' }),
    Registration.countDocuments({
      status: 'confirmed',
      $or: [{ checkedIn: true }, { 'checkinLocations.0': { $exists: true } }],
    }),
    Registration.countDocuments({
      status: 'confirmed',
      'attendee.medicalCouncilRegNo': { $exists: true, $nin: ['', null] },
    }),
  ]);

  return {
    totalRegistrations: total,
    confirmedRegistrations: confirmed,
    cancelledRegistrations: cancelled,
    checkedInCount: checkedIn,
    tnmcDoctorsCount: withTnmc,
    nonTnmcCount: Math.max(0, confirmed - withTnmc),
    checkInRate: confirmed > 0 ? `${Math.round((checkedIn / confirmed) * 100)}%` : '0%',
  };
}

async function toolSearchRegistrations({ q = '', hasTnmc, checkedIn, limit = 25 }) {
  const query = { status: { $ne: 'cancelled' } };

  if (hasTnmc === true) {
    query['attendee.medicalCouncilRegNo'] = { $exists: true, $nin: ['', null] };
  } else if (hasTnmc === false) {
    query.$or = [
      { 'attendee.medicalCouncilRegNo': { $exists: false } },
      { 'attendee.medicalCouncilRegNo': '' },
      { 'attendee.medicalCouncilRegNo': null },
    ];
  }

  if (checkedIn === true) {
    query.$or = [{ checkedIn: true }, { 'checkinLocations.0': { $exists: true } }];
  } else if (checkedIn === false) {
    query.checkedIn = { $ne: true };
    query['checkinLocations.0'] = { $exists: false };
  }

  if (q && q.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { 'attendee.name': rx },
        { 'attendee.email': rx },
        { 'attendee.phone': rx },
        { registrationCode: rx },
        { 'attendee.medicalCouncilRegNo': rx },
      ],
    });
  }

  const results = await Registration.find(query)
    .populate('ticketType', 'name')
    .sort({ createdAt: 1 })
    .limit(Math.min(limit, 100))
    .lean();

  return {
    count: results.length,
    results: results.map((r, i) => ({
      index: i + 1,
      id: r._id,
      code: r.registrationCode,
      name: r.attendee?.name || 'Delegate',
      phone: r.attendee?.phone || '',
      email: r.attendee?.email || '',
      tnmc: r.attendee?.medicalCouncilRegNo || 'N/A',
      ticketType: r.ticketType?.name || 'Delegate Pass',
      checkedIn: Boolean(r.checkedIn || (r.checkinLocations && r.checkinLocations.length > 0)),
      badgeNo: r.badgeNo || '',
    })),
  };
}



async function toolCreateRegistration(data) {
  const event = (await Event.findOne({ status: { $ne: 'draft' } })) || (await Event.findOne());
  if (!event) throw new Error('No active event found.');

  const ticket = (await TicketType.findOne({ event: event._id })) || (await TicketType.findOne());

  const count = await Registration.countDocuments({ event: event._id });
  const code = `REG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const badgeNo = String(count + 1).padStart(4, '0');

  const reg = await Registration.create({
    event: event._id,
    ticketType: ticket?._id,
    registrationCode: code,
    badgeNo,
    status: 'confirmed',
    attendee: {
      name: data.name?.trim() || 'Delegate',
      email: (data.email || 'delegate@example.com').trim().toLowerCase(),
      phone: (data.phone || '9999999999').trim(),
      medicalCouncilRegNo: data.medicalCouncilRegNo || '',
      institution: data.institution || '',
      designation: data.designation || 'Doctor',
      category: data.category || 'General',
    },
    pricing: {
      basePrice: 0,
      totalAmount: 0,
    },
  });

  return {
    success: true,
    registrationCode: reg.registrationCode,
    badgeNo: reg.badgeNo,
    name: reg.attendee.name,
    email: reg.attendee.email,
    phone: reg.attendee.phone,
    tnmc: reg.attendee.medicalCouncilRegNo,
  };
}

async function toolUpdateRegistration({ idOrCode, name, email, phone, medicalCouncilRegNo, institution }) {
  const query = {};
  if (/^[0-9a-fA-F]{24}$/.test(idOrCode)) {
    query._id = idOrCode;
  } else {
    query.$or = [{ registrationCode: idOrCode }, { 'attendee.name': new RegExp(`^${idOrCode.trim()}$`, 'i') }];
  }

  const reg = await Registration.findOne(query);
  if (!reg) {
    throw new Error(`Registration not found for: ${idOrCode}`);
  }

  if (name) reg.attendee.name = name.trim();
  if (email) reg.attendee.email = email.trim().toLowerCase();
  if (phone) reg.attendee.phone = phone.trim();
  if (medicalCouncilRegNo !== undefined) reg.attendee.medicalCouncilRegNo = medicalCouncilRegNo.trim();
  if (institution !== undefined) reg.attendee.institution = institution.trim();

  await reg.save();

  return {
    success: true,
    message: `Updated registration ${reg.registrationCode} successfully.`,
    updatedRegistration: {
      code: reg.registrationCode,
      name: reg.attendee.name,
      email: reg.attendee.email,
      phone: reg.attendee.phone,
      tnmc: reg.attendee.medicalCouncilRegNo,
      badgeNo: reg.badgeNo,
    },
  };
}

async function toolDeleteRegistration({ idOrCode, reason = 'Cancelled by AI Assistant' }) {
  const query = {};
  if (/^[0-9a-fA-F]{24}$/.test(idOrCode)) {
    query._id = idOrCode;
  } else {
    query.$or = [{ registrationCode: idOrCode }, { 'attendee.name': new RegExp(`^${idOrCode.trim()}$`, 'i') }];
  }

  const reg = await Registration.findOne(query);
  if (!reg) {
    throw new Error(`Registration not found for: ${idOrCode}`);
  }

  reg.status = 'cancelled';
  reg.cancellationReason = reason;
  await reg.save();

  return {
    success: true,
    message: `Registration ${reg.registrationCode} (${reg.attendee?.name}) has been cancelled.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Universal MongoDB Operator & Edit Tools                                    */
/* -------------------------------------------------------------------------- */

const mongooseLib = require('mongoose');

function normalizeFilter(collName, filter = {}) {
  const f = { ...filter };
  if (f._id && typeof f._id === 'string' && /^[0-9a-fA-F]{24}$/.test(f._id)) {
    f._id = new mongooseLib.Types.ObjectId(f._id);
  }

  if (collName === 'registrations') {
    if (f.name && !f['attendee.name']) {
      f.$or = [
        { 'attendee.name': new RegExp(String(f.name).trim(), 'i') },
        { registrationCode: String(f.name).trim() },
        { badgeNo: String(f.name).trim() },
      ];
      delete f.name;
    }
    if (f.phone && !f['attendee.phone']) {
      const cleanPhone = String(f.phone).replace(/\D/g, '').slice(-10);
      f['attendee.phone'] = new RegExp(cleanPhone);
      delete f.phone;
    }
    if (f.email && !f['attendee.email']) {
      f['attendee.email'] = String(f.email).trim().toLowerCase();
      delete f.email;
    }
  }

  return f;
}

function normalizeUpdate(collName, update = {}) {
  let u = { ...update };
  if (!Object.keys(u).some((k) => k.startsWith('$'))) {
    u = { $set: u };
  }

  if (collName === 'registrations' && u.$set) {
    const s = { ...u.$set };
    if (s.phone && !s['attendee.phone']) {
      s['attendee.phone'] = String(s.phone).trim();
      delete s.phone;
    }
    if (s.email && !s['attendee.email']) {
      s['attendee.email'] = String(s.email).trim().toLowerCase();
      delete s.email;
    }
    if (s.name && !s['attendee.name']) {
      s['attendee.name'] = String(s.name).trim();
      delete s.name;
    }
    if (s.category && !s['attendee.category']) {
      s['attendee.category'] = String(s.category).trim();
      s.badgeRole = String(s.category).trim();
      delete s.category;
    }
    if (s.tnmc && !s['attendee.medicalCouncilRegNo']) {
      s['attendee.medicalCouncilRegNo'] = String(s.tnmc).trim();
      delete s.tnmc;
    }
    if (s.institution && !s['attendee.institution']) {
      s['attendee.institution'] = String(s.institution).trim();
      delete s.institution;
    }
    if (s.checkedIn === true) {
      s.checkedIn = true;
      s.checkedInAt = new Date();
    } else if (s.checkedIn === false) {
      s.checkedIn = false;
      s.checkedInAt = null;
      s.checkins = [];
    }
    u.$set = s;
  }
  return u;
}

function formatDocMarkdown(doc, collection) {
  if (!doc) return '';
  if (collection === 'registrations') {
    const att = doc.attendee || {};
    const isChecked = Boolean(doc.checkedIn || doc.checkedInAt || (doc.checkins && doc.checkins.length > 0));
    return `\n**Updated Delegate Document:**\n- **Name:** ${att.name || 'N/A'}\n- **Badge No:** \`${doc.badgeNo || 'N/A'}\`\n- **Email:** ${att.email || 'N/A'}\n- **Phone:** ${att.phone || 'N/A'}\n- **Category:** ${att.category || doc.badgeRole || 'N/A'}\n- **TNMC:** ${att.medicalCouncilRegNo || 'N/A'}\n- **Check-in Status:** ${isChecked ? 'Checked-in' : 'Pending'}\n- **Registration Code:** \`${doc.registrationCode}\``;
  }
  if (collection === 'coupons') {
    return `\n**Updated Coupon Document:**\n- **Code:** \`${doc.code}\`\n- **Max Uses:** ${doc.maxUses !== undefined ? doc.maxUses : 'Unlimited'}\n- **Used Count:** ${doc.usedCount || 0}\n- **Discount:** ${doc.discountPercent ? doc.discountPercent + '%' : '₹' + (doc.discountAmount || 0)}\n- **Active:** ${doc.isActive ? 'Yes' : 'No'}`;
  }
  if (collection === 'users') {
    return `\n**Updated User Document:**\n- **Name:** ${doc.name}\n- **Email:** ${doc.email}\n- **Role:** \`${doc.role}\`\n- **Active:** ${doc.isActive ? 'Yes' : 'No'}`;
  }
  if (collection === 'events') {
    return `\n**Updated Event Document:**\n- **Title:** ${doc.title}\n- **Slug:** \`${doc.slug}\`\n- **Venue:** ${doc.venue?.name || 'N/A'}`;
  }

  // Generic JSON preview
  const preview = Object.entries(doc)
    .filter(([k]) => k !== '_id' && k !== '__v')
    .slice(0, 8)
    .map(([k, v]) => `- **${k}:** ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('\n');
  return `\n**Document Details (\`${collection}\`):**\n${preview}`;
}

/**
 * Universal Database Operator - Executes raw operations on ANY MongoDB collection.
 */
async function toolExecuteMongoOp({
  collection = 'registrations',
  action = 'updateOne',
  filter = {},
  update,
  doc,
  docs,
  pipeline,
  options = {},
  user,
}) {
  const db = mongooseLib.connection.db;
  if (!db) {
    throw new Error('Database connection not established.');
  }

  const collName = String(collection || 'registrations').trim().toLowerCase();
  const coll = db.collection(collName);

  const cleanFilter = normalizeFilter(collName, filter);
  const cleanUpdate = update ? normalizeUpdate(collName, update) : undefined;

  let opResult = null;
  let updatedDoc = null;
  let detailsText = '';

  switch (action) {
    case 'updateOne': {
      if (!cleanUpdate) throw new Error('Update payload is required for updateOne.');
      opResult = await coll.updateOne(cleanFilter, cleanUpdate, options);
      updatedDoc = await coll.findOne(cleanFilter);
      detailsText = `Matched **${opResult.matchedCount}**, Modified **${opResult.modifiedCount}** in \`${collName}\`.`;
      break;
    }
    case 'updateMany': {
      if (!cleanUpdate) throw new Error('Update payload is required for updateMany.');
      opResult = await coll.updateMany(cleanFilter, cleanUpdate, options);
      detailsText = `Matched **${opResult.matchedCount}**, Modified **${opResult.modifiedCount}** in \`${collName}\`.`;
      break;
    }
    case 'insertOne': {
      const toInsert = doc || update || {};
      opResult = await coll.insertOne(toInsert);
      updatedDoc = toInsert;
      detailsText = `Inserted 1 new document into \`${collName}\` (ID: \`${opResult.insertedId}\`).`;
      break;
    }
    case 'insertMany': {
      const toInsertMany = docs || [];
      opResult = await coll.insertMany(toInsertMany);
      detailsText = `Inserted **${opResult.insertedCount}** documents into \`${collName}\`.`;
      break;
    }
    case 'deleteOne': {
      const beforeDelete = await coll.findOne(cleanFilter);
      opResult = await coll.deleteOne(cleanFilter);
      detailsText = `Deleted **${opResult.deletedCount}** document from \`${collName}\`.`;
      updatedDoc = beforeDelete;
      break;
    }
    case 'deleteMany': {
      opResult = await coll.deleteMany(cleanFilter);
      detailsText = `Deleted **${opResult.deletedCount}** documents from \`${collName}\`.`;
      break;
    }
    case 'findOne': {
      updatedDoc = await coll.findOne(cleanFilter);
      detailsText = updatedDoc ? `Found record in \`${collName}\`.` : `No matching document in \`${collName}\`.`;
      break;
    }
    case 'find': {
      const list = await coll.find(cleanFilter).limit(Math.min(options.limit || 20, 50)).toArray();
      detailsText = `Found **${list.length}** records in \`${collName}\`.`;
      return {
        action: 'DB_FIND',
        detailsText,
        records: list,
      };
    }
    case 'countDocuments': {
      const count = await coll.countDocuments(cleanFilter);
      detailsText = `Total count in \`${collName}\`: **${count}**.`;
      return {
        action: 'DB_COUNT',
        detailsText,
        count,
      };
    }
    case 'aggregate': {
      const aggList = await coll.aggregate(pipeline || []).toArray();
      detailsText = `Aggregated **${aggList.length}** results from \`${collName}\`.`;
      return {
        action: 'DB_AGGREGATE',
        detailsText,
        records: aggList,
      };
    }
    default:
      throw new Error(`Unsupported MongoDB action: ${action}`);
  }

  // Audit log entry
  try {
    await db.collection('auditlogs').insertOne({
      action: `AI_${String(action).toUpperCase()}`,
      target: collName,
      details: {
        filter: cleanFilter,
        update: cleanUpdate,
        matchedCount: opResult?.matchedCount,
        modifiedCount: opResult?.modifiedCount,
        deletedCount: opResult?.deletedCount,
      },
      performedBy: user?.name || user?.email || 'AI Assistant',
      timestamp: new Date(),
    });
  } catch (logErr) {
    // Non-blocking
  }

  return {
    action: 'DB_EDITED',
    collection: collName,
    operation: action,
    detailsText,
    opResult,
    updatedDoc,
  };
}

/**
 * Fast direct-intent regex parser for common database modification commands.
 */
function parseDirectEditIntent(text) {
  const t = String(text || '').trim();
  const lower = t.toLowerCase();

  // A. Direct MongoDB Shell Syntax: db.<collection>.<action>(arg1, arg2...)
  // E.g.: db.coupons.updateOne({ code: "TEST" }, { $set: { maxUses: 10 } })
  // E.g.: db.registrations.find({ "attendee.category": "Consultant" })
  const dbCmdMatch = t.match(/^db\.([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_]+)\s*\(([\s\S]*)\)\s*;?$/);
  if (dbCmdMatch) {
    const collName = dbCmdMatch[1].trim().toLowerCase();
    const action = dbCmdMatch[2].trim();
    const argsRaw = dbCmdMatch[3].trim();
    try {
      const fn = new Function(`return [${argsRaw}];`);
      const args = fn();
      if (action === 'updateOne' || action === 'updateMany') {
        return {
          collection: collName,
          action,
          filter: args[0] || {},
          update: args[1] || {},
          options: args[2] || {},
        };
      }
      if (action === 'insertOne') {
        return {
          collection: collName,
          action,
          doc: args[0] || {},
        };
      }
      if (action === 'insertMany') {
        return {
          collection: collName,
          action,
          docs: args[0] || [],
        };
      }
      if (action === 'deleteOne' || action === 'deleteMany' || action === 'findOne' || action === 'find' || action === 'countDocuments') {
        return {
          collection: collName,
          action,
          filter: args[0] || {},
          options: args[1] || {},
        };
      }
      if (action === 'aggregate') {
        return {
          collection: collName,
          action,
          pipeline: args[0] || [],
        };
      }
    } catch (e) {
      // Ignore evaluation errors, continue down
    }
  }

  // B. SQL/Mongo hybrid: update coupons set maxUses = 50 where code = 'PFRCCIIM006B2B'
  const sqlUpdate = t.match(/^update\s+([a-zA-Z0-9_-]+)\s+set\s+(.*?)\s+where\s+(.*)$/i);
  if (sqlUpdate) {
    const collName = sqlUpdate[1].trim().toLowerCase();
    const setClause = sqlUpdate[2].trim();
    const whereClause = sqlUpdate[3].trim();

    const updateObj = {};
    const setParts = setClause.split(/,(?=(?:[^"']*["'][^"']*["'])*[^"']*$)/);
    setParts.forEach((part) => {
      const eqIdx = part.indexOf('=');
      if (eqIdx !== -1) {
        const k = part.slice(0, eqIdx).trim().replace(/^['"]|['"]$/g, '');
        let v = part.slice(eqIdx + 1).trim();
        if (/^(true|false)$/i.test(v)) v = v.toLowerCase() === 'true';
        else if (/^\d+$/.test(v)) v = parseInt(v, 10);
        else if (/^\d+\.\d+$/.test(v)) v = parseFloat(v);
        else v = v.replace(/^['"]|['"]$/g, '');
        updateObj[k] = v;
      }
    });

    const filterObj = {};
    const whereParts = whereClause.split(/\s+and\s+/i);
    whereParts.forEach((part) => {
      const eqIdx = part.search(/=|\bis\b/i);
      if (eqIdx !== -1) {
        const k = part.slice(0, eqIdx).trim().replace(/^['"]|['"]$/g, '');
        const sepMatch = part.match(/=|\bis\b/i);
        let v = part.slice(eqIdx + sepMatch[0].length).trim();
        if (/^(true|false)$/i.test(v)) v = v.toLowerCase() === 'true';
        else if (/^\d+$/.test(v)) v = parseInt(v, 10);
        else v = v.replace(/^['"]|['"]$/g, '');
        filterObj[k] = v;
      }
    });

    if (Object.keys(updateObj).length > 0) {
      return {
        collection: collName,
        action: 'updateOne',
        filter: filterObj,
        update: updateObj,
      };
    }
  }

  // C. Natural Language Generic Collection Update: "in collection <col> set <field> to <val> where <key> is <val>"
  const genericColMatch = t.match(
    /in\s+(?:collection\s+)?([a-zA-Z0-9_-]+)\s+(?:set|update|change)\s+([a-zA-Z0-9_.-]+)\s+(?:to|=)\s+(.*?)\s+where\s+([a-zA-Z0-9_.-]+)\s+(?:is|=|to)\s*(.*)/i
  );
  if (genericColMatch) {
    const collName = genericColMatch[1].trim().toLowerCase();
    const field = genericColMatch[2].trim();
    let val = genericColMatch[3].trim().replace(/^['"]|['"]$/g, '');
    const filterKey = genericColMatch[4].trim();
    let filterVal = genericColMatch[5].trim().replace(/^['"]|['"]$/g, '');

    if (/^(true|false)$/i.test(val)) val = val.toLowerCase() === 'true';
    else if (/^\d+$/.test(val)) val = parseInt(val, 10);
    else if (/^\d+\.\d+$/.test(val)) val = parseFloat(val);

    if (/^(true|false)$/i.test(filterVal)) filterVal = filterVal.toLowerCase() === 'true';
    else if (/^\d+$/.test(filterVal)) filterVal = parseInt(filterVal, 10);

    return {
      collection: collName,
      action: 'updateOne',
      filter: { [filterKey]: filterVal },
      update: { [field]: val },
    };
  }

  // 1. Badge / ID card number update: "update badge number of X to Y" / "set badge no for X to Y"
  const badgeMatch = t.match(
    /(?:update|set|change)\s+(?:badge\s*no|badge\s*number|id\s*card\s*number|badge)\s+(?:for|of)?\s*(.*?)\s+to\s+([0-9A-Za-z_-]+)/i
  );
  if (badgeMatch) {
    return {
      collection: 'registrations',
      action: 'updateOne',
      filter: { name: badgeMatch[1].trim() },
      update: { badgeNo: badgeMatch[2].trim() },
    };
  }

  // 2. Email update: "change email of X to Y"
  const emailMatch = t.match(
    /(?:update|set|change)\s+email\s+(?:for|of)?\s*(.*?)\s+to\s+([^\s,]+@[^\s,]+)/i
  );
  if (emailMatch) {
    return {
      collection: 'registrations',
      action: 'updateOne',
      filter: { name: emailMatch[1].trim() },
      update: { 'attendee.email': emailMatch[2].trim().toLowerCase() },
    };
  }

  // 3. Phone update: "change phone of X to Y"
  const phoneMatch = t.match(
    /(?:update|set|change)\s+(?:phone|mobile|contact)\s+(?:for|of)?\s*(.*?)\s+to\s+([0-9+ -]{7,15})/i
  );
  if (phoneMatch) {
    return {
      collection: 'registrations',
      action: 'updateOne',
      filter: { name: phoneMatch[1].trim() },
      update: { 'attendee.phone': phoneMatch[2].replace(/\D/g, '').slice(-10) },
    };
  }

  // 4. Mark checked in: "mark X as checked in"
  if (/mark\s+(.*?)\s+as\s+(?:checked\s*in|scanned\s*in|attended)/i.test(t)) {
    const m = t.match(/mark\s+(.*?)\s+as\s+(?:checked\s*in|scanned\s*in|attended)/i);
    return {
      collection: 'registrations',
      action: 'updateOne',
      filter: { name: m[1].trim() },
      update: { checkedIn: true, checkedInAt: new Date() },
    };
  }

  // 5. Mark NOT checked in: "mark X as not checked in"
  if (/mark\s+(.*?)\s+as\s+(?:not\s*checked|unscanned|pending)/i.test(t)) {
    const m = t.match(/mark\s+(.*?)\s+as\s+(?:not\s*checked|unscanned|pending)/i);
    return {
      collection: 'registrations',
      action: 'updateOne',
      filter: { name: m[1].trim() },
      update: { checkedIn: false, checkedInAt: null, checkins: [] },
    };
  }

  // 6. Category update: "set category of X to Y"
  const catMatch = t.match(/(?:update|set|change)\s+category\s+(?:for|of)?\s*(.*?)\s+to\s+(.*)/i);
  if (catMatch && !lower.includes('show') && !lower.includes('fetch') && !lower.includes('export')) {
    return {
      collection: 'registrations',
      action: 'updateOne',
      filter: { name: catMatch[1].trim() },
      update: { 'attendee.category': catMatch[2].trim(), badgeRole: catMatch[2].trim() },
    };
  }

  // 7. TNMC update: "set tnmc number of X to Y"
  const tnmcMatch = t.match(/(?:update|set|change)\s+(?:tnmc\s*number|tnmc\s*no|tnmc)\s+(?:for|of)?\s*(.*?)\s+to\s+(.*)/i);
  if (tnmcMatch) {
    return {
      collection: 'registrations',
      action: 'updateOne',
      filter: { name: tnmcMatch[1].trim() },
      update: { 'attendee.medicalCouncilRegNo': tnmcMatch[2].trim() },
    };
  }

  // 8. Coupon max uses update: "update coupon X max uses to N"
  const couponMatch = t.match(/(?:update|set)\s+(?:max\s*uses\s+of\s+)?coupon\s+([A-Za-z0-9_-]+)\s+(?:max\s*uses\s+)?to\s+(\d+)/i);
  if (couponMatch) {
    return {
      collection: 'coupons',
      action: 'updateOne',
      filter: { code: couponMatch[1].trim().toUpperCase() },
      update: { maxUses: parseInt(couponMatch[2], 10) },
    };
  }

  // 9. Delete registration: "delete registration REG-XXXX"
  const delRegMatch = t.match(/(?:delete|cancel)\s+registration\s+([A-Za-z0-9_-]+)/i);
  if (delRegMatch) {
    return {
      collection: 'registrations',
      action: 'updateOne',
      filter: { registrationCode: delRegMatch[1].trim() },
      update: { status: 'cancelled', cancellationReason: 'Cancelled by AI Assistant' },
    };
  }

  // 10. Delete user: "delete user <email>"
  const delUserMatch = t.match(/(?:delete|remove)\s+user\s+([^\s,]+@[^\s,]+)/i);
  if (delUserMatch) {
    return {
      collection: 'users',
      action: 'deleteOne',
      filter: { email: delUserMatch[1].trim().toLowerCase() },
    };
  }

  // 11. Delete coupon: "delete coupon <code>"
  const delCouponMatch = t.match(/(?:delete|remove)\s+coupon\s+([A-Za-z0-9_-]+)/i);
  if (delCouponMatch) {
    return {
      collection: 'coupons',
      action: 'deleteOne',
      filter: { code: delCouponMatch[1].trim().toUpperCase() },
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Main AI Assistant Coordinator & Intent Parser                             */
/* -------------------------------------------------------------------------- */

function parseExportIntent(text) {
  const lower = String(text || '').toLowerCase().trim();

  // Check if prompt is asking for data/export/fetch/list/download
  const isDataQuery =
    lower.includes('fetch') ||
    lower.includes('export') ||
    lower.includes('download') ||
    lower.includes('give me') ||
    lower.includes('show') ||
    lower.includes('list') ||
    lower.includes('filter') ||
    lower.includes('report') ||
    lower.includes('pdf') ||
    lower.includes('csv') ||
    lower.includes('excel') ||
    lower.includes('xlsx') ||
    lower.includes('spreadsheet') ||
    lower.includes('column') ||
    lower.includes('pg student') ||
    lower.includes('resident') ||
    (lower.includes('who') && (lower.includes('check') || lower.includes('scan') || lower.includes('attend')));

  if (!isDataQuery) return null;

  // Ignore certificate / ID card single generation shortcuts
  if (
    (lower.includes('certificate') && (lower.includes('for') || lower.includes('name'))) ||
    (lower.includes('id card') && !lower.includes('number') && (lower.includes('for') || lower.includes('create')))
  ) {
    return null;
  }

  // 1. Category extraction
  let category = undefined;
  if (/pg\s*student|resident|\bpg\b/i.test(lower)) {
    category = 'PG Student / Resident';
  } else if (/consultant/i.test(lower)) {
    category = 'Consultant';
  } else if (/\bdelegate\b/i.test(lower) && !/all/i.test(lower)) {
    category = 'Delegate';
  }

  // 2. Check-in extraction
  let checkedIn = undefined;
  if (/not\s*checked|not\s*scanned|unscanned|pending|absent|without\s*check/i.test(lower)) {
    checkedIn = false;
  } else if (/check\s*in|checked\s*in|scanned\s*in|scanned|attended/i.test(lower)) {
    checkedIn = true;
  }

  // 3. TNMC extraction
  let hasTnmc = undefined;
  if (/non[-\s]*tnmc|without\s*tnmc|no\s*tnmc/i.test(lower)) {
    hasTnmc = false;
  } else if (/tnmc/i.test(lower) && !lower.includes('tnmc number') && !lower.includes('tnmc no') && !lower.includes('tnmc reg')) {
    hasTnmc = true;
  }

  // 4. Location / Checkpoint extraction
  let locationCode = undefined;
  if (/lunch|food/i.test(lower)) {
    locationCode = 'LUNCH';
  } else if (/counter\s*1/i.test(lower)) {
    locationCode = 'COUNTER 1';
  } else if (/counter\s*2/i.test(lower)) {
    locationCode = 'COUNTER 2';
  }

  // 5. Columns detection preserving prompt order
  const colMatches = [];

  const addCol = (rx, colName) => {
    const match = rx.exec(lower);
    if (match) {
      colMatches.push({ index: match.index, name: colName });
    }
  };

  addCol(/id\s*card\s*number|id\s*card|badge\s*no|badge\s*number|\bbadge\b|card\s*no|card\s*number|id\s*number/i, 'ID Card Number');
  addCol(/\bname\b|delegate\s*name|doctor\s*name|full\s*name|attendee\s*name/i, 'Delegate Name');
  addCol(/email|mail/i, 'Email');
  addCol(/phone|mobile|contact|whatsapp/i, 'Phone');
  addCol(/tnmc\s*number|tnmc\s*no|council\s*reg|medical\s*council/i, 'TNMC Number');
  addCol(/check[-\s]*in\s*status|scan\s*status|\bstatus\b/i, 'Check-in Status');
  addCol(/check[-\s]*in\s*time|scan\s*time|entry\s*time|time\s*of\s*check/i, 'Check-in Time');
  addCol(/counter|location|checkpoint|entry\s*desk/i, 'Check-in Counter');
  addCol(/lunch\s*status|lunch\s*check[-\s]*in/i, 'Lunch Status');
  addCol(/pass\s*type|ticket\s*type|\bcategory\b|\brole\b/i, 'Category');
  addCol(/institution|college|hospital|workplace/i, 'Institution');
  addCol(/\bcity\b/i, 'City');
  addCol(/\bstate\b/i, 'State');
  addCol(/designation/i, 'Designation');
  addCol(/registration\s*code|reg\s*code|\bcode\b/i, 'Registration Code');

  colMatches.sort((a, b) => a.index - b.index);

  const uniqueCols = [];
  const seen = new Set();
  colMatches.forEach((cm) => {
    if (!seen.has(cm.name)) {
      seen.add(cm.name);
      uniqueCols.push(cm.name);
    }
  });

  return {
    isExport: true,
    category,
    checkedIn,
    hasTnmc,
    locationCode,
    columns: uniqueCols.length > 0 ? uniqueCols : undefined,
  };
}

async function processUserPrompt(promptText, user) {
  const text = String(promptText || '').trim();
  const lower = text.toLowerCase();

  // 1. Direct Pattern Shortcut: Direct Database Edit (Universal Operator)
  // E.g.: "update badge number of Dr Monisha to 0999", "change email of X to Y", "mark X as checked in", "update coupon..."
  const directEdit = parseDirectEditIntent(text);
  if (directEdit) {
    const res = await toolExecuteMongoOp({ ...directEdit, user });
    if (res.action === 'DB_FIND' || res.action === 'DB_AGGREGATE') {
      const rows = (res.records || []).slice(0, 10);
      const preview = rows.length > 0 ? JSON.stringify(rows, null, 2) : 'No records found.';
      return {
        reply: `🔍 **${res.detailsText}**\n\n\`\`\`json\n${preview}\n\`\`\``,
        action: res.action,
        data: res,
      };
    }
    if (res.action === 'DB_COUNT') {
      return {
        reply: `🔢 **${res.detailsText}**`,
        action: res.action,
        data: res,
      };
    }
    const docMd = formatDocMarkdown(res.updatedDoc, res.collection);
    return {
      reply: `✅ **Database Update Executed Successfully!**\n\n${res.detailsText}\n${docMd}`,
      action: 'DB_EDITED',
      data: res,
    };
  }

  // 2. Direct Pattern Shortcut: Multi-Format Data Export (PDF, CSV, Excel)
  // E.g.: "fetch the pg student only who check in and with name , email and id card number"
  // "export checked in delegates in pdf and csv...", "give me report of...", etc.
  const exportIntent = parseExportIntent(text);
  if (exportIntent && exportIntent.isExport) {
    const res = await toolExportData({
      category: exportIntent.category,
      checkedIn: exportIntent.checkedIn,
      hasTnmc: exportIntent.hasTnmc,
      locationCode: exportIntent.locationCode,
      columns: exportIntent.columns,
    });

    const colListStr = res.columnsIncluded.join(', ');
    const previewTable = formatMarkdownTable(res.samplePreview, res.columnsIncluded);

    let filterDesc = '';
    if (exportIntent.category) filterDesc += ` **${exportIntent.category}**`;
    if (exportIntent.checkedIn === true) filterDesc += ' who are **checked in / scanned**';
    else if (exportIntent.checkedIn === false) filterDesc += ' who are **not checked in**';
    if (exportIntent.hasTnmc === true) filterDesc += ' with **TNMC numbers**';
    else if (exportIntent.hasTnmc === false) filterDesc += ' without **TNMC**';
    if (exportIntent.locationCode) filterDesc += ` at **${exportIntent.locationCode}**`;

    const reply = `Found **${res.rowCount}** matching delegates${filterDesc}.\n\nGenerated custom export with requested columns: **${colListStr}**.\n\nReady for instant download in **PDF (print-ready report)**, **CSV (data exchange)**, and **Excel (.XLSX)**:\n\n${previewTable}`;

    return {
      reply,
      action: 'DATA_EXPORTED',
      dataExport: {
        title: res.title,
        rowCount: res.rowCount,
        columns: res.columnsIncluded,
        downloads: res.downloads,
      },
      downloads: res.downloads,
      excelDownload: res.excelDownload,
    };
  }

  // 2. Direct Pattern Shortcut: Certificate Generation
  // "i want certificate for this name Karthikeyan"
  const certMatch =
    (lower.includes('certificate') && (lower.includes('for') || lower.includes('name'))) &&
    (text.match(/certificate\s+(?:for\s+)?(?:this\s+name\s+)?([A-Za-z.\s]{2,50})/i) || lower.includes('certificate'));

  if (certMatch && !lower.includes('how') && !lower.includes('what') && !lower.includes('where')) {
    let nameToUse = 'Karthikeyan';
    if (certMatch[1] && certMatch[1].trim() && !certMatch[1].toLowerCase().includes('certificate')) {
      nameToUse = certMatch[1].trim().replace(/^for\s+/i, '').replace(/^name\s+/i, '');
    } else {
      // Find name after 'name' keyword
      const afterName = text.split(/name\s+/i)[1];
      if (afterName) {
        nameToUse = afterName.split(/[\n,?.!]/)[0].trim();
      }
    }

    if (nameToUse) {
      const clean = nameToUse.replace(/^Dr\.\s*/i, '').trim();
      const encoded = encodeURIComponent(clean);
      return {
        reply: `Here is the official **CIIM 2026 Certificate of Participation** for **Dr. ${clean}**! You can download it instantly in PNG, JPG, or PDF format below:`,
        action: 'CERTIFICATE_GENERATED',
        data: { name: clean },
        downloads: [
          {
            label: 'Certificate PNG',
            format: 'png',
            name: clean,
            url: `/api/v1/admin/ai/download/certificate?name=${encoded}&format=png`,
          },
          {
            label: 'Certificate JPG',
            format: 'jpg',
            name: clean,
            url: `/api/v1/admin/ai/download/certificate?name=${encoded}&format=jpg`,
          },
          {
            label: 'Certificate PDF',
            format: 'pdf',
            name: clean,
            url: `/api/v1/admin/ai/download/certificate?name=${encoded}&format=pdf`,
          },
        ],
      };
    }
  }

  // 3. Direct Pattern Shortcut: Instant ID Card Generation for a specific person
  // e.g. "create instant id card for Dr. Karthikeyan"
  const isIdCardNumberCol = lower.includes('id card number') || lower.includes('id card no') || lower.includes('badge no') || lower.includes('badge number');
  const idCardMatch =
    !isIdCardNumberCol &&
    (text.match(/(?:create|generate|make|print)\s+(?:instant\s+)?(?:id\s*card|badge)\s+(?:for\s+)?([A-Za-z.\s]{2,50})/i) ||
      text.match(/(?:id\s*card|badge)\s+for\s+([A-Za-z.\s]{2,50})/i));

  if (idCardMatch && !lower.includes('how') && !lower.includes('what') && !lower.includes('where')) {
    let nameToUse = 'Karthikeyan';
    if (idCardMatch[1] && idCardMatch[1].trim() && !idCardMatch[1].toLowerCase().includes('id card')) {
      nameToUse = idCardMatch[1].trim().replace(/^for\s+/i, '');
    } else {
      const afterFor = text.split(/for\s+/i)[1];
      if (afterFor) {
        nameToUse = afterFor.split(/[\n,?.!]/)[0].trim();
      }
    }

    const clean = nameToUse.replace(/^Dr\.\s*/i, '').trim();
    const encoded = encodeURIComponent(clean);
    return {
      reply: `Created instant **CIIM 2026 ID Card** for **Dr. ${clean}**! Ready for download and printing in PNG, JPG, and PDF:`,
      action: 'ID_CARD_GENERATED',
      data: { name: clean, role: 'DELEGATE', badgeNo: '0001' },
      downloads: [
        {
          label: 'ID Card PNG',
          format: 'png',
          name: clean,
          url: `/api/v1/admin/ai/download/id-card?name=${encoded}&format=png&includeTemplate=true`,
        },
        {
          label: 'ID Card JPG',
          format: 'jpg',
          name: clean,
          url: `/api/v1/admin/ai/download/id-card?name=${encoded}&format=jpg&includeTemplate=true`,
        },
        {
          label: 'ID Card PDF',
          format: 'pdf',
          name: clean,
          url: `/api/v1/admin/ai/download/id-card?name=${encoded}&format=pdf&includeTemplate=true`,
        },
      ],
    };
  }


  // 4. Fallback to Groq LLM (openai/gpt-oss-120b) with conversational tool calls
  try {
    const groqResponse = await queryGroqLLM(text, user);
    if (groqResponse) {
      // Check if LLM requested a tool call (mongoOp or exportData)
      const toolJson = extractJsonBlock(groqResponse.reply);
      if (toolJson) {
        try {
          const parsed = JSON.parse(toolJson);
          if (parsed.tool === 'mongoOp' && parsed.params) {
            const res = await toolExecuteMongoOp({
              ...parsed.params,
              user,
            });
            if (res.action === 'DB_FIND' || res.action === 'DB_AGGREGATE') {
              const rows = (res.records || []).slice(0, 10);
              const preview = rows.length > 0 ? JSON.stringify(rows, null, 2) : 'No records found.';
              return {
                reply: `🔍 **${res.detailsText}**\n\n\`\`\`json\n${preview}\n\`\`\``,
                action: res.action,
                data: res,
              };
            }
            if (res.action === 'DB_COUNT') {
              return {
                reply: `🔢 **${res.detailsText}**`,
                action: res.action,
                data: res,
              };
            }
            const docMd = formatDocMarkdown(res.updatedDoc, res.collection);
            return {
              reply: `✅ **Database Operation Executed Successfully!**\n\n${res.detailsText}\n${docMd}`,
              action: 'DB_EDITED',
              data: res,
            };
          }
          if (parsed.tool === 'exportData' && parsed.params) {
            const res = await toolExportData(parsed.params);
            const colListStr = res.columnsIncluded.join(', ');
            const previewTable = formatMarkdownTable(res.samplePreview, res.columnsIncluded);
            return {
              reply: `Found **${res.rowCount}** matching records.\n\nGenerated custom export with columns: **${colListStr}**.\n\n${previewTable}`,
              action: 'DATA_EXPORTED',
              dataExport: {
                title: res.title,
                rowCount: res.rowCount,
                columns: res.columnsIncluded,
                downloads: res.downloads,
              },
              downloads: res.downloads,
              excelDownload: res.excelDownload,
            };
          }
        } catch (e) {
          logger.warn('Failed to parse LLM tool call JSON:', e.message);
        }
      }
      return groqResponse;
    }
  } catch (err) {
    logger.warn('[AI Assistant] Groq call failed, running smart database fallback:', err.message);
  }

  // 5. Intelligent local fallback for stats and checks
  if (lower.includes('how many') || lower.includes('total') || lower.includes('count') || lower.includes('stats')) {
    const stats = await toolCheckStats();
    return {
      reply: `Here are the latest CIIM 2026 database statistics:\n\n- **Total Registrations:** ${stats.totalRegistrations}\n- **Confirmed Attendees:** ${stats.confirmedRegistrations}\n- **Checked-in Attendees:** ${stats.checkedInCount} (${stats.checkInRate})\n- **TNMC Registered Doctors:** ${stats.tnmcDoctorsCount}\n- **Non-TNMC Delegates:** ${stats.nonTnmcCount}\n- **Cancelled Registrations:** ${stats.cancelledRegistrations}`,
      action: 'STATS_VIEW',
      data: stats,
    };
  }

  return {
    reply: `I am your **CIIM 2026 AI Assistant & Master Database Operator**! Here is what I can do for you:\n\n1. **Full Database Editing**: *"update badge number of Dr Monisha to 0999"*, *"change email of X to Y"*, *"mark X as checked in"*, *"update coupon PFRCCIIM100 max uses to 50"*, or any database modification across any collection!\n2. **Custom Multi-Format Exports**: *"fetch the pg student only who check in and with name, email and id card number"* → Instant PDF Report, CSV, and Excel spreadsheets!\n3. **Instant Certificates & Badges**: *"I want certificate for Karthikeyan"* → PNG, JPG, and PDF.\n4. **Database Operations**: Any query, filter, bulk update, or document delete across all collections!`,
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers & Groq LLM Calling                                                 */
/* -------------------------------------------------------------------------- */

function formatMarkdownTable(rows, columns) {
  if (!rows || rows.length === 0 || !columns || columns.length === 0) return '';
  const header = `| ${columns.join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows
    .map((r) => `| ${columns.map((c) => String(r[c] || '-')).join(' | ')} |`)
    .join('\n');
  return `### Preview of Top Records:\n\n${header}\n${sep}\n${body}`;
}

/**
 * Balanced-brace JSON extractor that accurately extracts full nested JSON objects
 * even when wrapped in markdown fences or preceded by TOOL_CALL:
 */
function extractJsonBlock(text) {
  if (!text) return null;

  let firstBrace = -1;
  const toolCallIdx = text.search(/TOOL_CALL:\s*/i);
  if (toolCallIdx !== -1) {
    const match = text.match(/TOOL_CALL:\s*/i);
    firstBrace = text.indexOf('{', toolCallIdx + match[0].length);
  } else {
    const toolKeyIdx = text.search(/\{\s*"tool"\s*:/i);
    if (toolKeyIdx !== -1) {
      firstBrace = toolKeyIdx;
    }
  }

  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return text.slice(firstBrace, i + 1);
        }
      }
    }
  }
  return null;
}

async function queryGroqLLM(prompt, user) {
  const apiKey = env.groqAiApi || process.env.GROQ_AI_API;
  if (!apiKey) return null;

  const stats = await toolCheckStats();

  const systemMessage = `You are Antigravity AI, the intelligent executive assistant and master database operator for the CIIM 2026 conference.
You have FULL, UNCONSTRAINED DATABASE ACCESS to MongoDB (database: prashanth_events). You can query, view, insert, update, modify, delete, or perform bulk operations on ANY collection in the database.

Collections & fields overview:
- registrations: { _id, registrationCode, badgeNo, badgeRole, status ('confirmed'|'cancelled'), checkedInAt, checkins: [{locationCode, locationName, checkedInAt}], attendee: { name, email, phone, medicalCouncilRegNo, institution, designation, city, state, category } }
- coupons: { _id, code, discountPercent, discountAmount, maxUses, usedCount, isActive, company, validUntil }
- events: { _id, title, slug, startDate, endDate, venue, agenda }
- users: { _id, name, email, role, isActive, phone }
- tickettypes: { _id, name, price, availableCount, description }
- checkinlocations: { _id, code, name, description, isActive }
- marketingcampaigns: { _id, campaignName, status, scheduledFor, channels, templateId, sessionDetails }
- companies: { _id, name, contactPerson, email, phone, isActive }
- auditlogs: { _id, action, performedBy, target, timestamp, details }

When the user asks to modify, edit, change, set, mark, update, insert, or delete ANYTHING in the database, respond with a TOOL_CALL in valid JSON:
TOOL_CALL: {
  "tool": "mongoOp",
  "params": {
    "collection": "<collection_name>",
    "action": "updateOne" | "updateMany" | "insertOne" | "insertMany" | "deleteOne" | "deleteMany" | "findOne" | "find" | "countDocuments",
    "filter": { ... },
    "update": { "$set": { ... } },
    "doc": { ... },
    "explanation": "Short summary of what is being changed"
  }
}

If exporting or fetching data for reports, use:
TOOL_CALL: {
  "tool": "exportData",
  "params": {
    "category": "...",
    "checkedIn": true/false,
    "columns": ["Delegate Name", "Email", ...]
  }
}

Otherwise, respond concisely and helpfully. Always provide exact, structured answers.`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 800,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.warn(`Groq returned HTTP ${response.status}: ${errText}`);
    return null;
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) return null;

  return { reply };
}

module.exports = {
  processUserPrompt,
  getFileFromStore,
  toolCheckStats,
  toolSearchRegistrations,
  toolExportExcel,
  toolExportData,
  toolExecuteMongoOp,
  toolCreateRegistration,
  toolUpdateRegistration,
  toolDeleteRegistration,
};
