'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const opentype = require('opentype.js');
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

function getCertificateFontPath() {
  const candidates = [
    path.resolve(__dirname, '../assets/LiberationSans-Bold.ttf'),
    path.resolve(__dirname, '../../assets/LiberationSans-Bold.ttf'),
    path.resolve(process.cwd(), 'backend/src/assets/LiberationSans-Bold.ttf'),
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

let cachedFont = null;
function getLoadedFont() {
  if (cachedFont) return cachedFont;
  const fontPath = getCertificateFontPath();
  if (!fontPath) return null;
  try {
    const fontBuffer = fs.readFileSync(fontPath);
    cachedFont = opentype.parse(
      fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength)
    );
    return cachedFont;
  } catch (err) {
    console.error('Failed to parse certificate font:', err);
    return null;
  }
}

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Calculates optimal font size so attendee name fits neatly within max allowed width (760px).
 */
function getScaledFontSize(font, name, maxWidth = 760, maxFontSize = 36, minFontSize = 20) {
  if (!font) {
    const len = (name || '').trim().length;
    if (len <= 18) return 38;
    if (len <= 24) return 34;
    if (len <= 30) return 30;
    if (len <= 38) return 26;
    return 22;
  }

  let size = maxFontSize;
  while (size > minFontSize) {
    const width = font.getAdvanceWidth(name, size);
    if (width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

/**
 * Generates a PNG buffer of the CIIM 2026 Certificate with attendee name.
 * Converts text into pure vector SVG path using opentype.js to ensure 100% font fidelity
 * on all systems (including headless Alpine Linux / Docker without system fonts).
 */
async function generateCertificatePngBuffer({ name, registrationCode }) {
  const templatePath = getCertificateTemplatePath();
  if (!templatePath) {
    throw new Error('Certificate template (certificate.png) not found.');
  }

  const cleanName = (name || 'Delegate').replace(/\s+/g, ' ').trim();
  const font = getLoadedFont();

  let nameElementSvg = '';
  if (font) {
    const fontSize = getScaledFontSize(font, cleanName, 760, 36, 20);
    const textWidth = font.getAdvanceWidth(cleanName, fontSize);
    const x = 800 - (textWidth / 2);
    const y = 478; // baseline 14px above the purple underline at y=492

    const pathObj = font.getPath(cleanName, x, y, fontSize);
    pathObj.fill = '#1e1b18';
    nameElementSvg = pathObj.toSVG(2);
  } else {
    // Fallback if font is missing
    const fontSize = getScaledFontSize(null, cleanName);
    nameElementSvg = `
      <text
        x="800"
        y="478"
        text-anchor="middle"
        font-family="Liberation Sans, DejaVu Sans, Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="#1e1b18"
      >${escapeXml(cleanName)}</text>
    `;
  }

  // Seamless blush cover rectangle over the placeholder + vector text path
  const svg = `
    <svg width="1600" height="1131" xmlns="http://www.w3.org/2000/svg">
      <rect x="400" y="435" width="800" height="53" fill="rgb(253, 236, 244)" />
      ${nameElementSvg}
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
  getCertificateFontPath,
  generateCertificatePngBuffer,
  generateCertificateJpgBuffer,
  generateCertificatePdfBuffer,
  generateCertificateBuffer,
};
