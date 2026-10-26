import { connection } from "next/server";
import { ensureAudit } from "@/lib/audit";
import { pool } from "@/lib/db";
import { failure, guard } from "@/lib/http";
export async function GET(request: Request) {
  await connection();
  try {
    guard(request);
  } catch (e) {
    return failure(e);
  }
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    async start(controller) {
      let stopped = false;
      let client: import("pg").PoolClient | undefined;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      const send = (event: string, data: unknown) => {
        if (!stopped)
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
      };
      cleanup = () => {
        if (stopped) return;
        stopped = true;
        if (heartbeat) clearInterval(heartbeat);
        request.signal.removeEventListener("abort", cleanup);
        if (client) {
          client.removeAllListeners("notification");
          client.release(true);
        }
        try {
          controller.close();
        } catch {}
      };
      request.signal.addEventListener("abort", cleanup, { once: true });
      if (request.signal.aborted) {
        cleanup();
        return;
      }
      try {
        await ensureAudit();
        const connection = await pool.connect();
        if (stopped) {
          connection.release(true);
          return;
        }
        client = connection;
        client.on("error", () => {
          send("unavailable", {
            message:
              "Koneksi log database terputus; riwayat mungkin tidak lengkap.",
          });
          cleanup();
        });
        client.on("notification", (n) => {
          if (n.channel === "am_activity" && n.payload)
            send("log", JSON.parse(n.payload));
        });
        await client.query("LISTEN am_activity");
        const history = await client.query(
          `SELECT id::text, created_at AS "createdAt",level,event,message FROM activity_logs ORDER BY id DESC LIMIT 100`,
        );
        for (const row of history.rows.reverse()) send("log", row);
        send("ready", { message: "Terhubung" });
        if (!stopped) heartbeat = setInterval(() => send("ping", {}), 15000);
      } catch {
        send("unavailable", {
          message:
            "Database log tidak tersedia. Kejadian mungkin tidak tersimpan; periksa PostgreSQL.",
        });
        cleanup();
      }
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
