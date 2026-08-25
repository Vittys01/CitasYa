import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "Volvv11350@gmail.com";
  const password = "Leya2026";
  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, name: "Volvv", role: Role.ADMIN },
    create: {
      email,
      password: hashed,
      name: "Volvv",
      role: Role.ADMIN,
    },
  });

  console.log("✅ Usuario creado/actualizado:", user.email, "| Rol:", user.role);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
