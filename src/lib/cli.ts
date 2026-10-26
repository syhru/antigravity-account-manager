import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { recordAudit } from "./audit";
export function cliPath() {
  const file =
    process.env.AGY_AUTH_BINARY ||
    path.join(
      process.env.APPDATA || "",
      "npm/node_modules/@fikrilal/agy-auth/npm/vendor",
      `agy-auth-win32-${process.arch}.exe`,
    );
  if (!existsSync(/* turbopackIgnore: true */ file))
    throw new Error(
      "Binary agy-auth tidak ditemukan. Atur AGY_AUTH_BINARY di .env.local.",
    );
  return file;
}
export function cliEnv() {
  return {
    ...process.env,
    AGY_AUTH_NO_UPDATE_CHECK: "1",
    PATH: `${path.join(process.env.LOCALAPPDATA || "", "agy/bin")}${path.delimiter}${process.env.PATH || ""}`,
  };
}
export function runCli(args: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) =>
    execFile(
      /* turbopackIgnore: true */ cliPath(),
      ["--json", ...args],
      {
        env: cliEnv(),
        timeout: 60000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      },
      async (err, stdout) => {
        let parsed: {
          data: Record<string, unknown>;
          error?: { message: string };
        };
        try {
          parsed = JSON.parse(stdout);
        } catch {
          await recordAudit("cli_failed");
          reject(new Error("agy-auth tidak mengembalikan JSON yang valid."));
          return;
        }
        if (err || parsed.error) {
          await recordAudit("cli_failed");
          reject(
            new Error(parsed.error?.message || "Perintah agy-auth gagal."),
          );
          return;
        }
        resolve(parsed.data);
      },
    ),
  );
}
export function spawnLogin(alias: string) {
  return spawn(
    /* turbopackIgnore: true */ cliPath(),
    [
      "--json",
      "login",
      "--alias",
      alias,
      "--no-browser",
      "--agy",
      process.env.AGY_BINARY ||
        path.join(process.env.LOCALAPPDATA || "", "agy/bin/agy.exe"),
    ],
    { env: cliEnv(), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
}
