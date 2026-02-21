import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "dayagames13@gmail.com" },
    select: { email: true, password: true },
  });
  if (!user) {
    console.log("Usuario no encontrado");
    return;
  }
  const ok = await bcrypt.compare("123456", user.password);
  console.log("Password '123456' coincide:", ok);
}

main()
  .finally(() => prisma.$disconnect());
