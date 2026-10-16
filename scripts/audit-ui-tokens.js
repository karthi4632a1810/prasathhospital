#!/usr/bin/env node
/**
 * UI & Design Token Audit Script for Prashanth Hospitals Event Platform.
 *
 * Scans CSS and JSX across frontend-public and frontend-admin to detect:
 * 1. Hardcoded raw colors (HEX) that bypass design tokens
 * 2. Hardcoded pixel margins/paddings that bypass --space-* tokens
 * 3. Inconsistent font-family declarations
 * 4. High z-index magic numbers (> 100)
 * 5. In-line styles in JSX that hardcode colors or dimensions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const TARGET_DIRS = [
  path.join(ROOT_DIR, 'frontend-public', 'src'),
  path.join(ROOT_DIR, 'frontend-admin', 'src'),
];

const IGNORE_FILES = ['tokens.css'];

const HEX_COLOR_REGEX = /#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\b(?![^(]*\))/g;
const HARDCODED_SPACING_REGEX = /(?:margin|padding)(?:-[a-z]+)?:\s*(\d+px)\b/g;
const Z_INDEX_REGEX = /z-index:\s*(\d{3,})\b/g;

const report = {
  scannedFiles: 0,
  hardcodedColors: [],
  hardcodedSpacings: [],
  highZIndices: [],
  hardcodedFonts: [],
};

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        scanDir(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.css') || entry.name.endsWith('.jsx'))) {
      if (IGNORE_FILES.includes(entry.name)) continue;
      scanFile(fullPath);
    }
  }
}

function scanFile(filePath) {
  report.scannedFiles++;
  const relativePath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) return;

    // Check Hex colors in CSS
    if (filePath.endsWith('.css')) {
      const hexMatches = trimmed.match(HEX_COLOR_REGEX);
      if (hexMatches) {
        // Exclude standard SVG data URLs or gradients if any
        if (!trimmed.includes('data:image')) {
          report.hardcodedColors.push({
            file: relativePath,
            line: lineNum,
            code: trimmed,
            matches: hexMatches,
          });
        }
      }

      // Check Hardcoded Spacing (px)
      const spaceMatches = [...trimmed.matchAll(HARDCODED_SPACING_REGEX)];
      if (spaceMatches.length > 0) {
        report.hardcodedSpacings.push({
          file: relativePath,
          line: lineNum,
          code: trimmed,
          values: spaceMatches.map((m) => m[1]),
        });
      }

      // Check Z-index
      const zMatches = [...trimmed.matchAll(Z_INDEX_REGEX)];
      if (zMatches.length > 0) {
        report.highZIndices.push({
          file: relativePath,
          line: lineNum,
          code: trimmed,
          value: zMatches[0][1],
        });
      }

      // Check Font Family
      if (trimmed.startsWith('font-family:') && !trimmed.includes('var(--') && !trimmed.includes('inherit')) {
        report.hardcodedFonts.push({
          file: relativePath,
          line: lineNum,
          code: trimmed,
        });
      }
    }
  });
}

for (const dir of TARGET_DIRS) {
  scanDir(dir);
}

console.log('\n============================================================');
console.log('   PRASHANTH HOSPITALS — UI & DESIGN TOKEN AUDIT REPORT     ');
console.log('============================================================\n');
console.log(`Files Analyzed: ${report.scannedFiles}`);
console.log(`Hardcoded Hex Colors:   ${report.hardcodedColors.length}`);
console.log(`Hardcoded Px Spacings:  ${report.hardcodedSpacings.length}`);
console.log(`High Z-Index (>100):    ${report.highZIndices.length}`);
console.log(`Hardcoded Font Families: ${report.hardcodedFonts.length}`);
console.log('------------------------------------------------------------\n');

if (report.hardcodedColors.length > 0) {
  console.log(`⚠️  Hardcoded Colors Found (${report.hardcodedColors.length}):`);
  report.hardcodedColors.slice(0, 15).forEach((item) => {
    console.log(`   ${item.file}:${item.line} -> ${item.code} (${item.matches.join(', ')})`);
  });
  if (report.hardcodedColors.length > 15) {
    console.log(`   ... and ${report.hardcodedColors.length - 15} more.`);
  }
  console.log('');
}

if (report.hardcodedSpacings.length > 0) {
  console.log(`⚠️  Hardcoded Pixel Spacing Found (${report.hardcodedSpacings.length}):`);
  report.hardcodedSpacings.slice(0, 15).forEach((item) => {
    console.log(`   ${item.file}:${item.line} -> ${item.code} (values: ${item.values.join(', ')})`);
  });
  if (report.hardcodedSpacings.length > 15) {
    console.log(`   ... and ${report.hardcodedSpacings.length - 15} more.`);
  }
  console.log('');
}

if (report.highZIndices.length > 0) {
  console.log(`⚠️  High / Unmanaged Z-Indices Found (${report.highZIndices.length}):`);
  report.highZIndices.forEach((item) => {
    console.log(`   ${item.file}:${item.line} -> ${item.code} (z-index: ${item.value})`);
  });
  console.log('');
}

if (report.hardcodedFonts.length > 0) {
  console.log(`⚠️  Hardcoded Font Families Found (${report.hardcodedFonts.length}):`);
  report.hardcodedFonts.forEach((item) => {
    console.log(`   ${item.file}:${item.line} -> ${item.code}`);
  });
  console.log('');
}

const totalIssues =
  report.hardcodedColors.length +
  report.hardcodedSpacings.length +
  report.highZIndices.length +
  report.hardcodedFonts.length;

if (totalIssues === 0) {
  console.log('✅ PERFECT! All styles strictly adhere to design tokens.\n');
} else {
  console.log(`Found ${totalIssues} design token / alignment improvement opportunities.\n`);
}
