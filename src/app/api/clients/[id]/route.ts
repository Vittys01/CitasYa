import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/utils";
import { getClientById, updateClient, deleteClient } from "@/services/client.service";
import { z } from "zod";

const phoneRefine = (v: string) => {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
};

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(1).refine(phoneRefine, "Teléfono inválido (código país + número, 8-15 dígitos)").optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  notes: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });

  const { id } = await params;
  const client = await getClientById(id);
  if (!client) return NextResponse.json(apiError("Cliente no encontrado"), { status: 404 });
  return NextResponse.json(apiSuccess(client));
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError(parsed.error.message, "VALIDATION"), { status: 422 });
  }

  try {
    const updated = await updateClient(id, parsed.data);
    return NextResponse.json(apiSuccess(updated));
  } catch (err) {
    return NextResponse.json(apiError(String(err)), { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json(apiError("Unauthorized"), { status: 401 });

  // Only admins/owners can delete clients
  if (session.user.role !== "ADMIN" && session.user.role !== "OWNER") {
    return NextResponse.json(apiError("Forbidden", "FORBIDDEN"), { status: 403 });
  }

  const { id } = await params;
  try {
    await deleteClient(id);
    return NextResponse.json(apiSuccess({ deleted: true }));
  } catch (err) {
    return NextResponse.json(apiError(String(err), "CONFLICT"), { status: 409 });
  }
}
