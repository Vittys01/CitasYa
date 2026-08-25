import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "Volvv11350@gmail.com";
  const password = "Leya2026";
  const hashed = await bcrypt.hash(password, 12);

  // Asignar al primer negocio disponible
  const business = await prisma.business.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!business) throw new Error("No se encontró ningún negocio activo.");

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, name: "Volvv", role: Role.ADMIN, businessId: business.id },
    create: {
      email,
      password: hashed,
      name: "Volvv",
      role: Role.ADMIN,
      businessId: business.id,
    },
  });

  console.log("✅ Usuario creado/actualizado:", user.email, "| Rol:", user.role, "| Negocio:", user.businessId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
