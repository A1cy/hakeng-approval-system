import { prisma } from '../lib/prisma'

async function main() {
  // Create test users
  const user1 = await prisma.user.upsert({
    where: { email: 'john.doe@hakeng.com' },
    update: {},
    create: {
      email: 'john.doe@hakeng.com',
      name: 'John Doe',
      department: 'Engineering',
    },
  })

  const user2 = await prisma.user.upsert({
    where: { email: 'jane.smith@hakeng.com' },
    update: {},
    create: {
      email: 'jane.smith@hakeng.com',
      name: 'Jane Smith',
      department: 'Finance',
    },
  })

  const user3 = await prisma.user.upsert({
    where: { email: 'bob.manager@hakeng.com' },
    update: {},
    create: {
      email: 'bob.manager@hakeng.com',
      name: 'Bob Manager',
      department: 'Management',
    },
  })

  console.log('✅ Seeded users:', { user1, user2, user3 })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
