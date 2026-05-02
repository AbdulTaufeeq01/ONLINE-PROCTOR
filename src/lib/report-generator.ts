import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM = 'Online Proctor <noreply@onlineproctor.edu>';

interface BuildInviteEmailHtmlParams {
  studentName: string;
  examTitle: string;
  durationMinutes: number;
  joinUrl: string;
  teacherName?: string;
}

/**
 * Build HTML for exam invite email
 */
export function buildInviteEmailHtml({
  studentName,
  examTitle,
  durationMinutes,
  joinUrl,
  teacherName,
}: BuildInviteEmailHtmlParams): string {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background-color: #f9fafb;
      }
      .header {
        background-color: #1f2937;
        color: white;
        padding: 30px;
        text-align: center;
        border-radius: 8px 8px 0 0;
      }
      .header h1 {
        margin: 0;
        font-size: 24px;
        font-weight: bold;
      }
      .content {
        background-color: white;
        padding: 30px;
        border-radius: 0 0 8px 8px;
        border: 1px solid #e5e7eb;
      }
      .greeting {
        font-size: 16px;
        margin-bottom: 20px;
      }
      .exam-details {
        background-color: #f3f4f6;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
      }
      .exam-details p {
        margin: 10px 0;
      }
      .exam-details strong {
        color: #1f2937;
      }
      .button {
        display: inline-block;
        background-color: #3b82f6;
        color: white;
        text-decoration: none;
        padding: 12px 30px;
        border-radius: 6px;
        font-weight: bold;
        margin: 20px 0;
        text-align: center;
      }
      .button:hover {
        background-color: #2563eb;
      }
      .join-link {
        word-break: break-all;
        color: #3b82f6;
        font-family: monospace;
        font-size: 12px;
      }
      .footer {
        color: #6b7280;
        font-size: 12px;
        margin-top: 20px;
        border-top: 1px solid #e5e7eb;
        padding-top: 20px;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>📝 Exam Invitation</h1>
      </div>
      <div class="content">
        <div class="greeting">
          <p>Hello <strong>${studentName}</strong>,</p>
          <p>You have been invited to take an exam. Please review the details below and click the button to join.</p>
        </div>

        <div class="exam-details">
          <p><strong>Exam Title:</strong><br>${examTitle}</p>
          <p><strong>Duration:</strong><br>${durationMinutes} minutes</p>
          ${teacherName ? `<p><strong>Teacher:</strong><br>${teacherName}</p>` : ''}
        </div>

        <p>Click the button below to join the exam:</p>
        <div style="text-align: center;">
          <a href="${joinUrl}" class="button">Join Exam</a>
        </div>

        <p>Or copy this link in your browser:</p>
        <div class="join-link">${joinUrl}</div>

        <p style="margin-top: 20px; font-size: 14px;">
          <strong>Important:</strong>
          <ul style="font-size: 14px;">
            <li>You will need to enable your webcam during the exam</li>
            <li>Make sure you are in a quiet, well-lit environment</li>
            <li>Do not switch browser tabs or applications during the exam</li>
            <li>The exam will auto-submit when time expires</li>
          </ul>
        </p>
      </div>

      <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>© 2026 Online Proctor. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
  `.trim();
}