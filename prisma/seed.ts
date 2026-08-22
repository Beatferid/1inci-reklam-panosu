import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const login = (process.env.ADMIN_EMAIL || "admin").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const isProd = process.env.NODE_ENV === "production";

  if (!password) {
    if (isProd) {
      throw new Error(
        "ADMIN_PASSWORD ortam değişkeni production'da zorunludur.",
      );
    }
    console.warn(
      "Uyarı: ADMIN_PASSWORD tanımlı değil — geliştirme için geçici 'admin' kullanılıyor. Production'da mutlaka güçlü bir şifre ayarlayın.",
    );
  }

  const effectivePassword = password || "admin";
  if (isProd && effectivePassword.length < 8) {
    throw new Error("ADMIN_PASSWORD en az 8 karakter olmalıdır.");
  }

  const passwordHash = await bcrypt.hash(effectivePassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: login },
    update: {
      passwordHash,
      name: "Admin",
      role: "SUPER",
      active: true,
    },
    create: {
      email: login,
      passwordHash,
      name: "Admin",
      role: "SUPER",
      active: true,
    },
  });

  // Mevcut sahipsiz kayıtları süper admin'e bağla
  const orphanCampaigns = await prisma.campaign.updateMany({
    where: { ownerId: null },
    data: { ownerId: admin.id },
  });
  const orphanCatalogs = await prisma.catalog.updateMany({
    where: { ownerId: null },
    data: { ownerId: admin.id },
  });
  const orphanBoxes = await prisma.feedbackBox.updateMany({
    where: { ownerId: null },
    data: { ownerId: admin.id },
  });

  if (login !== "admin@arpanosu.local") {
    const legacy = await prisma.user.findUnique({
      where: { email: "admin@arpanosu.local" },
    });
    if (legacy && login === "admin") {
      await prisma.user.delete({ where: { id: legacy.id } }).catch(() => null);
    }
  }

  console.log(
    `Süper admin hazır: ${login} (role=SUPER). Sahipsiz bağlandı: kampanya ${orphanCampaigns.count}, katalog ${orphanCatalogs.count}, kutu ${orphanBoxes.count}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
