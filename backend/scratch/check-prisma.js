const { prisma } = require('../prisma/client');

async function checkPrisma() {
  try {
    console.log('Testing Prisma Connection...');
    const count = await prisma.transaction.count();
    console.log('Prisma Connection Success! Transaction count:', count);
    process.exit(0);
  } catch (err) {
    console.error('Prisma Connection Failed:', err.message);
    process.exit(1);
  }
}

checkPrisma();
