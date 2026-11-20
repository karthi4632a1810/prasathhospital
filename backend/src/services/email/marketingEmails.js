'use strict';

/**
 * Builds responsive, high-end HTML delegate reminder email.
 */
function buildDelegateReminderEmail({
  name = 'Delegate',
  sessionTitle = '',
  customMessage = '',
  eventTitle = 'CIIM 2026',
} = {}) {
  const cleanName = String(name || '').replace(/^Dr\.\s*/i, '').trim() || 'Delegate';
  const displayName = `Dr. ${cleanName}`;
  const subject = `Conference Reminder: CIIM 2026 | Delegate Notice & Schedule`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f1f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #221226;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f7f1f5; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(56, 27, 78, 0.08); border: 1px solid #f2dfe8;">
          <tr>
            <td height="6" style="background: linear-gradient(90deg, #381b4e 0%, #eb3f67 50%, #d4af37 100%);">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(180deg, #fff7fa 0%, #ffffff 100%); border-bottom: 1px solid #f6e3ec;">
              <span style="display: inline-block; padding: 6px 16px; background: #fff0f5; border: 1px solid #f2c7d9; border-radius: 999px; font-size: 11px; font-weight: 700; color: #eb3f67; letter-spacing: 1px; text-transform: uppercase;">
                Delegate Reminder
              </span>
              <h1 style="margin: 14px 0 4px; font-size: 28px; font-weight: 800; color: #381b4e;">
                CIIM <span style="color: #eb3f67;">2026</span>
              </h1>
              <p style="margin: 0; font-size: 13px; font-weight: 600; color: #821c56; text-transform: uppercase; letter-spacing: 0.5px;">
                Controversies in Infertility Management
              </p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #7a6e78;">
                Prashanth Fertility Research Centre
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #381b4e;">
                Dear ${displayName},
              </p>
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #4a3e4c;">
                We look forward to welcoming you to <strong>CIIM 2026</strong>. Please find your delegate reminder and key conference details below:
              </p>
              ${
                customMessage
                  ? `<div style="margin: 16px 0; padding: 14px 18px; background: #fffbf0; border-left: 4px solid #d4af37; border-radius: 4px; font-size: 13px; line-height: 1.5; color: #694a00;">
                      ${customMessage.replace(/\n/g, '<br/>')}
                    </div>`
                  : ''
              }
              ${
                sessionTitle
                  ? `<div style="margin: 16px 0; padding: 14px 18px; background: #fdf2f7; border-left: 4px solid #eb3f67; border-radius: 4px;">
                      <p style="margin: 0; font-size: 12px; font-weight: 700; color: #eb3f67; text-transform: uppercase;">Highlighted Session</p>
                      <p style="margin: 4px 0 0; font-size: 14px; font-weight: 600; color: #381b4e;">${sessionTitle}</p>
                    </div>`
                  : ''
              }
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; background: #fbf8fa; border-radius: 12px; border: 1px solid #f0e4eb; padding: 16px;">
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #5a4b5c; border-bottom: 1px solid #f2e6ee;">
                    📅 <strong>Dates:</strong> 21st &amp; 22nd November 2026
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #5a4b5c; border-bottom: 1px solid #f2e6ee;">
                    📍 <strong>Venue:</strong> The Leela Palace, MRC Nagar, Chennai
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #5a4b5c;">
                    🎟️ <strong>Desk Contact:</strong> +91 96000 47646 / infociim@pfrcivf.com
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 0; font-size: 13px; line-height: 1.5; color: #6a5e6c;">
                Warm regards,<br />
                <strong>Organising Committee, CIIM 2026</strong><br />
                Prashanth Fertility Research Centre
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Dear ${displayName},\n\nWe look forward to welcoming you to CIIM 2026 - Controversies in Infertility Management.\n\nDates: 21st & 22nd November 2026\nVenue: The Leela Palace, Chennai\n${sessionTitle ? `Session: ${sessionTitle}\n` : ''}${customMessage ? `\nNote: ${customMessage}\n` : ''}\nContact: +91 96000 47646\n\nWarm regards,\nOrganising Committee, CIIM 2026`;

  return { subject, html, text };
}

/**
 * Builds responsive, high-end HTML session schedule & approval email.
 */
function buildSessionApprovalEmail({
  name = 'Delegate',
  sessionTitle = 'Scientific Session',
  sessionTime = '',
  sessionDate = '',
  speakerNames = [],
  track = '',
  customMessage = '',
} = {}) {
  const cleanName = String(name || '').replace(/^Dr\.\s*/i, '').trim() || 'Delegate';
  const displayName = `Dr. ${cleanName}`;
  const subject = `CIIM 2026: Session Schedule & Details - ${sessionTitle}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f1f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #221226;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f7f1f5; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(56, 27, 78, 0.08); border: 1px solid #f2dfe8;">
          <tr>
            <td height="6" style="background: linear-gradient(90deg, #381b4e 0%, #eb3f67 50%, #d4af37 100%);">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(180deg, #fff7fa 0%, #ffffff 100%); border-bottom: 1px solid #f6e3ec;">
              <span style="display: inline-block; padding: 6px 16px; background: #eef7ff; border: 1px solid #bfe0ff; border-radius: 999px; font-size: 11px; font-weight: 700; color: #0066cc; letter-spacing: 1px; text-transform: uppercase;">
                Session Schedule &amp; Agenda
              </span>
              <h1 style="margin: 14px 0 4px; font-size: 26px; font-weight: 800; color: #381b4e;">
                CIIM <span style="color: #eb3f67;">2026</span>
              </h1>
              <p style="margin: 0; font-size: 13px; font-weight: 600; color: #821c56; text-transform: uppercase;">
                Scientific Session Details
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #381b4e;">
                Dear ${displayName},
              </p>
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #4a3e4c;">
                Here are the approved schedule and agenda details for your upcoming session at CIIM 2026:
              </p>

              <!-- Session Highlight Box -->
              <div style="margin: 20px 0; background: linear-gradient(135deg, #fdf8fb 0%, #f7eff5 100%); border: 1.5px solid #ebd3e2; border-radius: 12px; padding: 20px;">
                <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 800; color: #381b4e;">
                  ${sessionTitle}
                </h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${
                    sessionDate
                      ? `<tr>
                          <td style="padding: 4px 0; font-size: 13px; color: #6e5e70; width: 110px;">📅 Date:</td>
                          <td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #221226;">${sessionDate}</td>
                        </tr>`
                      : ''
                  }
                  ${
                    sessionTime
                      ? `<tr>
                          <td style="padding: 4px 0; font-size: 13px; color: #6e5e70;">⏰ Time Slot:</td>
                          <td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #221226;">${sessionTime}</td>
                        </tr>`
                      : ''
                  }
                  ${
                    track
                      ? `<tr>
                          <td style="padding: 4px 0; font-size: 13px; color: #6e5e70;">📍 Hall / Track:</td>
                          <td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #221226;">${track}</td>
                        </tr>`
                      : ''
                  }
                  ${
                    speakerNames && speakerNames.length > 0
                      ? `<tr>
                          <td style="padding: 4px 0; font-size: 13px; color: #6e5e70;">🎤 Speakers:</td>
                          <td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #221226;">${speakerNames.join(', ')}</td>
                        </tr>`
                      : ''
                  }
                </table>
              </div>

              ${
                customMessage
                  ? `<div style="margin: 16px 0; padding: 14px 18px; background: #fffbf0; border-left: 4px solid #d4af37; border-radius: 4px; font-size: 13px; line-height: 1.5; color: #694a00;">
                      ${customMessage.replace(/\n/g, '<br/>')}
                    </div>`
                  : ''
              }

              <p style="margin: 20px 0 0; font-size: 13px; line-height: 1.5; color: #6a5e6c;">
                Warm regards,<br />
                <strong>Scientific Committee, CIIM 2026</strong><br />
                Prashanth Fertility Research Centre
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Dear ${displayName},\n\nCIIM 2026 Session Schedule Details:\n\nSession: ${sessionTitle}\nDate: ${sessionDate || '21-22 November 2026'}\nTime: ${sessionTime || 'Refer Agenda'}\nHall: ${track || 'Main Auditorium'}\nSpeakers: ${speakerNames.join(', ')}\n${customMessage ? `\nNotes: ${customMessage}\n` : ''}\nWarm regards,\nScientific Committee, CIIM 2026`;

  return { subject, html, text };
}

module.exports = {
  buildDelegateReminderEmail,
  buildSessionApprovalEmail,
};
