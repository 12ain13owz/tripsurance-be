import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '@/app'
import { HttpStatus } from '@/shared/constants'
import type { AppResponse } from '@/shared/types'

const app = createApp()

describe('GET /health', () => {
  it('returns 200 with the success response envelope', async () => {
    const res = await request(app).get('/health')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body).toMatchObject({
      message: 'Operation successful',
    })
    expect(body.timestamp).toBeDefined()
  })
})

describe('GET /health/error', () => {
  it('goes through errorHandler and returns the AppError status', async () => {
    const res = await request(app).get('/health/error')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.BAD_REQUEST)
    expect(body.message).toBe('Test error function')
  })
})
