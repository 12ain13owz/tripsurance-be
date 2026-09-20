import { PrismaPg } from '@prisma/adapter-pg'
import { env } from '@/core/config'
import { logger } from '@/core/logger'
import { PrismaClient } from '@/generated/prisma/client'

const adapter = new PrismaPg(env.DATABASE_URL)

export const prisma = new PrismaClient({ adapter })

export const connectDatabase = async (): Promise<void> => {
  await prisma.$connect()
  logger.info('Database Connected to PostgreSQL', { source: false })
}

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect()
  logger.info('Database Disconnected from PostgreSQL', { source: false })
}
