# LaporinAja - Backend

REST API untuk **LaporinAja**, platform pengaduan publik yang transparan. Warga melaporkan masalah di sekitarnya (ditangani Satpol PP dan Dishub), dan setiap tahap penanganannya terlihat terbuka lengkap dengan foto bukti, sehingga warga bisa memantau, mengomentari, atau menyanggah hasilnya.

> Repository pasangan: [LaporWarga-FE](https://github.com/FursanNahr/LaporWarga-FE) (antarmuka web). Backend ini harus berjalan lebih dulu agar frontend berfungsi.

## Tech Stack

| Bagian | Teknologi |
| --- | --- |
| Runtime | Node.js (ES Modules), diuji pada v24.22.0 |
| Framework | Express 5 |
| Database | MySQL / MariaDB |
| ORM | Prisma 7 (dengan adapter MariaDB) |
| Autentikasi | JWT (`jsonwebtoken`) dan `bcryptjs` |
| Validasi | Zod |
| Unggah file | Multer |
| Lainnya | CORS, dotenv, tsx (untuk menjalankan seeder TypeScript) |

## Cara Menjalankan

### Prasyarat

- Node.js v24 (diuji pada v24.22.0)
- MySQL atau MariaDB yang sedang berjalan (misalnya lewat XAMPP)
- Git

### Langkah

1. **Clone repository**

   ```bash
   git clone https://github.com/FursanNahr/LaporWarga-BE.git
   cd LaporWarga-BE
   ```

2. **Install dependency**

   ```bash
   npm install
   ```

3. **Siapkan file environment.** Salin `.env.example` menjadi `.env` (Windows: `copy .env.example .env`, macOS/Linux: `cp .env.example .env`), lalu sesuaikan isinya:

   ```env
   PORT=3000

   DATABASE_URL="mysql://root:@127.0.0.1:3306/laporwarga"

   DATABASE_HOST="127.0.0.1"
   DATABASE_PORT=3306
   DATABASE_USER="root"
   DATABASE_PASSWORD=""
   DATABASE_NAME="laporwarga"

   JWT_SECRET="isi-dengan-string-acak-yang-panjang"
   JWT_EXPIRES_IN="7d"
   ```

   Pastikan `JWT_SECRET` diisi, dan nilai database sesuai dengan MySQL/MariaDB di komputer kamu.

4. **Siapkan database**

   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

5. **Isi data awal (seed)**

   ```bash
   npx prisma db seed
   ```

6. **Jalankan server**

   ```bash
   npm run dev
   ```

   Server berjalan di `http://localhost:3000`, dengan semua endpoint di bawah `/api`. Cek `http://localhost:3000/api/health` untuk memastikan server hidup.

Untuk menjalankan tanpa mode watch, gunakan `npm start`.

### Akun Contoh (dari seeder)

Akun berikut dibuat oleh seeder untuk keperluan uji coba. Semuanya memakai password yang sama: `Password123!`

| Peran | Email |
| --- | --- |
| Admin | admin@laporwarga.test |
| Instansi (Dishub) | dishub@laporwarga.test |
| Instansi (Satpol PP) | satpolpp@laporwarga.test |
| Warga | warga@laporwarga.test |

## Progress Saat Ini

**Sudah selesai**

- Autentikasi (daftar, masuk, profil) dengan pembagian peran Warga, Instansi, dan Admin
- Pembuatan laporan dengan foto, titik lokasi, pilihan instansi/subjenis, dan opsi lapor anonim
- Kode tracking otomatis untuk setiap laporan
- Feed laporan berdasarkan radius lokasi terdekat, serta pencarian dan filter (kode tracking, kata kunci, instansi, subjenis, status, kecamatan)
- Detail laporan dengan timeline status dan foto per tahap
- Alur status: Menunggu verifikasi, Terverifikasi atau Ditolak, Diteruskan, Dalam penanganan, Selesai
- Update progress oleh instansi, termasuk foto "sesudah" yang divalidasi dalam radius 100 m dari titik laporan
- Dukungan (upvote) dan verifikasi laporan oleh warga lain
- Konfirmasi hasil oleh pelapor ("Sudah beres" / "Belum beres" dengan foto) dan pembukaan kembali laporan jika disanggah
- Notifikasi pembaruan status dan aktivitas laporan
- Fitur admin: verifikasi laporan, kelola akun instansi dan petugas, kelola kategori dan subjenis, deteksi serta penggabungan laporan duplikat
- SLA per tahap dengan penanda terlewat dan eskalasi otomatis
- Log audit yang hanya bisa ditambah (tidak bisa diubah atau dihapus)

**Sedang / belum dikerjakan**

- Komentar pada laporan (termasuk foto bukti dan moderasi komentar)
- Sistem penghargaan (poin, lencana, streak)
- Statistik (ringkasan beranda dan dashboard admin)
- Papan transparansi per instansi

## Struktur Singkat

```
LaporWarga-BE/
├── prisma/        # schema, migrasi, dan seed.ts
├── src/
│   ├── config/    # env, prisma, konstanta, upload
│   ├── routes/    # definisi endpoint
│   ├── controllers/
│   ├── services/  # logika bisnis dan query Prisma
│   ├── middlewares/
│   ├── validators/  # skema Zod
│   ├── jobs/      # tugas terjadwal (SLA)
│   └── utils/
└── uploads/       # foto laporan, progress, dan lainnya
```