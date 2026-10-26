import { connection } from "next/server";
import { recordAudit } from "@/lib/audit";
import { body, failure, guard } from "@/lib/http";
import { cancelLogin, getJob, startLogin, submitCode } from "@/lib/oauth";
export async function GET(request: Request) {
  await connection();
  try {
    guard(request);
    return Response.json(
      getJob(new URL(request.url).searchParams.get("id") || ""),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    await recordAudit("oauth_failed");
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    guard(request, true);
    const d = await body(request);
    if (d.cancel) return Response.json(cancelLogin(d.id));
    if (d.id) return Response.json(submitCode(d.id, d.code));
    return Response.json(await startLogin(d.alias));
  } catch (e) {
    await recordAudit("oauth_failed");
    return failure(e);
  }
}
