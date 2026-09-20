import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { seedUsers } from './seeds'

function createSeedPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL ?? ''
  const adapter = new PrismaPg(connectionString)
  return new PrismaClient({ adapter })
}

export async function runSeed(): Promise<void> {
  const prisma = createSeedPrisma()

  try {
    await seedUsers(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

runSeed().catch((error) => {
  console.error(error)
  process.exit(1)
})
