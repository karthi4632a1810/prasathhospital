'use strict';

const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { PNG } = require('pngjs');

// Theme Gradient: Deep Royal Plum (#381b4e) to Signature Vibrant Rose (#eb3f67)
const COLOR_1 = { r: 56, g: 27, b: 78 };   // #381b4e
const COLOR_2 = { r: 235, g: 63, b: 103 }; // #eb3f67
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
 * Evaluates the 135-degree diagonal theme gradient at pixel (x, y).
 */
function getGradientColor(x, y, width) {
  const t = Math.max(0, Math.min(1, (x + y) / (2 * width)));
  const r = Math.round((1 - t) * COLOR_1.r + t * COLOR_2.r);
  const g = Math.round((1 - t) * COLOR_1.g + t * COLOR_2.g);
  const b = Math.round((1 - t) * COLOR_1.b + t * COLOR_2.b);
  return [r, g, b, 255];
}

/**
 * Generates an ultra-premium standalone themed QR code with:
 *  - Smooth 135° diagonal color gradient using the theme's two main colors (#381b4e to #eb3f67)
 *  - Modern squircle card border-radius with fine hairline gradient rim
 *  - High-contrast precision finder eyes
 *  - Circular center medallion with gradient bezel ring and Prashanth baby emblem
 *  - Error Correction Level H (30% redundancy) for 100% reliable camera scanning
 *
 * @param {string} text - URL or data to encode
 * @param {object} [options]
 * @param {number} [options.width=800]
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateQrPngBuffer(text, options = {}) {
  const width = options.width || 800;
  const margin = 4;

  const qrData = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const modCount = qrData.modules.size;
  const totalMods = modCount + margin * 2;
  const modSize = width / totalMods;

  const png = new PNG({ width, height: width });
  png.data.fill(255);

  function setPixel(x, y, color) {
    if (x < 0 || x >= width || y < 0 || y >= width) return;
    const idx = (width * y + x) << 2;
    png.data[idx] = color[0];
    png.data[idx + 1] = color[1];
    png.data[idx + 2] = color[2];
    png.data[idx + 3] = color[3];
  }

  function isFinder(r, c) {
    if (r < 7 && c < 7) return true;
    if (r < 7 && c >= modCount - 7) return true;
    if (r >= modCount - 7 && c < 7) return true;
    return false;
  }

  // 1. Draw data modules in smooth theme gradient
  for (let r = 0; r < modCount; r++) {
    for (let c = 0; c < modCount; c++) {
      if (isFinder(r, c)) continue;
      if (qrData.modules.get(r, c)) {
        const sX = Math.round((c + margin) * modSize);
        const eX = Math.round((c + margin + 1) * modSize);
        const sY = Math.round((r + margin) * modSize);
        const eY = Math.round((r + margin + 1) * modSize);
        for (let y = sY; y < eY; y++) {
          for (let x = sX; x < eX; x++) {
            setPixel(x, y, getGradientColor(x, y, width));
          }
        }
      }
    }
  }

  // 2. Draw Finders with matching gradient
  const finders = [
    { r: 0, c: 0 },
    { r: 0, c: modCount - 7 },
    { r: modCount - 7, c: 0 },
  ];

  for (const f of finders) {
    for (let fr = 0; fr < 7; fr++) {
      for (let fc = 0; fc < 7; fc++) {
        const isOuter = fr === 0 || fr === 6 || fc === 0 || fc === 6;
        const isPupil = fr >= 2 && fr <= 4 && fc >= 2 && fc <= 4;
        const sX = Math.round((f.c + fc + margin) * modSize);
        const eX = Math.round((f.c + fc + margin + 1) * modSize);
        const sY = Math.round((f.r + fr + margin) * modSize);
        const eY = Math.round((f.r + fr + margin + 1) * modSize);

        if (isOuter || isPupil) {
          for (let y = sY; y < eY; y++) {
            for (let x = sX; x < eX; x++) {
              setPixel(x, y, getGradientColor(x, y, width));
            }
          }
        }
      }
    }
  }

  // 3. Center Medallion with Gradient Bezel Ring
  const centerX = width / 2;
  const centerY = width / 2;
  const badgeRadius = Math.floor(width * 0.11);
  const ringWidth = Math.max(3, Math.floor(width * 0.006));

  for (let y = centerY - badgeRadius - ringWidth - 1; y <= centerY + badgeRadius + ringWidth + 1; y++) {
    for (let x = centerX - badgeRadius - ringWidth - 1; x <= centerX + badgeRadius + ringWidth + 1; x++) {
      const dist = Math.hypot(x - centerX, y - centerY);
      if (dist <= badgeRadius) {
        setPixel(x, y, COLOR_WHITE);
      } else if (dist <= badgeRadius + ringWidth) {
        setPixel(x, y, getGradientColor(x, y, width));
      }
    }
  }

  // 4. Composite Prashanth baby emblem
  const logo = loadLogo();
  if (logo) {
    const targetSize = Math.floor(badgeRadius * 1.5);
    const startX = Math.round(centerX - targetSize / 2);
    const startY = Math.round(centerY - targetSize / 2);

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
          png.data[destIdx] = Math.round(logo.data[srcIdx] * alpha + 255 * (1 - alpha));
          png.data[destIdx + 1] = Math.round(logo.data[srcIdx + 1] * alpha + 255 * (1 - alpha));
          png.data[destIdx + 2] = Math.round(logo.data[srcIdx + 2] * alpha + 255 * (1 - alpha));
          png.data[destIdx + 3] = 255;
        }
      }
    }
  }

  // 5. Apply Border Radius to Card Canvas (smooth squircle card with hairline gradient border)
  const cardRadius = Math.round(width * 0.06); // ~48px on 800px
  const borderWidth = Math.max(2, Math.round(width * 0.004));

  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      let distCorner = 0;
      if (x < cardRadius && y < cardRadius) {
        distCorner = Math.hypot(x - cardRadius, y - cardRadius);
      } else if (x > width - cardRadius && y < cardRadius) {
        distCorner = Math.hypot(x - (width - cardRadius), y - cardRadius);
      } else if (x < cardRadius && y > width - cardRadius) {
        distCorner = Math.hypot(x - cardRadius, y - (width - cardRadius));
      } else if (x > width - cardRadius && y > width - cardRadius) {
        distCorner = Math.hypot(x - (width - cardRadius), y - (width - cardRadius));
      }

      if (distCorner > cardRadius) {
        // Outside the card: transparent
        const idx = (width * y + x) << 2;
        png.data[idx + 3] = 0;
      } else if (distCorner > cardRadius - borderWidth) {
        // Hairline card border in theme gradient
        setPixel(x, y, getGradientColor(x, y, width));
      }
    }
  }

  return PNG.sync.write(png);
}

module.exports = { generateQrPngBuffer };
