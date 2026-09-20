import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '@/core/config'
import { AppError } from '@/core/error'
import { ERRORS, HttpStatus } from '@/shared/constants'
import { sendMail } from './mailer'

const resendSendMock = vi.fn<
  (payload: { from: string; to: string; subject: string; html: string }) => Promise<{
    data: unknown
    error: { message: string; name: string } | null
  }>
>()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function Resend() {
    return {
      emails: {
        send: async (payload: { from: string; to: string; subject: string; html: string }) =>
          resendSendMock(payload),
      },
    }
  }),
}))

beforeEach(() => {
  resendSendMock.mockReset()
})

describe('sendMail', () => {
  it('sends the mail via Resend with the configured from address and given fields', async () => {
    resendSendMock.mockResolvedValue({ data: { id: 'email-1' }, error: null })

    await sendMail({ to: 'jane@example.com', subject: 'Hi', html: '<p>Hi</p>' })

    expect(resendSendMock).toHaveBeenCalledWith({
      from: env.EMAIL_FROM,
      to: 'jane@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
    })
  })

  it('resolves without throwing on success', async () => {
    resendSendMock.mockResolvedValue({ data: { id: 'email-1' }, error: null })

    await expect(
      sendMail({ to: 'jane@example.com', subject: 'Hi', html: '<p>Hi</p>' })
    ).resolves.toBeUndefined()
  })

  it('throws a generic AppError with the mail-failure message when Resend returns an error', async () => {
    resendSendMock.mockResolvedValue({
      data: null,
      error: { message: 'invalid api key', name: 'validation_error' },
    })

    await expect(
      sendMail({ to: 'jane@example.com', subject: 'Hi', html: '<p>Hi</p>' })
    ).rejects.toMatchObject({
      message: ERRORS.MAIL.SEND_FAILED,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    })
  })

  it('never leaks the raw Resend error message to the caller', async () => {
    resendSendMock.mockResolvedValue({
      data: null,
      error: { message: 'invalid api key', name: 'validation_error' },
    })

    await expect(
      sendMail({ to: 'jane@example.com', subject: 'Hi', html: '<p>Hi</p>' })
    ).rejects.toBeInstanceOf(AppError)
  })
})
