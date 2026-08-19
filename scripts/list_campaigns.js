const { PrismaClient } = require('@prisma/client');
(async function () {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.campaign.findMany({ select: { id: true, slug: true, wheelEnabled: true, updatedAt: true } });
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
