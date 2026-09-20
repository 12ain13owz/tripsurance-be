interface PasswordResetEmailParams {
  resetUrl: string
  token: string
  expiresInMinutes: number
}

interface EmailContent {
  subject: string
  html: string
}

const COLORS = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  text: '#1f2937',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  background: '#f1f5f9',
  surface: '#ffffff',
  footerBg: '#f9fafb',
}

export const passwordResetEmail = ({
  resetUrl,
  token,
  expiresInMinutes,
}: PasswordResetEmailParams): EmailContent => ({
  subject: 'Reset your password',
  html: `
    <div style="background-color:${COLORS.background}; padding:40px 16px; font-family:Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">
            <table
              role="presentation"
              width="480"
              cellpadding="0"
              cellspacing="0"
              style="max-width:480px; width:100%; background-color:${COLORS.surface}; border-radius:12px; border:1px solid ${COLORS.border};"
            >
              <tr>
                <td style="padding:28px 32px 0;">
                  <span style="font-size:18px; font-weight:700; color:${COLORS.primary}; letter-spacing:0.3px;">
                    Tripsurance
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 32px 8px;">
                  <h1 style="margin:0 0 16px; font-size:20px; line-height:1.3; color:${COLORS.text};">
                    Reset your password
                  </h1>
                  <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:${COLORS.text};">
                    We received a request to reset the password for your Tripsurance admin account.
                    Click the button below to choose a new one.
                  </p>
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="border-radius:8px; background-color:${COLORS.primary};">
                        <a
                          href="${resetUrl}"
                          target="_blank"
                          style="display:inline-block; padding:12px 28px; font-size:15px; font-weight:700; color:${COLORS.surface}; text-decoration:none; border-radius:8px;"
                        >
                          Reset password
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:28px 0 8px; font-size:13px; line-height:1.6; color:${COLORS.textMuted};">
                    Or copy this code:
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td
                        style="padding:10px 14px; background-color:${COLORS.background}; border:1px solid ${COLORS.border}; border-radius:6px; font-family:'Courier New', Courier, monospace; font-size:13px; color:${COLORS.text}; word-break:break-all; user-select:all;"
                      >
                        ${token}
                      </td>
                    </tr>
                  </table>
                  <p style="margin:16px 0 4px; font-size:13px; line-height:1.6; color:${COLORS.textMuted};">
                    This link will expire in ${expiresInMinutes} minutes.
                  </p>
                  <p style="margin:0 0 24px; font-size:13px; line-height:1.6; color:${COLORS.textMuted};">
                    If you didn't request this, you can safely ignore this email — your password will
                    remain unchanged.
                  </p>
                </td>
              </tr>
              <tr>
                <td
                  style="padding:16px 32px; background-color:${COLORS.footerBg}; border-top:1px solid ${COLORS.border}; border-radius:0 0 12px 12px;"
                >
                  <p style="margin:0; font-size:12px; color:${COLORS.textMuted};">
                    Tripsurance Admin &middot; This is an automated message, please do not reply.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `,
})
