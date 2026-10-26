import { recordAudit } from "@/lib/audit";
import { body, failure, guard } from "@/lib/http";
import { perform } from "@/lib/manager";
import { oauthBusy } from "@/lib/oauth";
export async function POST(request: Request) {
  try {
    guard(request, true);
    if (oauthBusy())
      throw new Error("Selesaikan atau batalkan OAuth sebelum mengubah akun.");
    const data = await body(request);
    if (!["switch", "rotate", "delete", "restart"].includes(data.action))
      throw new Error("Aksi tidak valid.");
    return Response.json(await perform(data.action, data.id));
  } catch (e) {
    await recordAudit("actions_failed");
    return failure(e);
  }
}
