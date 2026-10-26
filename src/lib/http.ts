export function guard(request: Request, mutation = false) {
  const url = new URL(request.url);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Akses hanya tersedia dari localhost.");
  const host = request.headers.get("host");
  if (
    host &&
    !["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(`http://${host}`).hostname,
    )
  )
    throw new Error("Host tidak valid.");
  const origin = request.headers.get("origin");
  if (origin && origin !== `${url.protocol}//${host || url.host}`)
    throw new Error("Origin tidak valid.");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new Error("Permintaan lintas situs ditolak.");
  if (
    mutation &&
    (!request.headers.get("content-type")?.startsWith("application/json") ||
      !origin)
  )
    throw new Error("Gunakan JSON dengan Origin lokal yang valid.");
}
export function failure(error: unknown) {
  return Response.json(
    { error: error instanceof Error ? error.message : "Terjadi kesalahan." },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}
export async function body(request: Request) {
  const text = await request.text();
  if (text.length > 16384) throw new Error("Payload terlalu besar.");
  return JSON.parse(text);
}
