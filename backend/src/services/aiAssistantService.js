'use strict';

const crypto = require('crypto');
const XLSX = require('xlsx');
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

async function toolExportExcel({ hasTnmc, checkedIn, searchQuery, columns = [] }) {
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

  if (searchQuery && searchQuery.trim()) {
    const rx = new RegExp(searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
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

  const registrations = await Registration.find(query)
    .populate('ticketType', 'name')
    .sort({ createdAt: 1 })
    .lean();

  // Determine which columns to include based on user's exact specification
  const normalizedCols = (columns || []).map((c) => String(c).toLowerCase().trim());
  const wantsOnlySpecific =
    normalizedCols.length > 0 && !normalizedCols.some((c) => c.includes('all') || c.includes('*'));

  const requestedHeaders = [];
  if (normalizedCols.some((c) => c.includes('name'))) requestedHeaders.push('Delegate Name');
  if (normalizedCols.some((c) => c.includes('email'))) requestedHeaders.push('Email');
  if (normalizedCols.some((c) => c.includes('phone') || c.includes('mobile'))) requestedHeaders.push('Phone');
  if (normalizedCols.some((c) => c.includes('tnmc') || c.includes('council') || c.includes('reg'))) requestedHeaders.push('TNMC Number');
  if (normalizedCols.some((c) => c.includes('ticket') || c.includes('pass'))) requestedHeaders.push('Pass Type');
  if (normalizedCols.some((c) => c.includes('check') || c.includes('scan') || c.includes('status'))) requestedHeaders.push('Check-in Status');
  if (normalizedCols.some((c) => c.includes('institution') || c.includes('hospital') || c.includes('college'))) requestedHeaders.push('Institution');

  const rows = registrations.map((r, idx) => {
    const attendee = r.attendee || {};
    const isCheckedIn = Boolean(r.checkedIn || (r.checkinLocations && r.checkinLocations.length > 0));

    if (wantsOnlySpecific) {
      const row = {};
      if (normalizedCols.some((c) => c.includes('name'))) {
        row['Delegate Name'] = attendee.name || 'Delegate';
      }
      if (normalizedCols.some((c) => c.includes('email'))) {
        row['Email'] = attendee.email || '';
      }
      if (normalizedCols.some((c) => c.includes('phone') || c.includes('mobile'))) {
        row['Phone'] = attendee.phone || '';
      }
      if (normalizedCols.some((c) => c.includes('tnmc') || c.includes('council') || c.includes('reg'))) {
        row['TNMC Number'] = attendee.medicalCouncilRegNo || '';
      }
      if (normalizedCols.some((c) => c.includes('ticket') || c.includes('pass'))) {
        row['Pass Type'] = r.ticketType?.name || 'Delegate';
      }
      if (normalizedCols.some((c) => c.includes('check') || c.includes('scan') || c.includes('status'))) {
        row['Check-in Status'] = isCheckedIn ? 'Checked-in' : 'Not Checked-in';
      }
      if (normalizedCols.some((c) => c.includes('institution') || c.includes('hospital') || c.includes('college'))) {
        row['Institution'] = attendee.institution || '';
      }
      return row;
    }

    // Default: comprehensive details
    return {
      'S.No': idx + 1,
      'Registration Code': r.registrationCode,
      'Badge No': r.badgeNo || String(idx + 1).padStart(4, '0'),
      'Delegate Name': attendee.name || 'Delegate',
      'Email': attendee.email || '',
      'Phone': attendee.phone || '',
      'TNMC Reg No': attendee.medicalCouncilRegNo || 'N/A',
      'Pass Type': r.ticketType?.name || 'Delegate Pass',
      'Institution': attendee.institution || '',
      'City': attendee.city || '',
      'Check-in Status': isCheckedIn ? 'Checked-in' : 'Pending',
      'Registration Date': r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '',
    };
  });

  const defaultHeaders = wantsOnlySpecific
    ? requestedHeaders
    : [
        'S.No',
        'Registration Code',
        'Badge No',
        'Delegate Name',
        'Email',
        'Phone',
        'TNMC Reg No',
        'Pass Type',
        'Institution',
        'City',
        'Check-in Status',
        'Registration Date',
      ];

  const columnsIncluded = rows.length > 0 ? Object.keys(rows[0]) : defaultHeaders;
  const ws = rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([defaultHeaders]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Filtered_Delegates');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  let filename = 'CIIM2026_Delegates';
  if (hasTnmc) filename += '_TNMC';
  if (checkedIn) filename += '_CheckedIn';
  if (wantsOnlySpecific) filename += `_${normalizedCols.join('_')}`;
  filename += '.xlsx';

  const fileId = saveFileToStore(
    buffer,
    filename,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    {
      rowCount: rows.length,
      columns: columnsIncluded,
    }
  );

  return {
    fileId,
    filename,
    downloadUrl: `/api/v1/admin/ai/download/excel/${fileId}`,
    rowCount: rows.length,
    columnsIncluded,
    samplePreview: rows.slice(0, 5),
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
/* Main AI Assistant Coordinator                                              */
/* -------------------------------------------------------------------------- */

async function processUserPrompt(promptText, user) {
  const text = String(promptText || '').trim();
  const lower = text.toLowerCase();

  // 1. Direct Pattern Shortcut: Certificate Generation
  // "i want certificate for this name Karthikeyan"
  const certMatch =
    text.match(/certificate\s+(?:for\s+)?(?:this\s+name\s+)?([A-Za-z.\s]{2,50})/i) ||
    lower.includes('certificate');

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
            label: 'Download PNG',
            format: 'png',
            url: `/api/v1/admin/ai/download/certificate?name=${encoded}&format=png`,
          },
          {
            label: 'Download JPG',
            format: 'jpg',
            url: `/api/v1/admin/ai/download/certificate?name=${encoded}&format=jpg`,
          },
          {
            label: 'Download PDF',
            format: 'pdf',
            url: `/api/v1/admin/ai/download/certificate?name=${encoded}&format=pdf`,
          },
        ],
      };
    }
  }

  // 2. Direct Pattern Shortcut: Instant ID Card Generation
  // "create new instaant id card for Karthikeyan" / "id card for..."
  const idCardMatch =
    text.match(/(?:id\s*card|badge)\s+(?:for\s+)?([A-Za-z.\s]{2,50})/i) ||
    (lower.includes('id card') && (lower.includes('create') || lower.includes('for') || lower.includes('want')));

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
          label: 'Download PNG',
          format: 'png',
          url: `/api/v1/admin/ai/download/id-card?name=${encoded}&format=png&includeTemplate=true`,
        },
        {
          label: 'Download JPG',
          format: 'jpg',
          url: `/api/v1/admin/ai/download/id-card?name=${encoded}&format=jpg&includeTemplate=true`,
        },
        {
          label: 'Download PDF',
          format: 'pdf',
          url: `/api/v1/admin/ai/download/id-card?name=${encoded}&format=pdf&includeTemplate=true`,
        },
      ],
    };
  }

  // 3. Direct Pattern Shortcut: Filtered Excel Export with specific columns
  // "i want only TNMC registor user who have the scaned in and i waant only detail od name , email and phone in excel"
  const isExcelRequest =
    lower.includes('excel') ||
    lower.includes('xlsx') ||
    lower.includes('csv') ||
    (lower.includes('export') && (lower.includes('user') || lower.includes('delegate')));

  if (isExcelRequest) {
    const hasTnmc = lower.includes('tnmc');
    const checkedIn =
      lower.includes('scan') ||
      lower.includes('checked') ||
      lower.includes('checkin') ||
      lower.includes('attended');

    // Extract requested columns
    const columns = [];
    if (lower.includes('name')) columns.push('name');
    if (lower.includes('email') || lower.includes('mail')) columns.push('email');
    if (lower.includes('phone') || lower.includes('mobile') || lower.includes('contact')) columns.push('phone');
    if (lower.includes('council') || (hasTnmc && lower.includes('tnmc number'))) columns.push('tnmc');
    if (lower.includes('ticket') || lower.includes('pass')) columns.push('pass');

    const res = await toolExportExcel({
      hasTnmc: hasTnmc ? true : undefined,
      checkedIn: checkedIn ? true : undefined,
      columns: columns.length > 0 ? columns : undefined,
    });

    const colListStr = res.columnsIncluded.join(', ');
    const previewTable = formatMarkdownTable(res.samplePreview, res.columnsIncluded);

    return {
      reply: `Found **${res.rowCount}** matching delegates${hasTnmc ? ' with TNMC numbers' : ''}${checkedIn ? ' who have scanned in / checked in' : ''}.\n\nI have generated the Excel spreadsheet containing **only the ${res.columnsIncluded.length} requested columns**: **${colListStr}**.\n\n${previewTable}`,
      action: 'EXCEL_EXPORTED',
      excelDownload: {
        fileId: res.fileId,
        filename: res.filename,
        url: res.downloadUrl,
        rowCount: res.rowCount,
        columns: res.columnsIncluded,
      },
    };
  }

  // 4. Fallback to Groq LLM (openai/gpt-oss-120b) with conversational tool calls
  try {
    const groqResponse = await queryGroqLLM(text, user);
    if (groqResponse) {
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
    reply: `I am your **CIIM 2026 AI Assistant**! Here are some of the things you can ask me to do:\n\n1. **Instant Certificates**: *"I want certificate for this name Karthikeyan"* → Get immediate PNG, JPG, and PDF downloads!\n2. **Instant ID Cards**: *"Create instant ID card for Dr. Priya Sharma"* → Get PNG, JPG, and PDF ready to print!\n3. **Custom Excel Reports**: *"I want only TNMC registered users who scanned in with name, email and phone in excel"* → Generates Excel with exactly those 3 columns!\n4. **Database Operations**: Check registration stats, search attendees, create new registrations, edit details, rename, or cancel!`,
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

async function queryGroqLLM(prompt, user) {
  const apiKey = env.groqAiApi || process.env.GROQ_AI_API;
  if (!apiKey) return null;

  const stats = await toolCheckStats();

  const systemMessage = `You are Antigravity AI, the intelligent executive assistant for the CIIM 2026 (Controversies in Infertility Management) conference by Prashanth Fertility Research Centre, Chennai.
Current database overview:
- Total confirmed delegates: ${stats.confirmedRegistrations}
- Checked-in: ${stats.checkedInCount}
- Doctors with TNMC: ${stats.tnmcDoctorsCount}
- Without TNMC: ${stats.nonTnmcCount}

You can help the admin check data, create attendees, rename, update, delete/cancel, generate instant certificates, generate instant ID cards, or export custom filtered Excel files.
Be concise, professional, and helpful. Always provide exact, structured answers.`;

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
  toolCreateRegistration,
  toolUpdateRegistration,
  toolDeleteRegistration,
};
