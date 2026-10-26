import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { recordAudit } from "./audit";
import { runCli, spawnLogin } from "./cli";
import { exclusive, snapshot } from "./manager";

type Job = {
  id: string;
  url: string;
  status: "waiting" | "complete" | "error";
  error?: string;
  child: ChildProcessWithoutNullStreams;
  submitted: boolean;
  expires: number;
};
const memory = globalThis as unknown as { oauthJobs?: Map<string, Job> };
const jobs = memory.oauthJobs ?? new Map<string, Job>();
memory.oauthJobs = jobs;
export function oauthBusy() {
  return [...jobs.values()].some((j) => j.status === "waiting");
}
function view(job: Job) {
  return { id: job.id, url: job.url, status: job.status, error: job.error };
}
export function getJob(id: string) {
  const j = jobs.get(id);
  if (!j) throw new Error("Sesi OAuth tidak ditemukan. Mulai ulang login.");
  return view(j);
}
export async function startLogin(alias: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,39}$/.test(alias))
    throw new Error("Alias: 1–40 karakter huruf, angka, tanda - atau _.");
  return exclusive(async () => {
    if (oauthBusy())
      throw new Error("Selesaikan sesi OAuth yang sedang berlangsung.");
    for (const [id, job] of jobs) if (job.expires < Date.now()) jobs.delete(id);
    const previous = await runCli(["list", "--no-usage"]);
    const previousId = (
      previous.accounts as { id: string; active: boolean }[]
    ).find((a) => a.active)?.id;
    const child = spawnLogin(alias);
    const id = randomUUID();
    const job: Job = {
      id,
      url: "",
      status: "waiting",
      child,
      submitted: false,
      expires: Date.now() + 10 * 60 * 1000,
    };
    jobs.set(id, job);
    let buffer = "";
    const read = (chunk: Buffer) => {
      buffer = (buffer + chunk.toString()).slice(-65536);
      const match = buffer.match(/https:\/\/accounts\.google\.com\/[^\s]+/);
      if (match) {
        try {
          const u = new URL(match[0]);
          if (u.hostname === "accounts.google.com") job.url = u.href;
        } catch {}
      }
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    const timer = setTimeout(
      () => {
        job.status = "error";
        job.error = "Sesi OAuth kedaluwarsa. Silakan mulai ulang.";
        void recordAudit("oauth_timeout");
        child.kill();
      },
      10 * 60 * 1000,
    );
    timer.unref();
    child.on("error", () => {
      clearTimeout(timer);
      job.status = "error";
      job.error = "Proses OAuth gagal dimulai.";
      void recordAudit("oauth_process_failed");
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      void exclusive(async () => {
        if (job.status === "error") return;
        if (code !== 0) {
          await recordAudit("oauth_process_failed");
          job.status = "error";
          job.error =
            "Login OAuth gagal. Periksa kode, koneksi, atau mulai ulang login.";
          return;
        }
        try {
          if (previousId)
            await runCli(["switch", previousId, "--target", "cli"]);
          await snapshot();
          job.status = "complete";
          await recordAudit("oauth_complete");
        } catch {
          await recordAudit("oauth_process_failed");
          job.status = "error";
          job.error =
            "Akun mungkin tersimpan, tetapi sinkronisasi gagal. Muat ulang daftar akun.";
        }
      });
    });
    // Briefly wait for CLI client discovery, without exposing process output or tokens.
    await recordAudit("oauth_started");
    const until = Date.now() + 10000;
    while (!job.url && job.status === "waiting" && Date.now() < until)
      await new Promise((r) => setTimeout(r, 100));
    return view(job);
  });
}
export function submitCode(id: string, code: string) {
  const job = jobs.get(id);
  if (!job || job.status !== "waiting" || job.submitted)
    throw new Error("Sesi OAuth tidak aktif.");
  if (!code.trim() || code.length > 8192 || /[\r\n]/.test(code))
    throw new Error("Kode OAuth tidak valid.");
  job.submitted = true;
  job.child.stdin.end(`${code.trim()}\n`);
  return view(job);
}
export function cancelLogin(id: string) {
  const job = jobs.get(id);
  if (job && job.status === "waiting") {
    job.status = "error";
    job.error = "Login dibatalkan.";
    void recordAudit("oauth_cancelled");
    job.child.kill();
  }
  return job ? view(job) : { id, status: "error" };
}
