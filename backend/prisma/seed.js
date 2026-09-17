// Seeds the database from the frontend's existing src/data/mockData.js so the
// site looks identical to the old localStorage-mock demo the first time it's run.
const prisma = require('../src/lib/prisma')
const { seedAll } = require('./seedData')

seedAll(prisma)
  .then(({ adminEmail, adminPassword, demoCustomerEmail, demoPassword }) => {
    console.log('Seed complete.')
    console.log(`Super Admin login: ${adminEmail} / ${adminPassword}`)
    console.log(`Manager login:     manager@foldx.com / ${demoPassword}`)
    console.log(`Support login:     support@foldx.com / ${demoPassword}`)
    console.log(`Demo customer:     ${demoCustomerEmail} / ${demoPassword} (all seeded customers share this password)`)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
