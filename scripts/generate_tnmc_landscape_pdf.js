'use strict';

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');

const uri =
  process.env.MONGODB_URI ||
  'mongodb+srv://jiokarthikeyan18_db_user:Oe8OhnOrD164A0dJ@prashantdb.ma6fim0.mongodb.net/prashanth_events?retryWrites=true&w=majority';

async function main() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected to MongoDB!');

  const registrations = await mongoose.connection
    .collection('registrations')
    .find({ status: 'confirmed' })
    .sort({ createdAt: 1 })
    .toArray();

  console.log('Total confirmed registrations found:', registrations.length);

  const otherCouncils = ['APMC', 'TSMC', 'KMC', 'MMC', 'DMC', 'SLMC', 'JKMC', 'UPMC', 'TMC'];

  const tnmcList = [];
  for (const r of registrations) {
    const rawNo = String(r.attendee?.medicalCouncilRegNo || '').trim();
    if (!rawNo || ['NA', 'N/A', 'NIL', 'NONE', '-', 'NOT APPLICABLE'].includes(rawNo.toUpperCase())) {
      continue;
    }
    if (otherCouncils.some((c) => rawNo.toUpperCase().startsWith(c))) {
      continue;
    }

    const cleanNo = rawNo.replace(/^(TNMC Reg No|TNMC|Tnmc|TN)[\s\/\-]*/i, '').trim();
    const cleanName = String(r.attendee?.name || '')
      .replace(/^(Dr\.?|Prof\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const email = String(r.attendee?.email || '').trim();
    const phone = String(r.attendee?.phone || '').replace(/[^\d]/g, '').slice(-10);

    tnmcList.push({
      sno: tnmcList.length + 1,
      council: 'Tamil Nadu Medical Council',
      regNo: cleanNo || rawNo,
      name: cleanName || 'Delegate',
      email: email,
      phone: phone,
      code: r.registrationCode,
    });
  }

  console.log(`Total TNMC registered delegates collected: ${tnmcList.length}`);

  // --------------------------------------------------------------------------
  // 1. Update exports/Bulk_Upload_Attendance_Sample_5_Sessions.xlsx sheet 'TNMC Participants'
  // --------------------------------------------------------------------------
  const xlsxPath = path.resolve(__dirname, '../exports/Bulk_Upload_Attendance_Sample_5_Sessions.xlsx');
  if (fs.existsSync(xlsxPath)) {
    const wb = xlsx.readFile(xlsxPath);

    const headers = [
      'Serial Number',
      'Name of the council',
      'TNMC Register Number',
      'Full Name\n(Please do not include inital or symbols or dots as part of the name)',
      'Email Id\n',
      'Mobile Number (Optional)',
    ];

    const excelRows = [
      headers,
      ...tnmcList.map((item) => [
        item.sno,
        item.council,
        item.regNo,
        item.name,
        item.email,
        item.phone,
      ]),
    ];

    wb.Sheets['TNMC Participants'] = xlsx.utils.aoa_to_sheet(excelRows);
    wb.Sheets['TNMC Participants']['!cols'] = [
      { wch: 14 },
      { wch: 30 },
      { wch: 22 },
      { wch: 35 },
      { wch: 35 },
      { wch: 22 },
    ];

    xlsx.writeFile(wb, xlsxPath);
    console.log(`Updated ${xlsxPath} sheet "TNMC Participants" with ${tnmcList.length} records.`);
  }

  // --------------------------------------------------------------------------
  // 2. Generate Professional Landscape PDF
  // --------------------------------------------------------------------------
  function generateLandscapePdf(data, outputPath, subtitle) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 28, bottom: 28, left: 28, right: 28 },
        autoFirstPage: false,
        bufferPages: true,
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const pageWidth = 841.89;
      const pageHeight = 595.28;
      const leftMargin = 28;
      const rightMargin = 28;
      const usableWidth = pageWidth - leftMargin - rightMargin; // 785.89 pt

      // Columns definition (Total = 785 pt)
      const cols = [
        { label: 'S.No', width: 42, align: 'center' },
        { label: 'State Medical Council', width: 145, align: 'left' },
        { label: 'TNMC Reg. No.', width: 92, align: 'center' },
        { label: 'Doctor / Participant Full Name', width: 198, align: 'left' },
        { label: 'Registered Email Address', width: 200, align: 'left' },
        { label: 'Mobile No.', width: 108, align: 'center' },
      ];

      const rowHeight = 16.5;
      const headerRowHeight = 22;

      let currentY = 0;
      let rowsOnCurrentPage = 0;
      const maxRowsFirstPage = 23;
      const maxRowsOtherPages = 28;

      function addNewPage(isFirst = false) {
        doc.addPage();
        currentY = 28;

        if (isFirst) {
          // Main Title Banner
          doc.rect(leftMargin, currentY, usableWidth, 48).fill('#0f2b46');

          doc
            .fillColor('#ffffff')
            .font('Helvetica-Bold')
            .fontSize(14)
            .text('CIIM 2026 — CONTROVERSIES IN INFERTILITY MANAGEMENT', leftMargin + 14, currentY + 8, {
              width: usableWidth - 28,
            });

          doc
            .fillColor('#93c5fd')
            .font('Helvetica')
            .fontSize(9.5)
            .text(
              'Prashanth Hospitals & Research Centre  |  21st & 22nd November 2026  |  The Leela Palace, Chennai',
              leftMargin + 14,
              currentY + 28
            );

          currentY += 54;

          // Sub-header with statistics
          doc.rect(leftMargin, currentY, usableWidth, 24).fill('#f1f5f9');
          doc
            .fillColor('#0f2b46')
            .font('Helvetica-Bold')
            .fontSize(10)
            .text('TAMIL NADU MEDICAL COUNCIL (TNMC) PARTICIPANTS ROSTER', leftMargin + 10, currentY + 7);

          const metaText = `Total Registered TNMC Delegates: ${data.length}  |  Accreditation Attendance Record`;
          doc
            .fillColor('#475569')
            .font('Helvetica')
            .fontSize(9)
            .text(metaText, leftMargin, currentY + 7, { width: usableWidth - 10, align: 'right' });

          currentY += 30;
        } else {
          // Compact running top bar
          doc.rect(leftMargin, currentY, usableWidth, 18).fill('#0f2b46');
          doc
            .fillColor('#ffffff')
            .font('Helvetica-Bold')
            .fontSize(8.5)
            .text('CIIM 2026 — Tamil Nadu Medical Council (TNMC) Registered Participants Roster', leftMargin + 10, currentY + 5);

          doc
            .fillColor('#cbd5e1')
            .font('Helvetica')
            .fontSize(8)
            .text(`21–22 Nov 2026  |  Total: ${data.length} TNMC Delegates`, leftMargin, currentY + 5, {
              width: usableWidth - 10,
              align: 'right',
            });

          currentY += 24;
        }

        // Draw Table Header Row
        doc.rect(leftMargin, currentY, usableWidth, headerRowHeight).fill('#1e3a5f');
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);

        let colX = leftMargin;
        cols.forEach((col) => {
          doc.text(col.label, colX + 4, currentY + 6, {
            width: col.width - 8,
            align: col.align,
          });
          colX += col.width;
        });

        currentY += headerRowHeight;
        rowsOnCurrentPage = 0;
      }

      // Start first page
      addNewPage(true);

      data.forEach((item, index) => {
        const isFirstPage = doc.bufferedPageRange().count === 1;
        const maxRows = isFirstPage ? maxRowsFirstPage : maxRowsOtherPages;

        if (rowsOnCurrentPage >= maxRows) {
          addNewPage(false);
        }

        // Row background striping
        const isEven = index % 2 === 0;
        doc.rect(leftMargin, currentY, usableWidth, rowHeight).fill(isEven ? '#ffffff' : '#f8fafc');

        // Thin bottom border
        doc
          .strokeColor('#e2e8f0')
          .lineWidth(0.5)
          .moveTo(leftMargin, currentY + rowHeight)
          .lineTo(leftMargin + usableWidth, currentY + rowHeight)
          .stroke();

        let colX = leftMargin;

        // 1. S.No
        doc
          .fillColor('#64748b')
          .font('Helvetica')
          .fontSize(8)
          .text(String(item.sno), colX + 2, currentY + 4, { width: cols[0].width - 4, align: cols[0].align });
        colX += cols[0].width;

        // 2. Council Name
        doc
          .fillColor('#334155')
          .font('Helvetica')
          .fontSize(8)
          .text(item.council, colX + 4, currentY + 4, {
            width: cols[1].width - 8,
            align: cols[1].align,
            ellipsis: true,
          });
        colX += cols[1].width;

        // 3. TNMC Reg No
        doc
          .fillColor('#0f2b46')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text(String(item.regNo), colX + 4, currentY + 4, { width: cols[2].width - 8, align: cols[2].align });
        colX += cols[2].width;

        // 4. Full Name
        doc
          .fillColor('#0f172a')
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(item.name, colX + 4, currentY + 4, {
            width: cols[3].width - 8,
            align: cols[3].align,
            ellipsis: true,
          });
        colX += cols[3].width;

        // 5. Email
        doc
          .fillColor('#2563eb')
          .font('Helvetica')
          .fontSize(7.5)
          .text(item.email || '—', colX + 4, currentY + 4, {
            width: cols[4].width - 8,
            align: cols[4].align,
            ellipsis: true,
          });
        colX += cols[4].width;

        // 6. Phone
        doc
          .fillColor('#1e293b')
          .font('Helvetica')
          .fontSize(8)
          .text(item.phone || '—', colX + 4, currentY + 4, { width: cols[5].width - 8, align: cols[5].align });
        colX += cols[5].width;

        currentY += rowHeight;
        rowsOnCurrentPage++;
      });

      // Add page numbers and footers across all buffered pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        const footerY = pageHeight - 22;
        doc
          .strokeColor('#cbd5e1')
          .lineWidth(0.5)
          .moveTo(leftMargin, footerY - 4)
          .lineTo(leftMargin + usableWidth, footerY - 4)
          .stroke();

        doc
          .fillColor('#64748b')
          .font('Helvetica')
          .fontSize(7.5)
          .text(
            'CIIM 2026 — Tamil Nadu Medical Council (TNMC) Accredited CME Attendance Record',
            leftMargin,
            footerY,
            { align: 'left' }
          );

        doc.text(`Page ${i + 1} of ${range.count}`, leftMargin, footerY, {
          width: usableWidth,
          align: 'right',
        });
      }

      doc.end();
      writeStream.on('finish', () => {
        console.log(`Generated Landscape PDF: ${outputPath} (${range.count} pages)`);
        resolve(outputPath);
      });
      writeStream.on('error', reject);
    });
  }

  // 1. Output All 939 TNMC delegates in Landscape PDF
  const pdfAllPath = path.resolve(__dirname, '../exports/CIIM2026_TNMC_Participants_All_Registered_Landscape.pdf');
  await generateLandscapePdf(tnmcList, pdfAllPath, 'All Registered');

  // 2. Also output the first 60 delegates (the original sample sheet batch) in Landscape PDF
  const pdfSamplePath = path.resolve(__dirname, '../exports/CIIM2026_TNMC_Participants_Sample_60_Landscape.pdf');
  await generateLandscapePdf(tnmcList.slice(0, 60), pdfSamplePath, 'Sample 60 Batch');

  // Copy to brain artifacts directory for easy download
  const brainArtifactDir = '/home/karthikeyan/.gemini/antigravity/brain/266c9658-44db-419a-a5a6-b73542a7a91d';
  if (fs.existsSync(brainArtifactDir)) {
    fs.copyFileSync(pdfAllPath, path.join(brainArtifactDir, 'CIIM2026_TNMC_Participants_All_Registered_Landscape.pdf'));
    fs.copyFileSync(pdfSamplePath, path.join(brainArtifactDir, 'CIIM2026_TNMC_Participants_Sample_60_Landscape.pdf'));
    fs.copyFileSync(xlsxPath, path.join(brainArtifactDir, 'Bulk_Upload_Attendance_Sample_5_Sessions.xlsx'));
    console.log('Copied generated PDFs and updated XLSX to brain artifacts directory!');
  }

  console.log('SUCCESS! All operations completed successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
