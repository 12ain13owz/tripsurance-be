import { Resend } from 'resend'
import { env } from '@/core/config'
import { wrapUnexpected } from '@/core/error'
import { ERRORS } from '@/shared/constants'
import type { SendMail } from './mailer.type'

const resend = new Resend(env.RESEND_API_KEY)

export const sendMail = async ({ to, subject, html }: SendMail): Promise<void> => {
  const mailConfig = {
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
  }

  await wrapUnexpected(
    async () => {
      const { error } = await resend.emails.send(mailConfig)
      if (error) {
        throw new Error(error.message)
      }
    },
    {
      operation: 'sendMail',
      message: ERRORS.MAIL.SEND_FAILED,
      metadata: { from: mailConfig.from, to: mailConfig.to },
    }
  )
}
