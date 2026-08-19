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

  await prisma.user.upsert({
    where: { email: login },
    update: { passwordHash, name: "Admin" },
    create: {
      email: login,
      passwordHash,
      name: "Admin",
    },
  });

  // Eski varsayılan hesabı da admin ile hizala (varsa)
  if (login !== "admin@arpanosu.local") {
    const legacy = await prisma.user.findUnique({
      where: { email: "admin@arpanosu.local" },
    });
    if (legacy && login === "admin") {
      await prisma.user.delete({ where: { id: legacy.id } }).catch(() => null);
    }
  }

  console.log(
    `Admin hazır: ${login} / (şifre: ${password ? ".env ADMIN_PASSWORD" : "dev varsayılan — değiştirin"})`,
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
