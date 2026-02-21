import { prisma } from "@/lib/db";
import { normalisePhone, buildPaginationMeta } from "@/lib/utils";
import type { CreateClientInput, UpdateClientInput, ClientWithHistory } from "@/types";
import type { Client } from "@prisma/client";

export async function createClient(input: CreateClientInput): Promise<Client> {
  const phone = normalisePhone(input.phone);

  const existing = await prisma.client.findUnique({ where: { phone } });
  if (existing) throw new Error(`Ya existe un cliente con el teléfono ${phone}.`);

  const email = input.email?.trim() || null;
  return prisma.client.create({
    data: { name: input.name, phone, email, notes: input.notes ?? undefined },
  });
}

export async function updateClient(
  id: string,
  input: UpdateClientInput
): Promise<Client> {
  const data: { name?: string; phone?: string; email?: string | null; notes?: string } = { ...input };
  if (input.phone) data.phone = normalisePhone(input.phone);
  if (Object.prototype.hasOwnProperty.call(input, "email")) {
    data.email = (input.email && input.email.trim()) ? input.email.trim() : null;
  }

  return prisma.client.update({ where: { id }, data });
}

export async function getClientById(id: string): Promise<ClientWithHistory | null> {
  return prisma.client.findUnique({
    where: { id },
    include: {
      appointments: {
        include: {
          service: { select: { id: true, name: true, duration: true, color: true } },
          manicurist: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
          client: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: { startAt: "desc" },
      },
    },
  }) as Promise<ClientWithHistory | null>;
}

export async function searchClients(
  query: string,
  page = 1,
  limit = 20
) {
  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { phone: { contains: query } },
          { email: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, clients] = await prisma.$transaction([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { appointments: true } },
      },
    }),
  ]);

  return { clients, meta: buildPaginationMeta(total, page, limit) };
}

export async function deleteClient(id: string): Promise<void> {
  // Soft delete: check for future appointments first
  const futureAppt = await prisma.appointment.findFirst({
    where: {
      clientId: id,
      startAt: { gt: new Date() },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
  });

  if (futureAppt) {
    throw new Error(
      "No se puede eliminar el cliente porque tiene turnos futuros activos."
    );
  }

  await prisma.client.delete({ where: { id } });
}
