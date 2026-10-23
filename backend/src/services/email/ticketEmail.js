'use strict';

const { sendMail } = require('./mailer');
const { renderTicketPdfBuffer } = require('../../utils/ticketPdf');
const { generateQrPngBuffer } = require('../../utils/qrcode');
const { ticketUrlFor } = require('../whatsapp/sendTicket');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cleanDoctorName(name) {
  if (!name) return 'Delegate';
  return String(name).replace(/^(?:dr\.?|doctor|prof\.?|mr\.?|mrs\.?|ms\.?)\s+/i, '').trim() || 'Delegate';
}

/**
 * Official CIIM 2026 Confirmation Email
 * Luxury plum & rose medical conference theme matching ciimInviteEmail.
 * Features:
 *   - Clean Doctor greeting (no duplicate "Dr. Dr")
 *   - Quote lead card with brand accent
 *   - Event highlights & venue (The Leela Palace, Chennai)
 *   - Attendee pass & registration ID card
 *   - Official Delegate Pass box with inline scannable QR (cid:ticket-qr)
 *   - Direct Digital Pass CTA button
 *   - PDF Ticket pass attachment & scientific brochure
 */
async function sendTicketEmail({ event, ticketType, registration, companyName }) {
  const ticketUrl = ticketUrlFor(registration);
  const venue = event.venue?.name
    ? [event.venue.name, event.venue.city].filter(Boolean).join(', ')
    : 'The Leela Palace, Chennai';

  const [pdf, qr] = await Promise.all([
    renderTicketPdfBuffer({ event, ticketType, registration, checkInUrl: ticketUrl, companyName }),
    generateQrPngBuffer(ticketUrl),
  ]);

  const cleanName = cleanDoctorName(registration.attendee?.name);
  const displayName = `Dr. ${cleanName}`;
  const subject = `You're In! Welcome to CIIM 2026 — ${registration.registrationCode}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a, h1, h2, h3 { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f7f1f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #221226; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f7f1f5; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 620px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 36px rgba(56, 27, 78, 0.08); border: 1px solid #f2dfe8;">
          
          <!-- Top Accent Gradient Bar -->
          <tr>
            <td height="6" style="background: linear-gradient(90deg, #381b4e 0%, #eb3f67 50%, #d4af37 100%); line-height: 6px; font-size: 6px;">&nbsp;</td>
          </tr>

          <!-- Header Banner -->
          <tr>
            <td style="padding: 36px 36px 28px 36px; background: linear-gradient(180deg, #fff7fa 0%, #ffffff 100%); border-bottom: 1px solid #f6e3ec; text-align: center;">
              <!-- Emblem & Title -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="padding-bottom: 14px;">
                    <span style="display: inline-block; padding: 8px 18px; background: #fff0f5; border: 1px solid #f2c7d9; border-radius: 999px; font-size: 11px; font-weight: 700; color: #eb3f67; letter-spacing: 1.5px; text-transform: uppercase;">
                      Official Registration Confirmation
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; font-size: 32px; font-weight: 800; color: #381b4e; letter-spacing: -0.5px; line-height: 1.2;">
                      CIIM <span style="color: #eb3f67;">2026</span>
                    </h1>
                    <p style="margin: 6px 0 0 0; font-size: 13px; font-weight: 600; color: #821c56; text-transform: uppercase; letter-spacing: 1px;">
                      Controversies in Infertility Management
                    </p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #7a6e78;">
                      Prashanth Fertility Research Centre
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body Content -->
          <tr>
            <td style="padding: 36px 36px 24px 36px;">
              
              <!-- Greeting -->
              <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #381b4e;">
                Dear ${escapeHtml(displayName)},
              </h2>

              <!-- Lead Quote Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; background: #fff4f8; border-left: 4px solid #eb3f67; border-radius: 0 12px 12px 0;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; font-size: 15px; font-style: italic; font-weight: 600; color: #821c56; line-height: 1.5;">
                      “A historic first. A new surgical era. An extraordinary scientific journey.”
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Intro Paragraphs -->
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.65; color: #3d3040;">
                We are delighted to welcome you to <strong>CIIM 2026 – Controversies in Infertility Management!</strong>
              </p>

              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.65; color: #3d3040;">
                Your registration is confirmed, and you are now part of a landmark gathering dedicated to pushing the boundaries of infertility care, advancing surgical precision, and elevating ART outcomes.
              </p>

              <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 1.65; color: #3d3040;">
                At CIIM 2026, innovation meets expertise as we explore the future of reproductive medicine through scientific discussions, advanced surgical approaches, and real-time tele-transmission of robotic surgery.
              </p>

              <!-- Event Highlights Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; background: #faf5f8; border-radius: 14px; border: 1px solid #ebdbe3;">
                <tr>
                  <td style="padding: 22px;">
                    <p style="margin: 0 0 14px 0; font-size: 12px; font-weight: 800; color: #821c56; text-transform: uppercase; letter-spacing: 1.5px;">
                      Your Conference Registration
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="28" valign="top" style="font-size: 16px; line-height: 24px;">🆔</td>
                        <td style="padding-bottom: 10px; font-size: 14px; color: #221226; line-height: 22px;">
                          <strong>Registration ID:</strong> <span style="font-family: ui-monospace, monospace; font-weight: 700; color: #821c56;">${escapeHtml(registration.registrationCode)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td width="28" valign="top" style="font-size: 16px; line-height: 24px;">🎫</td>
                        <td style="padding-bottom: 10px; font-size: 14px; color: #221226; line-height: 22px;">
                          <strong>Pass Category:</strong> ${escapeHtml(ticketType.name)}
                        </td>
                      </tr>
                      ${companyName ? `
                      <tr>
                        <td width="28" valign="top" style="font-size: 16px; line-height: 24px;">🏢</td>
                        <td style="padding-bottom: 10px; font-size: 14px; color: #221226; line-height: 22px;">
                          <strong>Company / Sponsor:</strong> ${escapeHtml(companyName)}
                        </td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td width="28" valign="top" style="font-size: 16px; line-height: 24px;">📅</td>
                        <td style="padding-bottom: 10px; font-size: 14px; color: #221226; line-height: 22px;">
                          <strong>Dates:</strong> 21st &amp; 22nd November 2026
                        </td>
                      </tr>
                      <tr>
                        <td width="28" valign="top" style="font-size: 16px; line-height: 24px;">📍</td>
                        <td style="padding-bottom: 10px; font-size: 14px; color: #221226; line-height: 22px;">
                          <strong>Venue:</strong> ${escapeHtml(venue)}
                        </td>
                      </tr>
                      <tr>
                        <td width="28" valign="top" style="font-size: 16px; line-height: 24px;">🌐</td>
                        <td style="font-size: 14px; color: #221226; line-height: 22px;">
                          <strong>Format:</strong> In-Person &amp; Live Tele-Robotic Surgery Session
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Theme Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px; background: linear-gradient(135deg, #381b4e 0%, #551e5e 100%); border-radius: 14px; color: #ffffff;">
                <tr>
                  <td style="padding: 20px 24px; text-align: center;">
                    <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 1.5px;">
                      Conference Theme
                    </p>
                    <p style="margin: 0; font-size: 15px; font-weight: 600; line-height: 1.5; color: #ffffff;">
                      Breaking Boundaries, Elevating Surgical Precision &amp; ART Outcomes
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Official Delegate Pass & QR Code Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px; background: #ffffff; border: 2px dashed #f2c7d9; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(56, 27, 78, 0.04);">
                <tr>
                  <td style="padding: 26px 20px; text-align: center;">
                    <span style="display: inline-block; padding: 4px 14px; background: #fff0f5; border: 1px solid #f2c7d9; border-radius: 999px; font-size: 11px; font-weight: 700; color: #821c56; text-transform: uppercase; letter-spacing: 1px;">
                      Official Delegate Pass &amp; Entry QR
                    </span>

                    <h3 style="margin: 12px 0 4px 0; font-size: 18px; font-weight: 700; color: #381b4e;">
                      ${escapeHtml(displayName)}
                    </h3>
                    <p style="margin: 0 0 16px 0; font-size: 12px; color: #7a6e78;">
                      Delegate Registration Confirmed • The Leela Palace, Chennai
                    </p>

                    <!-- Inline QR Code Frame -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 16px auto;">
                      <tr>
                        <td align="center" style="background: #ffffff; padding: 12px; border-radius: 14px; border: 1px solid #ebdbe3; box-shadow: 0 4px 16px rgba(56, 27, 78, 0.08);">
                          <img src="cid:ticket-qr" alt="Delegate QR Entry Code" width="180" height="180" style="display: block; width: 180px; height: 180px; object-fit: contain; border-radius: 8px;" />
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0 0 18px 0; font-size: 12px; font-weight: 600; color: #821c56;">
                      📲 Present this QR at the venue check-in desk for fast-track badge issuance
                    </p>

                    <!-- Pass CTA Button -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                      <tr>
                        <td align="center">
                          <a href="${escapeHtml(ticketUrl)}" target="_blank" style="display: inline-block; padding: 14px 34px; background: linear-gradient(135deg, #eb3f67 0%, #c2185b 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 999px; box-shadow: 0 6px 18px rgba(235, 63, 103, 0.35); letter-spacing: 0.3px;">
                            🎟️ Open Digital Pass &amp; Schedule
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding-top: 10px;">
                          <p style="margin: 0; font-size: 11px; color: #7a6e78;">
                            Direct pass link: <a href="${escapeHtml(ticketUrl)}" target="_blank" style="color: #eb3f67; word-break: break-all; font-weight: 600;">${escapeHtml(ticketUrl)}</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Closing -->
              <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: #3d3040;">
                Get ready to be part of meaningful conversations, groundbreaking perspectives, and a shared vision for the future of infertility management.
              </p>

              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #3d3040;">
                The future of infertility care is evolving. Be part of the conversation.
              </p>

              <p style="margin: 0 0 28px 0; font-size: 14px; line-height: 1.6; color: #3d3040;">
                We look forward to welcoming you to Chennai for an inspiring scientific experience!
              </p>

              <!-- Sign-off -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #f0e1ea; padding-top: 20px;">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #381b4e;">Warm regards,</p>
                    <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: 700; color: #eb3f67;">Team CIIM 2026</p>
                    <p style="margin: 2px 0 0 0; font-size: 13px; color: #7a6e78;">Prashanth Fertility Research Centre</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #231238; color: #e5d9e8; font-size: 12px; text-align: center; line-height: 1.6;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #ffffff;">
                CIIM 2026 | Prashanth Fertility and Research Centre Pvt. Ltd.
              </p>
              <p style="margin: 0 0 8px 0; color: #baabc0;">
                No. 77, Harrington Road, Chetpet, Chennai – 600 031, Tamil Nadu, India
              </p>
              <p style="margin: 0; color: #9c89a3;">
                Direct inquiries: <a href="mailto:infociim@pfrcivf.com" style="color: #f59e0b; text-decoration: none;">infociim@pfrcivf.com</a> | 
                Website: <a href="https://ciim.prashanthfertility.com" target="_blank" style="color: #f59e0b; text-decoration: none;">ciim.prashanthfertility.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Dear ${displayName},`,
    '',
    `“A historic first. A new surgical era. An extraordinary scientific journey.”`,
    '',
    `We are delighted to welcome you to CIIM 2026 – Controversies in Infertility Management!`,
    `Your registration for ${event.title} is confirmed.`,
    '',
    `Registration ID: ${registration.registrationCode}`,
    `Pass: ${ticketType.name}`,
    companyName ? `Company: ${companyName}` : null,
    `Dates: 21st & 22nd November 2026`,
    `Venue: ${venue}`,
    `Format: In-Person & Live Tele-Robotic Surgery Session`,
    '',
    `THEME: Breaking Boundaries, Elevating Surgical Precision & ART Outcomes`,
    '',
    `Open Digital Pass & Schedule: ${ticketUrl}`,
    '',
    'Your official PDF ticket pass and scientific brochure are attached.',
    '',
    'Warm regards,',
    'Team CIIM 2026',
    'Prashanth Fertility Research Centre',
  ]
    .filter((line) => line !== null)
    .join('\n');

  const fs = require('fs');
  const path = require('path');
  const attachments = [
    { filename: `${registration.registrationCode}.pdf`, content: pdf, contentType: 'application/pdf' },
    { filename: 'ticket-qr.png', content: qr, contentType: 'image/png', cid: 'ticket-qr' },
  ];

  // Attach official brochure if available
  const brochurePath = path.join(__dirname, '../../../assets/CIIM_2026_Brochure.pdf');
  if (fs.existsSync(brochurePath)) {
    attachments.push({
      filename: 'CIIM_2026_Scientific_Brochure.pdf',
      path: brochurePath,
      contentType: 'application/pdf',
    });
  }

  // Attach tele-robotic link creative if available
  const mapCandidates = [
    path.join(__dirname, '../../../assets/Chennai_to_Apex_Hospital_Moradabad_Tele-Robotic_Link.pdf'),
    path.join(__dirname, '../../../assets/Chennai_to_Apex_Hospital_Moradabad_Tele-Robotic_Link.png'),
    path.join(__dirname, '../../../../temp/Chennai_to_Apex_Hospital_Moradabad_Tele-Robotic_Link.png'),
  ];
  for (const candidate of mapCandidates) {
    if (fs.existsSync(candidate)) {
      attachments.push({
        filename: 'Chennai_to_Apex_Hospital_Moradabad_Tele-Robotic_Link' + path.extname(candidate),
        path: candidate,
      });
      break;
    }
  }

  return sendMail({
    to: registration.attendee.email,
    subject,
    html,
    text,
    attachments,
  });
}

module.exports = { sendTicketEmail };
