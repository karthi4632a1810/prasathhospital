'use strict';

const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { PNG } = require('pngjs');

// Theme colors
const THEME_DARK = '#96291F'; // CIIM Deep Crimson
const THEME_LIGHT = '#FFFFFF';
const BORDER_COLOR = [150, 41, 31, 255]; // rgba for #96291F

let cachedLogo = null;

function loadLogo() {
  if (cachedLogo) return cachedLogo;
  const logoPath = path.resolve(__dirname, '../assets/logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      cachedLogo = PNG.sync.read(fs.readFileSync(logoPath));
      return cachedLogo;
    } catch (_) {
      return null;
    }
  }
  return null;
}

/**
 * Generates a high-resolution, premium themed PNG QR code buffer.
 * If a logo exists, embeds it in the center inside a circular badge
 * using Error Correction Level H (30% redundancy) for 100% reliable scanning.
 *
 * @param {string} text - URL or data to encode
 * @param {object} [options]
 * @param {number} [options.width=800]
 * @returns {Promise<Buffer>}
 */
async function generateQrPngBuffer(text, options = {}) {
  const width = options.width || 800;

  // 1. Generate base themed QR code with High error correction
  const qrBuffer = await QRCode.toBuffer(text, {
    type: 'png',
    errorCorrectionLevel: 'H',
    width,
    margin: 4,
    color: {
      dark: THEME_DARK,
      light: THEME_LIGHT,
    },
  });

  const logo = loadLogo();
  if (!logo) {
    return qrBuffer;
  }

  try {
    const qr = PNG.sync.read(qrBuffer);

    // Badge diameter: ~24% of QR code width (safe for Error Correction H)
    const badgeSize = Math.floor(width * 0.24);
    const badgeRadius = Math.floor(badgeSize / 2);
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(width / 2);

    // 2. Draw white circular background badge with a fine crimson ring
    const ringThickness = Math.max(3, Math.floor(width * 0.005));
    for (let y = centerY - badgeRadius - ringThickness - 1; y <= centerY + badgeRadius + ringThickness + 1; y++) {
      for (let x = centerX - badgeRadius - ringThickness - 1; x <= centerX + badgeRadius + ringThickness + 1; x++) {
        if (x < 0 || x >= width || y < 0 || y >= width) continue;

        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const idx = (width * y + x) << 2;

        if (dist <= badgeRadius) {
          // Pure white background inside circle
          qr.data[idx] = 255;
          qr.data[idx + 1] = 255;
          qr.data[idx + 2] = 255;
          qr.data[idx + 3] = 255;
        } else if (dist <= badgeRadius + ringThickness) {
          // Crimson ring border
          qr.data[idx] = BORDER_COLOR[0];
          qr.data[idx + 1] = BORDER_COLOR[1];
          qr.data[idx + 2] = BORDER_COLOR[2];
          qr.data[idx + 3] = BORDER_COLOR[3];
        }
      }
    }

    // 3. Scale and composite the logo into the badge with padding
    const logoTargetSize = Math.floor(badgeSize * 0.82);
    const logoStartX = centerX - Math.floor(logoTargetSize / 2);
    const logoStartY = centerY - Math.floor(logoTargetSize / 2);

    for (let ly = 0; ly < logoTargetSize; ly++) {
      for (let lx = 0; lx < logoTargetSize; lx++) {
        const destX = logoStartX + lx;
        const destY = logoStartY + ly;
        if (destX < 0 || destX >= width || destY < 0 || destY >= width) continue;

        const srcX = Math.floor((lx / logoTargetSize) * logo.width);
        const srcY = Math.floor((ly / logoTargetSize) * logo.height);
        const srcIdx = (logo.width * srcY + srcX) << 2;

        const alpha = logo.data[srcIdx + 3] / 255;
        if (alpha > 0.04) {
          const destIdx = (width * destY + destX) << 2;
          qr.data[destIdx] = Math.round(logo.data[srcIdx] * alpha + 255 * (1 - alpha));
          qr.data[destIdx + 1] = Math.round(logo.data[srcIdx + 1] * alpha + 255 * (1 - alpha));
          qr.data[destIdx + 2] = Math.round(logo.data[srcIdx + 2] * alpha + 255 * (1 - alpha));
          qr.data[destIdx + 3] = 255;
        }
      }
    }

    return PNG.sync.write(qr);
  } catch (err) {
    // If compositing fails for any reason, return the valid base QR buffer
    return qrBuffer;
  }
}

module.exports = { generateQrPngBuffer };
