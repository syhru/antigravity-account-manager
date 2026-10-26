export const auditEvents = {
  action_switch: ["INFO", "Pergantian akun berhasil."],
  action_rotate: ["INFO", "Rotasi manual berhasil."],
  action_delete: ["INFO", "Akun dihapus dari pengelola lokal."],
  action_restart: [
    "INFO",
    "Simulasi muat ulang selesai; proses CLI tidak direstart.",
  ],
  accounts_failed: [
    "ERROR",
    "Pemuatan akun gagal. Periksa CLI dan koneksi database.",
  ],
  actions_failed: [
    "ERROR",
    "Aksi akun gagal atau permintaan tidak valid. Tidak ada jaminan seluruh langkah selesai; muat ulang akun.",
  ],
  oauth_failed: ["ERROR", "Permintaan OAuth gagal atau sesi tidak valid."],
  cli_failed: [
    "ERROR",
    "Eksekusi CLI gagal, timeout, atau respons tidak valid.",
  ],
  quota_failed: [
    "WARNING",
    "Sebagian kuota tidak tersedia atau refresh token gagal.",
  ],
  quota_recovered: ["INFO", "Pengambilan kuota kembali berhasil."],
  oauth_started: ["INFO", "Penambahan akun melalui OAuth dimulai."],
  oauth_complete: ["INFO", "OAuth selesai dan daftar akun tersinkronisasi."],
  oauth_cancelled: ["INFO", "Penambahan akun dibatalkan pengguna."],
  oauth_timeout: ["WARNING", "Sesi OAuth kedaluwarsa."],
  oauth_process_failed: [
    "ERROR",
    "Proses OAuth atau sinkronisasi setelah login gagal.",
  ],
} as const;
export type AuditEvent = keyof typeof auditEvents;
export function auditEntry(event: AuditEvent) {
  const [level, message] = auditEvents[event];
  return { event, level, message };
}
