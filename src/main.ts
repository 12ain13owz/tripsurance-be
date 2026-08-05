import { createApp } from '@/app'
import { env } from '@/core/config'
import { startServer } from '@/core/server'
import { connectDatabase } from './core/database/prisma'

await connectDatabase()
startServer(createApp(), env.PORT)
