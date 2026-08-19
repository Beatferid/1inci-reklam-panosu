import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const cs = await p.campaign.findMany({ orderBy: { updatedAt: "desc" } });
  for (const c of cs) {
    console.log({
      name: c.name,
      status: c.status,
      hasTarget: Boolean(c.targetImagePath),
      hasMind: Boolean(c.mindPath),
      hasMedia: Boolean(c.mediaPath),
    });
  }
  await p.$disconnect();
}
main();
