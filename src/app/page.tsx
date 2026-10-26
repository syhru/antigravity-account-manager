"use client";
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityLog } from "../components/ActivityLog";
import { Dialog } from "../components/Dialog";
import { OAuthDialog } from "../components/OAuthDialog";

type Account = {
  id: string;
  email: string;
  alias: string;
  quota: number | null;
  quotaWindow?: "five_hour" | "weekly" | null;
  isActive: boolean;
  lastSwitch: string | null;
  usageError?: string | null;
  plan?: string | null;
};
type Snapshot = {
  accounts: Account[];
  history: number[];
  warning?: string;
};
type Notice = {
  id: number;
  text: string;
  variant: "success" | "info" | "danger";
};
const initial: Snapshot = { accounts: [], history: [] };
function lastSwitch(value: string | null) {
  if (!value) return "Belum pernah di-switch";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tidak tersedia";
  const today = date.toDateString() === new Date().toDateString();
  return `${today ? "Hari ini" : date.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} • ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
}
async function readResponse(response: Response): Promise<Snapshot> {
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error || "Permintaan gagal. Periksa koneksi lokal dan coba lagi.",
    );
  if (!Array.isArray(data.accounts))
    throw new Error("Respons server tidak valid.");
  return data;
}
export default function Home() {
  const [data, setData] = useState<Snapshot>(initial);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const loadController = useRef<AbortController | null>(null);
  const actionController = useRef<AbortController | null>(null);
  const notify = useCallback(
    (text: string, variant: Notice["variant"] = "success") => {
      const id = Date.now() + Math.random();
      setNotices((current) => [...current, { id, text, variant }]);
      const timer = setTimeout(() => {
        setNotices((current) => current.filter((notice) => notice.id !== id));
        timers.current.delete(timer);
      }, 3200);
      timers.current.add(timer);
    },
    [],
  );
  const refresh = useCallback(async () => {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setRefreshing(true);
    try {
      const snapshot = await readResponse(
        await fetch("/api/accounts", {
          cache: "no-store",
          signal: controller.signal,
        }),
      );
      setData(snapshot);
      setUpdatedAt(new Date().toISOString());
      setConnected(true);
      setError("");
    } catch (err) {
      if (!controller.signal.aborted) {
        setConnected(false);
        setError(err instanceof Error ? err.message : "Gagal memuat akun.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);
  useEffect(() => {
    void refresh();
    const poll = setInterval(() => {
      if (!busyRef.current) void refresh();
    }, 30000);
    return () => {
      clearInterval(poll);
      loadController.current?.abort();
      actionController.current?.abort();
      for (const timer of timers.current) clearTimeout(timer);
    };
  }, [refresh]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key === "/" &&
        !addOpen &&
        !activityOpen &&
        !deleting &&
        !event.ctrlKey &&
        !event.metaKey &&
        !target.closest("input, textarea, [contenteditable=true]")
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [addOpen, activityOpen, deleting]);
  const act = useCallback(
    async (action: "switch" | "rotate" | "delete" | "restart", id?: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      loadController.current?.abort();
      setRefreshing(false);
      const controller = new AbortController();
      actionController.current = controller;
      try {
        const snapshot = await readResponse(
          await fetch("/api/actions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, ...(id ? { id } : {}) }),
            signal: controller.signal,
          }),
        );
        setData(snapshot);
        setUpdatedAt(new Date().toISOString());
        setConnected(true);
        setError("");
        setDeleting(null);
        notify(
          action === "restart"
            ? "Simulasi restart selesai. Aplikasi Antigravity tidak direstart."
            : action === "delete"
              ? "Akun berhasil dihapus."
              : "Target akun CLI berhasil diganti. Restart sesi agy yang sudah berjalan secara manual.",
          action === "restart" ? "info" : "success",
        );
      } catch (err) {
        if (!controller.signal.aborted) {
          const message =
            err instanceof Error
              ? err.message
              : "Aksi gagal. Silakan coba lagi.";
          setError(message);
          notify(message, "danger");
        }
      } finally {
        busyRef.current = false;
        if (!controller.signal.aborted) setBusy(false);
      }
    },
    [notify],
  );
  const known = data.accounts.filter(
    (account) => account.quota !== null && Number.isFinite(account.quota),
  );
  const average = known.length
    ? known.reduce((sum, account) => sum + (account.quota ?? 0), 0) /
      known.length
    : null;
  const filtered = data.accounts.filter(
    (account) =>
      account.email.toLowerCase().includes(query.toLowerCase()) ||
      account.alias.toLowerCase().includes(query.toLowerCase()),
  );
  const history = data.history.filter((value) => Number.isFinite(value));
  const chart = history
    .map(
      (value, index) =>
        `${history.length === 1 ? 0 : (index / (history.length - 1)) * 240},${46 - (Math.max(0, Math.min(100, value)) / 100) * 40}`,
    )
    .join(" ");
  return (
    <div className="app-shell">
      <div className="ambient" aria-hidden="true" />
      <header className="site-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-icon">
              <Zap size={21} fill="currentColor" />
            </div>
            <span className="brand-name">Antigravity</span>
            <span className="brand-badge">Account Manager</span>
          </div>
          <div className="header-tools">
            <button
              type="button"
              className="activity-log-button"
              aria-haspopup="dialog"
              onClick={() => setActivityOpen(true)}
            >
              <Activity size={15} />
              <span>Log Aktivitas</span>
            </button>
            <button
              type="button"
              className="quick-search"
              onClick={() => searchRef.current?.focus()}
            >
              <Search size={15} />
              <span>Cari Akun...</span>
              <kbd>/</kbd>
            </button>
            <span className={`connection ${connected ? "online" : "offline"}`}>
              <i />
              {connected ? "Terhubung" : loading ? "Menghubungkan" : "Terputus"}
            </span>
          </div>
        </div>
      </header>
      <main className="main-container">
        <div className="page-intro">
          <div>
            <p className="eyebrow">WORKSPACE LOKAL</p>
            <h1>Kendali akun, tanpa jeda.</h1>
            <p>
              Kelola antrean dan kuota. Rotasi akun hanya berjalan saat tombol
              diklik.
            </p>
          </div>
          <span className="local-label">
            <ShieldCheck size={14} /> Data tersimpan lokal
          </span>
        </div>
        {(error || data.warning) && (
          <div className="warning" role="alert">
            <TriangleAlert size={19} />
            <div>
              {error && <p>{error}</p>}
              {data.warning && <p>{data.warning}</p>}
              <small>
                Jika otorisasi atau refresh akun kedaluwarsa, tambahkan kembali
                akun melalui otorisasi Google.
              </small>
            </div>
          </div>
        )}
        <section className="bento-grid" aria-label="Kontrol akun">
          <article className="bento rotation">
            <div className="accent-line" />
            <div className="card-eyebrow green">
              <span>
                <RefreshCw size={15} className={busy ? "spin" : ""} /> ROTASI
                MANUAL
              </span>
              <span className="mini-badge">Queue #1</span>
            </div>
            <h2>Rotasi Berikutnya</h2>
            <p>
              Ganti target CLI ke akun antrean berikutnya. Restart sesi agy yang
              sudah berjalan secara manual.
            </p>
            <div className="countdown">
              <span>Akun berikutnya</span>
              <strong>
                {loading
                  ? "Memuat..."
                  : data.accounts[0]?.email || "Belum ada akun"}
              </strong>
            </div>
            <button
              type="button"
              className="button primary"
              disabled={busy || loading || !data.accounts.length}
              onClick={() => void act("rotate")}
            >
              <RefreshCw size={16} />
              Rotasi Akun Sekarang
            </button>
          </article>
          <article className="bento">
            <div className="card-eyebrow purple">
              <span>
                <Activity size={16} />
                STATUS KUOTA
              </span>
              <span className="live-badge">
                <i />
                {connected ? "Live" : "Offline"}
              </span>
            </div>
            <h2>Cek Kuota Live</h2>
            <div className="quota-metric">
              <strong>
                {average === null ? "N/A" : `${average.toFixed(1)}%`}
              </strong>
              <span>{average === null ? "Tidak tersedia" : "Tersedia"}</span>
            </div>
            <p className="quota-context">
              {known.length} dari {data.accounts.length} akun memiliki data
              kuota
            </p>
            <div className="trend">
              <div>
                <span>Tren Pemakaian</span>
                <span>{history.length ? "Tercatat" : "Belum ada data"}</span>
              </div>
              {history.length > 0 ? (
                <svg
                  viewBox="0 0 240 52"
                  role="img"
                  aria-label="Tren kuota tersedia"
                >
                  <polyline
                    points={chart}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              ) : (
                <div className="empty-chart">
                  Data kuota akan tampil setelah tersedia.
                </div>
              )}
            </div>
          </article>
          <button
            type="button"
            className="bento interactive add-card"
            onClick={() => setAddOpen(true)}
          >
            <div className="card-eyebrow blue">
              <span>EKSPANSI SESI</span>
              <span className="plus-box">
                <Plus size={18} />
              </span>
            </div>
            <h2>Tambah Akun Baru</h2>
            <p>
              Otorisasi akun Google baru untuk ditambahkan ke dalam antrean
              rotasi.
            </p>
            <div className="card-decoration">
              <Users size={39} strokeWidth={1} />
            </div>
            <div className="card-footer blue">
              <span>
                <KeyRound size={16} />
                Otorisasi Google
              </span>
              <ArrowRight size={17} />
            </div>
          </button>
          <button
            type="button"
            className="bento interactive restart-card"
            disabled={busy}
            onClick={() => void act("restart")}
          >
            <div className="card-eyebrow">
              <span>KONTROL SISTEM</span>
              <span className="mini-badge">Simulasi</span>
            </div>
            <h2>Restart Antigravity</h2>
            <p>
              Simulasikan penyegaran sistem lokal. Tidak menghentikan atau
              menjalankan ulang aplikasi Antigravity.
            </p>
            <div className="card-decoration">
              <Power size={38} strokeWidth={1} />
            </div>
            <div className="card-footer">
              <span>
                <Power size={16} />
                Muat Ulang Sistem
              </span>
              <ArrowRight size={17} />
            </div>
          </button>
        </section>
        <section className="roster" aria-labelledby="roster-title">
          <div className="roster-header">
            <div>
              <div className="roster-title">
                <h2 id="roster-title">Daftar Akun Tersimpan</h2>
                <span className="count">{data.accounts.length} Akun</span>
              </div>
              <p>
                Akun yang baru selesai dipakai otomatis berpindah ke urutan
                paling bawah.
              </p>
            </div>
            <div className="roster-tools">
              <div className="search-field">
                <Search size={17} />
                <input
                  ref={searchRef}
                  aria-label="Cari akun berdasarkan email atau alias"
                  placeholder="Cari alamat email..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Hapus pencarian"
                    onClick={() => setQuery("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="button refresh-button"
                disabled={refreshing || busy}
                onClick={() => void refresh()}
              >
                <RefreshCw size={16} className={refreshing ? "spin" : ""} />
                <span>Muat Ulang</span>
              </button>
            </div>
          </div>
          <div className="table-head" aria-hidden="true">
            <span>IDENTITAS AKUN</span>
            <span>STATUS KUOTA</span>
            <span>RIWAYAT SWITCH</span>
            <span>AKSI</span>
          </div>
          {loading ? (
            <section
              className="skeleton-list"
              aria-label="Memuat akun"
              aria-busy="true"
            >
              {[0, 1, 2].map((value) => (
                <div key={value} className="skeleton-row">
                  <i />
                  <span />
                  <span />
                </div>
              ))}
            </section>
          ) : !filtered.length ? (
            <div className="empty-state">
              <Users size={32} />
              <h3>
                {query
                  ? "Akun tidak ditemukan"
                  : error
                    ? "Akun belum dapat dimuat"
                    : "Belum ada akun tersimpan"}
              </h3>
              <p>
                {query
                  ? "Coba alamat email atau alias lain."
                  : error
                    ? "Periksa layanan lokal, lalu gunakan Muat Ulang."
                    : "Gunakan Tambah Akun Baru untuk mengotorisasi akun Google pertama."}
              </p>
            </div>
          ) : (
            <div className="account-list">
              {filtered.map((account) => {
                const quota =
                  account.quota !== null && Number.isFinite(account.quota)
                    ? Math.max(0, Math.min(100, account.quota))
                    : null;
                const tone =
                  quota === null
                    ? "unavailable"
                    : quota > 50
                      ? "green"
                      : quota >= 20
                        ? "amber"
                        : "red";
                return (
                  <article
                    key={account.id}
                    className={`account-row ${account.isActive ? "active" : ""}`}
                  >
                    <div className="identity">
                      <span className="order-number">
                        {data.accounts.findIndex(
                          (item) => item.id === account.id,
                        ) + 1}
                        {account.isActive && <i />}
                      </span>
                      <div className="identity-detail">
                        <div className="email-line">
                          <span className="email" title={account.email}>
                            {account.email}
                          </span>
                          <button
                            type="button"
                            className="copy-button"
                            aria-label={`Salin email ${account.email}`}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  account.email,
                                );
                                notify(
                                  `Email ${account.email} berhasil disalin!`,
                                );
                              } catch {
                                notify(
                                  "Email tidak dapat disalin. Periksa izin clipboard.",
                                  "danger",
                                );
                              }
                            }}
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                        <div className="identity-meta">
                          {account.alias && <span>{account.alias}</span>}
                          {account.isActive && (
                            <span className="active-label">SEDANG AKTIF</span>
                          )}
                          {account.plan && <span>{account.plan}</span>}
                        </div>
                      </div>
                    </div>
                    <div className={`quota-cell ${tone}`}>
                      <div className="quota-label">
                        <span>
                          {quota === null
                            ? "Kuota tidak tersedia"
                            : quota > 50
                              ? account.isActive
                                ? "Sesi Optimal"
                                : "Kuota Aman"
                              : quota >= 20
                                ? "Mulai Menipis"
                                : "Hampir Habis"}
                        </span>
                        <strong>
                          {quota === null ? "N/A" : `${quota}%`}
                          {quota !== null &&
                            (account.quotaWindow === "weekly"
                              ? " · Mingguan"
                              : " · 5 jam")}
                        </strong>
                      </div>
                      <div className="quota-track">
                        {quota !== null && (
                          <div style={{ width: `${quota}%` }} />
                        )}
                      </div>
                      {account.usageError && (
                        <p className="usage-error">
                          {account.usageError.includes("refresh_failed")
                            ? "Refresh otorisasi gagal. Login kembali melalui Tambah Akun Baru."
                            : account.usageError === "forbidden"
                              ? "Google menolak akses data kuota (HTTP 403). Periksa akses Antigravity dan persetujuan awal akun ini di aplikasi resmi. Kuota tidak dapat dihitung dari dashboard."
                              : account.usageError}
                        </p>
                      )}
                    </div>
                    <div className="switch-cell">
                      <span>Terakhir Switch</span>
                      <p>{lastSwitch(account.lastSwitch)}</p>
                    </div>
                    <div className="row-actions">
                      {account.isActive ? (
                        <span className="active-status">
                          <Check size={13} />
                          Aktif Digunakan
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="use-button"
                          disabled={busy}
                          onClick={() => void act("switch", account.id)}
                        >
                          Pakai Akun
                        </button>
                      )}
                      <button
                        type="button"
                        className="delete-button icon-button"
                        aria-label={`Hapus akun ${account.email}`}
                        disabled={busy}
                        onClick={() => setDeleting(account)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="roster-footer">
            <span>
              <ShieldCheck size={13} /> Otorisasi Google • Tanpa kredensial di
              antarmuka
            </span>
            <span>
              Pembaruan otomatis setiap 30 detik · Terakhir diperbarui:{" "}
              {updatedAt
                ? new Date(updatedAt).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "Belum tersedia"}
              {!connected && updatedAt
                ? " (data terakhir; pembaruan gagal)"
                : ""}
            </span>
          </div>
        </section>
      </main>
      <footer className="page-footer">
        <span>Antigravity Account Manager</span>
        <span>Ruang kerja lokal Anda.</span>
      </footer>
      {activityOpen && <ActivityLog onClose={() => setActivityOpen(false)} />}
      {addOpen && (
        <OAuthDialog
          onClose={() => setAddOpen(false)}
          onComplete={() => {
            void refresh();
            notify("Akun Google berhasil ditambahkan.");
          }}
        />
      )}{" "}
      {deleting && (
        <Dialog
          title="Hapus Akun?"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <div className="delete-confirm">
            <div className="delete-symbol">
              <Trash2 size={25} />
            </div>
            <p>
              Hapus <strong>{deleting.email}</strong> dari daftar akun
              tersimpan?
            </p>
            <p className="helper">
              Akun akan dikeluarkan dari antrean rotasi lokal. Akun Google Anda
              tidak dihapus.
            </p>
          </div>
          <div className="dialog-footer">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={() => void act("delete", deleting.id)}
            >
              {busy ? "Menghapus..." : "Ya, Hapus"}
            </button>
          </div>
        </Dialog>
      )}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={`toast ${notice.variant}`}
            role={notice.variant === "danger" ? "alert" : "status"}
          >
            {notice.variant === "danger" ? (
              <TriangleAlert size={19} />
            ) : (
              <CheckCircle2 size={19} />
            )}
            <span>{notice.text}</span>
            <button
              type="button"
              aria-label="Tutup notifikasi"
              onClick={() =>
                setNotices((current) =>
                  current.filter((item) => item.id !== notice.id),
                )
              }
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
