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

  const send = (async () => {
    const { error } = await resend.emails.send(mailConfig)
    if (error) {
      throw new Error(error.message)
    }
  })()
  await wrapUnexpected(
    send,
    'sendMail',
    { from: mailConfig.from, to: mailConfig.to },
    ERRORS.MAIL.SEND_FAILED
  )
}
