import { createApp } from '@/app'
import { env } from '@/core/config'
import { startServer } from '@/core/server'
import { startTokenCleanup } from '@/features/auth'
import { connectDatabase } from './core/database/prisma'

await connectDatabase()
startServer(createApp(), env.PORT)
startTokenCleanup()
