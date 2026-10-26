# Antigravity Account Manager

Dashboard lokal untuk mengelola beberapa akun Google pada Antigravity CLI melalui [agy-auth](https://github.com/fikrilal/agy-auth). Tambahkan akun melalui OAuth, pantau kuota, ganti akun, dan lihat log aktivitas dari satu antarmuka web.


## Fitur

- **Manajemen akun:** membaca akun tersimpan, alamat Gmail, alias, dan plan dari `agy-auth`.
- **OAuth Google:** menambahkan akun satuan atau beberapa akun secara berurutan. Setiap akun tetap memerlukan persetujuan Google dan pengisian kode callback.
- **Switch akun CLI:** memilih akun langsung dari daftar atau menggunakan tombol **Rotasi Akun Sekarang** untuk akun antrean berikutnya.
- **Antrean persisten:** urutan tersimpan di PostgreSQL; akun aktif berada di urutan paling bawah. Kartu rotasi menampilkan alamat Gmail target berikutnya.
- **Rotasi manual:** tidak ada countdown atau pergantian akun otomatis berdasarkan waktu.
- **Monitoring kuota:** pembaruan otomatis setiap 30 detik, setelah switch, dan setelah penambahan akun. Tersedia tombol **Muat Ulang** dan indikator **Terakhir diperbarui**.
- **Periode kuota:** menampilkan kuota 5 jam jika tersedia; menggunakan kuota mingguan jika hanya periode tersebut yang tersedia. Data yang gagal diambil tetap ditampilkan sebagai tidak tersedia, bukan angka perkiraan.
- **Riwayat dan tren:** waktu switch terakhir serta grafik dari sampel kuota aktual.
- **Log Aktivitas:** riwayat INFO, WARNING, dan ERROR dengan pembaruan melalui Server-Sent Events (SSE).
- **Antarmuka responsif:** pencarian email/alias, shortcut `/` untuk pencarian, salin email, dan konfirmasi penghapusan akun.

## Teknologi

| Bagian         | Teknologi                                       |
| -------------- | ----------------------------------------------- |
| Aplikasi       | Next.js 16, React 19, TypeScript                |
| Tampilan       | Tailwind CSS 4, CSS, Lucide React               |
| Database       | PostgreSQL 18 melalui Docker Compose            |
| Integrasi akun | CLI `@fikrilal/agy-auth` lokal                  |
| Log realtime   | SSE dan PostgreSQL LISTEN/NOTIFY                |
| Pemeriksaan    | Biome, Node test runner melalui tsx, Playwright |

## Persyaratan

- Windows; deteksi lokasi binary saat ini ditujukan untuk instalasi Windows.
- Node.js 20.9 atau lebih baru dan npm.
- Docker Desktop dengan Docker Compose dan engine yang sedang berjalan.
- Antigravity CLI (`agy`) terpasang.
- `agy-auth` terpasang pada pengguna Windows yang menjalankan aplikasi.
- Koneksi internet untuk OAuth dan pengambilan kuota. Build dapat memerlukan internet untuk mengambil font Google melalui `next/font`.

Instal dan periksa integrasi CLI jika belum tersedia:

```powershell
npm install -g @fikrilal/agy-auth
agy-auth version
agy --version
```

Ikuti dokumentasi resmi Antigravity untuk pemasangan CLI, serta dokumentasi `agy-auth` untuk persyaratan akun. Jangan menyamakan keberhasilan OAuth dengan jaminan akses seluruh model atau data kuota.

## Menjalankan secara lokal

Jalankan perintah berikut dari root project.

### 1. Instal dependensi

```powershell
npm ci
```

### 2. Siapkan konfigurasi database

Buat file `.env.local` di root project:

```dotenv
POSTGRES_PASSWORD=GANTI_DENGAN_PASSWORD_ACAK_YANG_KUAT
DATABASE_URL=postgresql://antigravity:GANTI_DENGAN_PASSWORD_ACAK_YANG_KUAT@127.0.0.1:55432/antigravity_account_manager
```

Ganti kedua nilai password dengan nilai yang sama. Password acak berbentuk heksadesimal dapat dibuat dengan:

```powershell
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"
```

Jika menggunakan karakter khusus pada password, lakukan URL encoding untuk bagian password dalam `DATABASE_URL`.

Opsional, apabila binary tidak berada di lokasi bawaan:

```dotenv
AGY_AUTH_BINARY=C:/Tools/agy-auth/agy-auth.exe
AGY_BINARY=C:/Tools/agy/agy.exe
```

Secara bawaan, aplikasi mencari binary `agy-auth` di instalasi npm pengguna dan `agy.exe` di `%LOCALAPPDATA%/agy/bin`. Override harus menunjuk ke executable, bukan perintah shell atau wrapper `.cmd`.

> Jangan commit `.env.local`. File ini berisi kredensial database dan tidak boleh dibagikan.

### 3. Jalankan PostgreSQL

Buka Docker Desktop, tunggu engine siap, kemudian:

```powershell
npm run db:up
```

Tunggu container berstatus **Healthy**. Tabel aplikasi dibuat otomatis ketika backend digunakan; tidak ada langkah migrasi manual yang diperlukan untuk setup saat ini.

### 4. Jalankan dashboard

```powershell
npm run dev
```

Buka **http://127.0.0.1:3000**. Biarkan terminal server tetap berjalan.

Untuk menjalankan hasil production build secara lokal:

```powershell
npm run build
npm start
```

Jangan menjalankan server development dan production bersamaan pada port yang sama.

## Penggunaan

1. Buka **Tambah Akun Baru** dan pilih penambahan satuan atau berurutan.
2. Isi alias, buka tautan otorisasi Google, lalu selesaikan persetujuan akun.
3. Masukkan kode callback pada formulir dashboard. Jangan membagikan kode tersebut.
4. Akun yang sebelumnya tersimpan di `agy-auth` juga terbaca otomatis.
5. Klik **Pakai Akun** untuk memilih akun tertentu, atau **Rotasi Akun Sekarang** untuk memilih akun pertama dalam antrean.
6. Keluar dari proses `agy` yang sedang berjalan, lalu jalankan `agy` lagi agar menggunakan kredensial baru. Tab PowerShell tidak perlu ditutup.
7. Buka **Log Aktivitas** di header untuk melihat kejadian dan kesalahan aplikasi.

Penghapusan hanya menghapus akun dari pengelola lokal, bukan menghapus akun Google. Jika akun aktif dihapus, aplikasi memilih akun lain yang tersisa; jika hanya satu akun tersisa, penghapusan juga melakukan logout melalui `agy-auth`.

### Batasan switch dan restart

- Switch memperbarui kredensial CLI, bukan melakukan hot-switch dalam proses CLI yang sama.
- Sesi `agy` yang sudah berjalan dapat tetap memakai akun lama hingga proses dimulai ulang.
- Tombol restart di dashboard adalah **simulasi muat ulang**, bukan perintah untuk mematikan atau membuka kembali Antigravity CLI/IDE.
- Integrasi ini tidak mengimplementasikan perpindahan akun IDE/Desktop.

## Log Aktivitas

Panel menampilkan waktu, tingkat keparahan, jenis kejadian, dan pesan operasional:

- Switch, rotasi manual, penghapusan akun, dan simulasi restart.
- OAuth dimulai, selesai, dibatalkan, kedaluwarsa, atau gagal.
- Kegagalan CLI, pemuatan akun, dan masalah kuota yang terdeteksi.

PostgreSQL LISTEN/NOTIFY mengirim kejadian ke SSE setelah log tersimpan. Pengiriman log tidak menunggu polling kuota 30 detik. Namun, kesalahan dari layanan eksternal baru dapat dicatat setelah aplikasi mendeteksinya.

Panel memuat **100 log terbaru** ketika dibuka, menampilkan maksimal **200 log** selama terbuka, dan menempatkan log terbaru di bawah. Batas tampilan bukan kebijakan penghapusan riwayat database.

Log memakai pesan katalog tetap, tanpa token, kode OAuth, exception mentah, atau output mentah CLI. Pencatatan dimulai sejak fitur digunakan; kejadian lama tidak direkonstruksi. Jika database tidak tersedia, panel menampilkan gangguan koneksi dan kejadian selama gangguan **tidak dijamin tersimpan**. Fitur ini merupakan log operasional lokal, bukan audit trail tahan manipulasi dan bukan pemantau sesi CLI terpisah.

## Penyimpanan dan keamanan

| Konfigurasi      | Nilai                                       |
| ---------------- | ------------------------------------------- |
| Container        | `postgresql-antigravity-account-manager`    |
| Database         | `antigravity_account_manager`               |
| User database    | `antigravity`                               |
| Port host        | `127.0.0.1:55432`                           |
| Volume persisten | `antigravity-account-manager-postgres-data` |

PostgreSQL menyimpan antrean, status akun aktif, riwayat switch, sampel kuota, dan log aktivitas. Penyimpanan kredensial OAuth dikelola oleh `agy-auth`, bukan tabel database aplikasi.

- Jalankan sebagai pengguna Windows yang sama dengan pemilik akun `agy-auth`.
- Server dan port database dikonfigurasi untuk loopback. Jangan membuka akses publik, tunnel, port forwarding, atau menonaktifkan pemeriksaan origin.
- Dashboard tidak memiliki sistem login multi-pengguna. Akses lokal tetap memberi kemampuan mengelola akun.
- Jangan unggah `.env.local`, ekspor kredensial, backup database, atau screenshot yang memuat identitas pribadi ke repository publik.
- Berkas instruksi dan artefak pengujian lokal juga perlu ditinjau sebelum dipublikasikan.
- Penggunaan layanan tetap mengikuti persyaratan Google dan kelayakan masing-masing akun.

## Menghentikan aplikasi

Tekan **Ctrl+C** pada terminal server. Untuk menghentikan database:

```powershell
npm run db:down
```

Perintah tersebut menggunakan `docker compose stop` dan tidak menghapus volume. Jalankan kembali `npm run db:up` untuk menyalakannya. Menghapus volume Docker akan menghapus data aplikasi; jangan melakukannya tanpa backup.

Mengubah `POSTGRES_PASSWORD` pada `.env.local` tidak otomatis mengganti password di database yang sudah diinisialisasi pada volume lama.

## Pemeriksaan project

```powershell
npm test
npx tsc --noEmit
npx biome check src tests
npm run build
```

Tes browser opsional memerlukan Google Chrome dan server lokal yang sedang berjalan:

```powershell
node tests/browser.cjs
```

Tes log menggunakan alamat bawaan `http://127.0.0.1:3010`. Sesuaikan jika server berjalan di port lain:

```powershell
$env:TEST_URL = "http://127.0.0.1:3000"
node tests/audit-browser.cjs
Remove-Item Env:TEST_URL
```

Tes log mengirim permintaan tidak valid yang aman dan menghasilkan entri ERROR pengujian pada riwayat log.

## Pemecahan masalah

| Gejala                                                | Pemeriksaan                                                                                                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Port 3000 dipakai / server development sudah berjalan | Buka server yang sudah aktif atau hentikan proses project tersebut sebelum menjalankan ulang.                                                                   |
| Database gagal tersambung                             | Pastikan Docker Desktop berjalan, container Healthy, dan `DATABASE_URL` sesuai password serta port Compose.                                                     |
| Binary `agy-auth` tidak ditemukan                     | Periksa instalasi npm pengguna atau isi `AGY_AUTH_BINARY` dengan path executable yang benar.                                                                    |
| Kuota `N/A`                                           | Periksa pesan pada akun. Tidak semua akun menyediakan periode atau data kuota yang sama.                                                                        |
| `refresh_failed`                                      | Pembaruan token gagal. Jika berulang, lakukan otorisasi ulang akun melalui OAuth.                                                                               |
| `forbidden` / HTTP 403                                | Layanan menolak akses data kuota. Periksa kelayakan akun dan penyelesaian setup di aplikasi resmi; dashboard tidak dapat menjamin atau melewati akses tersebut. |
| Switch berhasil tetapi CLI masih memakai akun lama    | Keluar dari proses `agy`, lalu mulai kembali.                                                                                                                   |
| Tampilan belum berubah setelah revisi                 | Restart server development dan lakukan refresh penuh browser.                                                                                                   |
| Log terputus / database tidak tersedia                | Periksa PostgreSQL dan server. EventSource akan mencoba tersambung ulang; riwayat selama gangguan mungkin tidak lengkap.                                        |

## Referensi

- [Antigravity CLI](https://antigravity.google/docs/cli/overview)
- [agy-auth](https://github.com/fikrilal/agy-auth)
- [Next.js](https://nextjs.org/docs)
- [PostgreSQL](https://www.postgresql.org/docs/)
