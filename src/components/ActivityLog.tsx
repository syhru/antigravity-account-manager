"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "./Dialog";

type LogEntry = {
  id: string;
  createdAt: string;
  level: "INFO" | "WARNING" | "ERROR";
  event: string;
  message: string;
};

function readLog(data: string): LogEntry | null {
  try {
    const value = JSON.parse(data);
    if (
      !value ||
      typeof value.id !== "string" ||
      typeof value.createdAt !== "string" ||
      !Number.isFinite(Date.parse(value.createdAt)) ||
      !["INFO", "WARNING", "ERROR"].includes(value.level) ||
      typeof value.event !== "string" ||
      typeof value.message !== "string"
    )
      return null;
    // Keep only the public log fields; never retain extra response fields.
    return {
      id: value.id,
      createdAt: value.createdAt,
      level: value.level,
      event: value.event,
      message: value.message,
    };
  } catch {
    return null;
  }
}

export function ActivityLog({ onClose }: { onClose: () => void }) {
  const listRef = useRef<HTMLElement>(null);
  const follow = useRef(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected" | "unavailable"
  >("connecting");
  const [incomplete, setIncomplete] = useState(false);
  const [unavailable, setUnavailable] = useState("");

  useEffect(() => {
    let active = true;
    const source = new EventSource("/api/logs");
    source.addEventListener("log", (event: MessageEvent<string>) => {
      if (!active) return;
      const entry = readLog(event.data);
      if (!entry) {
        setIncomplete(true);
        return;
      }
      setLogs((current) => {
        if (current.some((item) => item.id === entry.id)) return current;
        return [...current, entry]
          .sort(
            (a, b) =>
              Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
              Number(BigInt(a.id) - BigInt(b.id)),
          )
          .slice(-200);
      });
    });
    source.addEventListener("ready", () => {
      if (!active) return;
      setStatus("connected");
      setUnavailable("");
    });
    source.addEventListener("unavailable", (event: MessageEvent<string>) => {
      if (!active) return;
      let message = "Database log tidak tersedia.";
      try {
        const data = JSON.parse(event.data);
        if (typeof data?.message === "string" && data.message.trim()) {
          message = data.message;
        }
      } catch {
        // Use the safe fallback for malformed server messages.
      }
      setUnavailable(message);
      setStatus("unavailable");
      setIncomplete(true);
    });
    source.onerror = () => {
      if (!active) return;
      setStatus((current) =>
        current === "unavailable" ? current : "disconnected",
      );
      setIncomplete(true);
      // EventSource reconnects automatically; do not poll or replace it.
    };
    return () => {
      active = false;
      source.close();
    };
  }, []);

  useEffect(() => {
    if (logs.length && follow.current && listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [logs]);
  return (
    <Dialog title="Log Aktivitas" onClose={onClose} className="activity-dialog">
      <section className="activity-log" aria-label="Riwayat aktivitas">
        <div className="activity-log-summary" aria-live="polite">
          <span
            className={`connection ${status === "connected" ? "online" : "offline"}`}
          >
            <i />
            {status === "connected"
              ? "Terhubung · realtime"
              : status === "connecting"
                ? "Menghubungkan..."
                : status === "unavailable"
                  ? "Database tidak tersedia"
                  : "Terputus · menghubungkan ulang..."}
          </span>
          <span>Terbaru di bawah · maksimal 200 log</span>
        </div>
        {(unavailable || incomplete) && (
          <div className="activity-log-warning" aria-live="polite">
            {unavailable && <p>{unavailable}</p>}
            {incomplete && (
              <p>
                Riwayat mungkin tidak lengkap. Setelah tersambung ulang, server
                hanya mengirim 100 log terbaru.
              </p>
            )}
          </div>
        )}
        <section
          className="activity-log-list"
          ref={listRef}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard scrolling for log region.
          tabIndex={0}
          onScroll={() => {
            const el = listRef.current;
            if (el)
              follow.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 60;
          }}
          aria-label="Daftar log aktivitas"
        >
          {logs.length === 0 ? (
            <p className="activity-log-empty">
              {status === "connecting"
                ? "Menunggu log aktivitas..."
                : "Belum ada log aktivitas yang dapat ditampilkan."}
            </p>
          ) : (
            <ol>
              {logs.map((entry) => (
                <li key={entry.id} className="activity-log-entry">
                  <div className="activity-log-meta">
                    <time dateTime={entry.createdAt}>
                      {new Date(entry.createdAt).toLocaleString("id-ID")}
                    </time>
                    <span
                      className={`activity-log-level activity-log-level-${entry.level.toLowerCase()}`}
                    >
                      {entry.level}
                    </span>
                  </div>
                  <span className="activity-log-event">{entry.event}</span>
                  <p className="activity-log-message">{entry.message}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </section>
    </Dialog>
  );
}
