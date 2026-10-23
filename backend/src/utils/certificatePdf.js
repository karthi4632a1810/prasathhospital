'use strict';

const PDFDocument = require('pdfkit');

const BRAND_DARK = '#240e36';
const BRAND = '#381b4e';
const ACCENT = '#eb3f67';
const INK = '#231238';
const INK_MUTED = '#684c7e';

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

/** Streams a branded A4-landscape certificate of participation. */
function streamCertificatePdf(res, { event, registration }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  doc.pipe(res);

  const { width, height } = doc.page;
  const margin = 36;

  // Outer border
  doc
    .rect(margin, margin, width - margin * 2, height - margin * 2)
    .lineWidth(2)
    .strokeColor(BRAND)
    .stroke();
  doc
    .rect(margin + 10, margin + 10, width - (margin + 10) * 2, height - (margin + 10) * 2)
    .lineWidth(0.75)
    .strokeColor(ACCENT)
    .stroke();

  const centerX = width / 2;

  doc
    .fillColor(INK_MUTED)
    .fontSize(11)
    .text('PRASHANTH HOSPITALS', 0, 86, { width, align: 'center', characterSpacing: 2 });

  doc
    .fillColor(BRAND_DARK)
    .fontSize(34)
    .text('Certificate of Participation', 0, 112, { width, align: 'center' });

  doc
    .moveTo(centerX - 80, 168)
    .lineTo(centerX + 80, 168)
    .strokeColor(ACCENT)
    .lineWidth(1.5)
    .stroke();

  doc
    .fillColor(INK_MUTED)
    .fontSize(13)
    .text('This certifies that', 0, 196, { width, align: 'center' });

  doc
    .fillColor(INK)
    .fontSize(30)
    .text(registration.attendee.name, 0, 224, { width, align: 'center' });

  const eventLine = `has participated in ${event.title}`;
  doc
    .fillColor(INK_MUTED)
    .fontSize(14)
    .text(eventLine, margin + 60, 276, { width: width - (margin + 60) * 2, align: 'center' });

  doc
    .fontSize(13)
    .text(`held on ${formatDate(event.startDate)}`, 0, 300, { width, align: 'center' });

  // Signature line
  const sigY = height - margin - 70;
  doc
    .moveTo(centerX - 110, sigY)
    .lineTo(centerX + 110, sigY)
    .strokeColor('#c3d0da')
    .lineWidth(1)
    .stroke();
  doc
    .fillColor(INK_MUTED)
    .fontSize(10)
    .text('Organizing Committee, Prashanth Hospitals', 0, sigY + 8, { width, align: 'center' });

  doc
    .fillColor('#c3d0da')
    .fontSize(8)
    .text(`Registration ${registration.registrationCode}`, 0, height - margin - 20, { width, align: 'center' });

  doc.end();
}

module.exports = { streamCertificatePdf };
