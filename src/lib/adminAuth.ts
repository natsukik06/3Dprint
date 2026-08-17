import type { NextRequest } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { ADMIN_EMAIL } from "@/lib/admin";
import { verifyRequestUser } from "@/lib/verifyRequestUser";

export async function verifyAdminRequest(
  request: NextRequest
): Promise<DecodedIdToken | null> {
  const decoded = await verifyRequestUser(request);
  if (!decoded || decoded.email !== ADMIN_EMAIL) return null;
  return decoded;
}
