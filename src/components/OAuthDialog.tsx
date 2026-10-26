"use client";
import { ArrowRight, ExternalLink, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "./Dialog";

type Flow = {
  id: string;
  url: string;
  status: "waiting" | "complete" | "error";
  error?: string;
};
export function OAuthDialog({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const [bulk, setBulk] = useState(false);
  const [aliases, setAliases] = useState("");
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const completed = useRef(new Set<string>());
  const completeHandler = useRef(onComplete);
  completeHandler.current = onComplete;
  const currentFlow = useRef<Flow | null>(null);
  currentFlow.current = flow;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      const pending = currentFlow.current;
      if (pending?.status === "waiting")
        void fetch("/api/oauth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: pending.id, cancel: true }),
          keepalive: true,
        }).catch(() => {});
    };
  }, []);
  async function request(body: object) {
    controller.current?.abort();
    controller.current = new AbortController();
    const response = await fetch("/api/oauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.current.signal,
    });
    const data = await response.json();
    if (!response.ok || data.status === "error")
      throw new Error(
        data.error || "Otorisasi Google gagal. Silakan coba lagi.",
      );
    return data as Flow;
  }
  async function start(list: string[], position: number) {
    setBusy(true);
    setError("");
    setCode("");
    setFlow(null);
    try {
      const next = await request({ alias: list[position] });
      if (mounted.current) {
        setQueue(list);
        setIndex(position);
        setFlow(next);
      }
    } catch (err) {
      if (
        mounted.current &&
        !(err instanceof Error && err.name === "AbortError")
      )
        setError(
          err instanceof Error ? err.message : "Tidak dapat memulai otorisasi.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!flow || flow.status !== "waiting") return;
    const abort = new AbortController();
    let stopped = false;
    let timeout: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(
          `/api/oauth?id=${encodeURIComponent(flow.id)}`,
          { cache: "no-store", signal: abort.signal },
        );
        const data: Flow = await response.json();
        if (!response.ok || data.status === "error")
          throw new Error(
            data.error ||
              "Otorisasi gagal atau kedaluwarsa. Mulai ulang otorisasi.",
          );
        if (stopped) return;
        if (data.status === "complete") {
          setFlow(data);
          return;
        }
        if (data.url && data.url !== flow.url) {
          setFlow(data);
          return;
        }
        timeout = setTimeout(poll, 2000);
      } catch (err) {
        if (!stopped) {
          setError(
            err instanceof Error ? err.message : "Pemeriksaan otorisasi gagal.",
          );
          setFlow((current) =>
            current ? { ...current, status: "error" } : current,
          );
        }
      }
    };
    timeout = setTimeout(poll, 2000);
    return () => {
      stopped = true;
      clearTimeout(timeout);
      abort.abort();
    };
  }, [flow]);
  useEffect(() => {
    if (flow?.status === "complete" && !completed.current.has(flow.id)) {
      completed.current.add(flow.id);
      completeHandler.current();
    }
  }, [flow]);
  const list = aliases
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const waiting = flow?.status === "waiting";
  return (
    <Dialog title="Tambah Akun Baru" onClose={onClose}>
      <div className="tabs" role="tablist" aria-label="Mode tambah akun">
        <button
          type="button"
          role="tab"
          aria-selected={!bulk}
          disabled={!!flow || busy}
          className={!bulk ? "selected" : ""}
          onClick={() => {
            setBulk(false);
            setAliases("");
          }}
        >
          Input Satuan
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={bulk}
          disabled={!!flow || busy}
          className={bulk ? "selected" : ""}
          onClick={() => {
            setBulk(true);
            setAliases("");
          }}
        >
          Bulk Import (Banyak)
        </button>
      </div>
      <div className="authorization-note">
        <ShieldCheck size={20} />
        <p>
          Setiap akun memerlukan otorisasi Google. Data kuota diambil dari akun,
          bukan diisi manual.
        </p>
      </div>
      {!flow && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void start(bulk ? list : [aliases.trim()], 0);
          }}
        >
          <label htmlFor="aliases">
            {bulk ? "Alias akun, satu per baris" : "Alias akun"}
            {bulk && <span className="count">{list.length} akun</span>}
          </label>
          {bulk ? (
            <textarea
              id="aliases"
              rows={5}
              required
              value={aliases}
              onChange={(event) => setAliases(event.target.value)}
              placeholder={"Akun kerja\nAkun pribadi"}
            />
          ) : (
            <input
              id="aliases"
              required
              maxLength={100}
              value={aliases}
              onChange={(event) => setAliases(event.target.value)}
              placeholder="Contoh: Akun kerja"
            />
          )}
          <p className="helper">
            {bulk
              ? "Otorisasi dilakukan berurutan. Selesaikan satu akun sebelum melanjutkan akun berikutnya."
              : "Alias hanya nama pengenal. Alamat email diperoleh setelah otorisasi Google."}
          </p>
          <button
            type="submit"
            className="button primary full"
            disabled={busy || !list.length}
          >
            {busy ? "Menyiapkan otorisasi..." : "Mulai Otorisasi Google"}
            <ArrowRight size={17} />
          </button>
        </form>
      )}
      {flow && (
        <div className="oauth-flow">
          <div className="flow-heading">
            <strong>{queue[index] || "Akun Google"}</strong>
            <span>
              {index + 1} dari {queue.length}
            </span>
          </div>
          {waiting && (
            <>
              {flow.url ? (
                <a
                  className="button primary full"
                  href={flow.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Buka Otorisasi Google
                  <ExternalLink size={16} />
                </a>
              ) : (
                <output className="helper">
                  Menyiapkan tautan otorisasi Google...
                </output>
              )}
              <p className="helper">
                Buka tautan di atas, pilih akun Google, lalu salin kode callback
                yang diberikan ke kolom berikut.
              </p>
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  setBusy(true);
                  setError("");
                  try {
                    const result = await request({
                      id: flow.id,
                      code: code.trim(),
                    });
                    if (mounted.current) setFlow(result);
                  } catch (err) {
                    if (
                      mounted.current &&
                      !(err instanceof Error && err.name === "AbortError")
                    )
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Kode tidak dapat dikirim.",
                      );
                  } finally {
                    if (mounted.current) setBusy(false);
                  }
                }}
              >
                <label htmlFor="callback-code">Kode callback Google</label>
                <input
                  id="callback-code"
                  autoComplete="off"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Tempel kode callback"
                />
                <button
                  type="submit"
                  className="button primary full"
                  disabled={busy || !code.trim()}
                >
                  {busy ? "Memverifikasi..." : "Verifikasi & Tambah Akun"}
                </button>
              </form>
              <p className="helper">
                Menunggu otorisasi. Menutup dialog menghentikan pemeriksaan
                otomatis.
              </p>
            </>
          )}
          {flow.status === "complete" && (
            <>
              <p className="success-text">
                Akun berhasil diotorisasi dan ditambahkan.
              </p>
              {index + 1 < queue.length ? (
                <button
                  type="button"
                  className="button primary full"
                  disabled={busy}
                  onClick={() => void start(queue, index + 1)}
                >
                  Otorisasi Akun Berikutnya
                  <ArrowRight size={17} />
                </button>
              ) : (
                <button
                  type="button"
                  className="button primary full"
                  onClick={onClose}
                >
                  Selesai
                </button>
              )}
            </>
          )}
          {flow.status === "error" && (
            <button
              type="button"
              className="button full"
              disabled={busy}
              onClick={() => void start(queue, index)}
            >
              Mulai Ulang Otorisasi
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="dialog-footer">
        <button type="button" className="button" onClick={onClose}>
          Batal / Tutup
        </button>
      </div>
    </Dialog>
  );
}
