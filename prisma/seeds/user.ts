import { hash } from 'bcryptjs'
import { Role } from '../../src/generated/prisma/client'
import type { PrismaClient } from '../../src/generated/prisma/client'

interface SeedUser {
  email: string
  firstName: string
  lastName: string
  role: Role
}

const SALT_ROUNDS = 10
const SEED_PASSWORD = '!Qwer1234'
const SEED_USERS: SeedUser[] = [
  {
    email: 'tripsurance.admin@mailinator.com',
    firstName: 'Tripsurance',
    lastName: 'Admin',
    role: Role.ADMIN,
  },
  {
    email: 'tripsurance.superadmin@mailinator.com',
    firstName: 'Tripsurance',
    lastName: 'Super Admin',
    role: Role.SUPER_ADMIN,
  },
]

export async function seedUsers(prisma: PrismaClient): Promise<void> {
  const passwordHash = await hash(SEED_PASSWORD, SALT_ROUNDS)
  const emails = SEED_USERS.map((user) => user.email)

  const before = await prisma.user.count()
  const { count } = await prisma.user.deleteMany({ where: { email: { in: emails } } })
  console.log(`Users before: ${before}, removed colliding: ${count}`)

  for (const user of SEED_USERS) {
    await prisma.user.create({
      data: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        password: passwordHash,
        role: user.role,
        isActive: true,
        isEmailVerified: true,
      },
    })

    console.log(`✔ Seeded ${user.role.padEnd(11)} ${user.email}`)
  }

  console.log(`✔ Seeded ${SEED_USERS.length} users`)
}
