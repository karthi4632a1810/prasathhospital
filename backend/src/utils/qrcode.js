'use strict';

const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { PNG } = require('pngjs');

// Luxury CIIM Palette: Royal Crimson & Polished Gold
const THEME_DARK = '#96291F'; // CIIM Deep Crimson
const THEME_LIGHT = '#FFFFFF';
const COLOR_CRIMSON = [150, 41, 31, 255]; // #96291F
const COLOR_GOLD = [212, 175, 55, 255];   // #D4AF37 Polished Metallic Gold
const COLOR_WHITE = [255, 255, 255, 255];

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
 * Generates an ultra-premium standalone Royal Crimson & Gold themed QR code.
 * Features:
 *  - CIIM Crimson data modules (#96291F)
 *  - High-contrast precision finder eyes for 100% camera scanning
 *  - Central circular medallion with polished Gold (#D4AF37) and Crimson hairline bezel rings
 *  - Official Prashanth baby emblem centered inside the medallion
 *  - Error Correction Level H (30% redundancy)
 *
 * @param {string} text - URL or data to encode
 * @param {object} [options]
 * @param {number} [options.width=800]
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateQrPngBuffer(text, options = {}) {
  const width = options.width || 800;

  // 1. Generate high-contrast themed QR code with Error Correction Level H
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

    // Center circular badge: 22% diameter (safely within 30% EC tolerance)
    const badgeSize = Math.floor(width * 0.22);
    const badgeRadius = Math.floor(badgeSize / 2);
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(width / 2);

    const goldRingWidth = Math.max(3, Math.floor(width * 0.006));
    const crimsonRingWidth = Math.max(2, Math.floor(width * 0.003));

    // 2. Draw pristine white medallion disc with double Gold & Crimson bezel
    for (let y = centerY - badgeRadius - goldRingWidth - crimsonRingWidth - 1; y <= centerY + badgeRadius + goldRingWidth + crimsonRingWidth + 1; y++) {
      for (let x = centerX - badgeRadius - goldRingWidth - crimsonRingWidth - 1; x <= centerX + badgeRadius + goldRingWidth + crimsonRingWidth + 1; x++) {
        if (x < 0 || x >= width || y < 0 || y >= width) continue;

        const dist = Math.hypot(x - centerX, y - centerY);
        const idx = (width * y + x) << 2;

        if (dist <= badgeRadius) {
          // Pure white background inside circular medallion
          qr.data[idx] = COLOR_WHITE[0];
          qr.data[idx + 1] = COLOR_WHITE[1];
          qr.data[idx + 2] = COLOR_WHITE[2];
          qr.data[idx + 3] = COLOR_WHITE[3];
        } else if (dist <= badgeRadius + crimsonRingWidth) {
          // Fine Crimson inner accent ring
          qr.data[idx] = COLOR_CRIMSON[0];
          qr.data[idx + 1] = COLOR_CRIMSON[1];
          qr.data[idx + 2] = COLOR_CRIMSON[2];
          qr.data[idx + 3] = COLOR_CRIMSON[3];
        } else if (dist <= badgeRadius + crimsonRingWidth + goldRingWidth) {
          // Polished Gold outer bezel ring
          qr.data[idx] = COLOR_GOLD[0];
          qr.data[idx + 1] = COLOR_GOLD[1];
          qr.data[idx + 2] = COLOR_GOLD[2];
          qr.data[idx + 3] = COLOR_GOLD[3];
        }
      }
    }

    // 3. Composite Prashanth baby emblem with smooth alpha blending
    const targetSize = Math.floor(badgeSize * 0.82);
    const startX = centerX - Math.floor(targetSize / 2);
    const startY = centerY - Math.floor(targetSize / 2);

    for (let ly = 0; ly < targetSize; ly++) {
      for (let lx = 0; lx < targetSize; lx++) {
        const destX = startX + lx;
        const destY = startY + ly;
        if (destX < 0 || destX >= width || destY < 0 || destY >= width) continue;

        const srcX = Math.floor((lx / targetSize) * logo.width);
        const srcY = Math.floor((ly / targetSize) * logo.height);
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
    return qrBuffer;
  }
}

module.exports = { generateQrPngBuffer };
