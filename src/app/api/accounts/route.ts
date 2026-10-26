import { connection } from "next/server";
import { recordAudit } from "@/lib/audit";
import { failure, guard } from "@/lib/http";
import { exclusive, snapshot } from "@/lib/manager";
export async function GET(request: Request) {
  await connection();
  try {
    guard(request);
    return Response.json(await exclusive(snapshot), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    await recordAudit("accounts_failed");
    return failure(e);
  }
}
