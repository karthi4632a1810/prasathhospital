'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

function getCertificateTemplatePath() {
  const candidates = [
    path.resolve(__dirname, '../assets/certificate.png'),
    path.resolve(__dirname, '../../certificate.png'),
    path.resolve(__dirname, '../../../certificate.png'),
    path.resolve(process.cwd(), 'backend/src/assets/certificate.png'),
    path.resolve(process.cwd(), 'certificate.png'),
    '/home/karthikeyan/KARTHIKEYAN/PROJECTS/prasathhospital/backend/src/assets/certificate.png',
    '/home/karthikeyan/KARTHIKEYAN/PROJECTS/prasathhospital/certificate.png',
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getFontSize(name) {
  const len = (name || '').trim().length;
  if (len <= 18) return 38;
  if (len <= 24) return 34;
  if (len <= 30) return 30;
  if (len <= 38) return 26;
  return 22;
}

/**
 * Generates a PNG buffer of the CIIM 2026 Certificate with attendee name
 */
async function generateCertificatePngBuffer({ name, registrationCode }) {
  const templatePath = getCertificateTemplatePath();
  if (!templatePath) {
    throw new Error('Certificate template (certificate.png) not found.');
  }

  const cleanName = (name || 'Delegate').replace(/\s+/g, ' ').trim();
  const fontSize = getFontSize(cleanName);

  // SVG overlay: wipes placeholder Dr xxxxxxxx and prints attendee name centered above underline
  const svg = `
    <svg width="1600" height="1131">
      <rect x="400" y="435" width="800" height="53" fill="rgb(253, 236, 244)" />
      <text
        x="800"
        y="478"
        text-anchor="middle"
        font-family="Liberation Sans, DejaVu Sans, Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="#1e1b18"
      >${escapeXml(cleanName)}</text>
    </svg>
  `;

  return await sharp(templatePath)
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer();
}

/**
 * Generates a high-quality JPG buffer of the certificate
 */
async function generateCertificateJpgBuffer({ name, registrationCode, quality = 95 }) {
  const pngBuffer = await generateCertificatePngBuffer({ name, registrationCode });
  return await sharp(pngBuffer)
    .jpeg({ quality, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

/**
 * Generates a crisp A4-landscape PDF buffer of the certificate
 */
async function generateCertificatePdfBuffer({ name, registrationCode }) {
  const pngBuffer = await generateCertificatePngBuffer({ name, registrationCode });
  const doc = await PDFDocument.create();

  // Standard A4 landscape dimensions (in points): 841.89 x 595.28
  const page = doc.addPage([841.89, 595.28]);
  const embeddedImage = await doc.embedPng(pngBuffer);

  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: 841.89,
    height: 595.28,
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Universal dispatcher for PNG, JPG, and PDF
 */
async function generateCertificateBuffer({ name, registrationCode, format = 'pdf' }) {
  const fmt = String(format || 'pdf').toLowerCase().replace(/^\./, '');
  if (fmt === 'png') {
    return {
      buffer: await generateCertificatePngBuffer({ name, registrationCode }),
      contentType: 'image/png',
      ext: 'png',
    };
  }
  if (fmt === 'jpg' || fmt === 'jpeg') {
    return {
      buffer: await generateCertificateJpgBuffer({ name, registrationCode }),
      contentType: 'image/jpeg',
      ext: 'jpg',
    };
  }
  // Default PDF
  return {
    buffer: await generateCertificatePdfBuffer({ name, registrationCode }),
    contentType: 'application/pdf',
    ext: 'pdf',
  };
}

module.exports = {
  getCertificateTemplatePath,
  generateCertificatePngBuffer,
  generateCertificateJpgBuffer,
  generateCertificatePdfBuffer,
  generateCertificateBuffer,
};
