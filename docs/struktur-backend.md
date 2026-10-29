# Struktur Backend LaporWarga

Struktur ini disusun dari sitemap (Publik, Warga, Instansi, Admin) dan daftar fitur P1/P2/P3.
Tag `[P2]` / `[P3]` menandai file yang baru dikerjakan setelah semua P1 selesai.

## Root Folder

```
LaporWarga-BE/
├── docs/
│   └── struktur-be.md
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.js                          # entry seeder, memanggil file di seeders/ berurutan
│   ├── seeders/
│   │   ├── 01-districts.seed.js         # kecamatan
│   │   ├── 02-agencies.seed.js          # instansi
│   │   ├── 03-categories.seed.js        # kategori + subjenis + pemetaan ke instansi
│   │   ├── 04-users.seed.js             # admin, petugas instansi, warga dummy
│   │   ├── 05-sla-settings.seed.js      # [P2] batas waktu SLA per tahap
│   │   ├── 06-reports.seed.js           # laporan dummy + foto + timeline progress
│   │   └── 07-interactions.seed.js      # upvote, komentar, notifikasi dummy
│   └── migrations/                      # dibuat otomatis oleh prisma migrate
│
├── src/
│   ├── index.js                         # app.listen + start jobs
│   ├── app.js                           # konfigurasi express (cors, json, static, routes, error handler)
│   ├── test-db.js
│   │
│   ├── config/
│   │   ├── env.js                       # baca & validasi variabel .env
│   │   ├── prisma.js                    # satu instance PrismaClient
│   │   ├── constants.js                 # role, status laporan, tipe notifikasi, radius geofence (100 m)
│   │   └── upload.js                    # konfigurasi multer (tipe, ukuran, folder tujuan)
│   │
│   ├── routes/
│   │   ├── index.js                     # gabungkan semua router di bawah /api
│   │   ├── auth.routes.js               # register, login, me
│   │   ├── user.routes.js               # profil, avatar, ganti password
│   │   ├── report.routes.js             # buat, feed, detail, laporan saya, cari, lacak kode
│   │   ├── progress.routes.js           # update progress oleh instansi, timeline
│   │   ├── support.routes.js            # upvote & verifikasi partisipatif
│   │   ├── comment.routes.js            # komentar + foto bukti
│   │   ├── confirmation.routes.js       # [P2] "Sudah beres" / "Belum beres" (sanggah)
│   │   ├── notification.routes.js       # daftar, tandai dibaca
│   │   ├── category.routes.js           # kategori & subjenis (publik: baca)
│   │   ├── agency.routes.js             # daftar instansi (publik: baca)
│   │   ├── district.routes.js           # daftar kecamatan (untuk filter)
│   │   ├── transparency.routes.js       # [P2] papan transparansi
│   │   ├── stats.routes.js              # [P3] statistik ringkas beranda
│   │   ├── gamification.routes.js       # [P3] poin, lencana, streak
│   │   ├── contact.routes.js            # halaman Kontak
│   │   └── admin.routes.js              # verifikasi, kelola, SLA, audit, merge, moderasi
│   │
│   ├── controllers/                     # terima request, panggil service, kirim response
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── report.controller.js
│   │   ├── progress.controller.js
│   │   ├── support.controller.js
│   │   ├── comment.controller.js
│   │   ├── confirmation.controller.js   # [P2]
│   │   ├── notification.controller.js
│   │   ├── category.controller.js
│   │   ├── agency.controller.js
│   │   ├── district.controller.js
│   │   ├── transparency.controller.js   # [P2]
│   │   ├── stats.controller.js          # [P3]
│   │   ├── gamification.controller.js   # [P3]
│   │   ├── contact.controller.js
│   │   └── admin.controller.js
│   │
│   ├── services/                        # logika bisnis + query Prisma
│   │   ├── auth.service.js
│   │   ├── user.service.js
│   │   ├── report.service.js            # buat laporan, kode tracking, anonim, feed radius, cari & filter
│   │   ├── progress.service.js          # alur status, validasi foto "sesudah" (radius 100 m)
│   │   ├── support.service.js
│   │   ├── comment.service.js
│   │   ├── confirmation.service.js      # [P2] buka kembali laporan jika disanggah
│   │   ├── notification.service.js      # dipanggil dari service lain saat ada kejadian
│   │   ├── category.service.js
│   │   ├── agency.service.js            # akun instansi & petugas
│   │   ├── district.service.js
│   │   ├── duplicate.service.js         # [P2] deteksi duplikat & merge
│   │   ├── sla.service.js               # [P2] hitung mundur, penanda terlewat, eskalasi
│   │   ├── transparency.service.js      # [P2] % selesai, rata-rata hari, jumlah sanggahan, peringkat
│   │   ├── stats.service.js             # [P3]
│   │   ├── gamification.service.js      # [P3]
│   │   ├── audit.service.js             # catat log audit (hanya tambah, tidak ada update/delete)
│   │   └── contact.service.js
│   │
│   ├── middlewares/
│   │   ├── authenticate.js              # verifikasi JWT
│   │   ├── optionalAuth.js              # untuk endpoint publik yang tetap butuh tahu user (isUpvotedByMe)
│   │   ├── authorize.js                 # batasi role: WARGA / INSTANSI / ADMIN
│   │   ├── validate.js                  # jalankan skema zod
│   │   ├── upload.js                    # pasang multer per kebutuhan (laporan, progress, komentar, avatar)
│   │   ├── rateLimit.js
│   │   ├── notFound.js
│   │   └── errorHandler.js
│   │
│   ├── validators/                      # skema zod per modul
│   │   ├── auth.validator.js
│   │   ├── user.validator.js
│   │   ├── report.validator.js
│   │   ├── progress.validator.js
│   │   ├── comment.validator.js
│   │   ├── common.validator.js
│   │   ├── confirmation.validator.js    # [P2]
│   │   ├── category.validator.js
│   │   ├── agency.validator.js
│   │   ├── admin.validator.js
│   │   └── contact.validator.js
│   │
│   ├── jobs/                            # [P2] tugas terjadwal
│   │   ├── index.js                     # daftar & jalankan semua job
│   │   └── sla.job.js                   # cek SLA terlewat -> notifikasi + penanda merah
│   │
│   └── utils/
│       ├── response.js                  # helper success / error seragam
│       ├── AppError.js                  # class error dengan status code
│       ├── trackingCode.js              # format BDG-2610-0042
│       ├── geo.js                       # jarak (haversine), bounding box untuk radius
│       ├── pagination.js                # helper cursor pagination
│       ├── password.js                  # hash & compare
│       ├── jwt.js                       # sign & verify token
│       └── file.js                      # hapus file di uploads/
│
├── uploads/                             # di .gitignore, tiap folder diberi .gitkeep
│   ├── reports/                         # foto laporan (sebelum)
│   ├── progress/                        # foto progress & foto "sesudah" dari petugas
│   ├── comments/                        # foto bukti di komentar
│   ├── confirmations/                   # [P2] foto sanggahan
│   └── avatars/
│
├── .env                                 # tidak di-commit
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

## Pemetaan Sitemap ke Modul Backend

| Role | Halaman (sitemap) | Route / modul |
|---|---|---|
| Publik | Beranda | `stats` [P3], `report` (feed) |
| Publik | Cari Laporan | `report` (cari kode tracking / kata kunci + filter instansi, subjenis, status, kecamatan) |
| Publik | Detail Laporan | `report` (detail), `progress` (timeline), `comment` |
| Publik | Papan Transparansi | `transparency` [P2] |
| Publik | Masuk & Daftar | `auth` |
| Publik | Kontak | `contact` |
| Publik | Panduan dan Bantuan, Tentang Aplikasi, Kebijakan Privasi, Syarat dan Ketentuan | belum ada modul backend (lihat catatan di bawah) |
| Warga | Buat Laporan | `report` (+ `duplicate` [P2]) |
| Warga | Laporan Saya | `report` (milik user), `confirmation` [P2] |
| Warga | Feed | `report` (feed radius lokasi), `support` |
| Warga | Notifikasi | `notification` |
| Warga | Profil | `user`, `gamification` [P3] |
| Instansi | Daftar Laporan | `report` (difilter ke instansi terkait) |
| Instansi | Kelola Progress | `progress` |
| Instansi | Notifikasi, Profil | `notification`, `user` |
| Admin | Verifikasi Laporan | `admin` (valid / tolak dengan alasan / teruskan ke instansi) |
| Admin | Kelola Laporan | `admin` (merge duplikat [P2], moderasi komentar [P2]) |
| Admin | Data Instansi | `agency` (akun instansi & petugas) |
| Admin | Data Master | `category` (kategori, subjenis, pemetaan ke instansi), `district` |
| Admin | Pengaturan SLA | `admin` + `sla` [P2] |
| Admin | Log Audit | `admin` + `audit` [P2] |

## Catatan (dari dokumen kebutuhan, belum diputuskan)

- **Halaman statis** (Panduan, Tentang, Kebijakan Privasi, Syarat): umumnya cukup ditulis di frontend. Backend baru perlu modul sendiri kalau isinya ingin diedit admin.
- **Foto "sesudah" tanpa galeri**: backend hanya bisa memvalidasi jarak ≤ 100 m dari koordinat laporan dan memakai timestamp server. Larangan unggah dari galeri harus ditegakkan di frontend (buka kamera langsung).
- **Kecamatan**: filter kecamatan butuh tabel master `District`. Sumber datanya perlu ditentukan (diisi manual lewat seeder atau dari data resmi).
- **Instansi**: papan transparansi menyebut Satpol PP dan Dishub. Daftar instansi lain di seeder perlu dikonfirmasi.
- **Role**: dokumen kebutuhan menyebut tiga role (Warga, Instansi/petugas, Admin), jadi enum role di schema harus `WARGA`, `INSTANSI`, `ADMIN`, bukan hanya `WARGA` dan `ADMIN`.
- **Status laporan** mengikuti alur: Menunggu verifikasi → Terverifikasi / Ditolak (dengan alasan) → Diteruskan ke instansi → Dalam penanganan → Selesai (+ dibuka kembali jika disanggah).


# Roadmap Pengembangan Backend LaporWarga

---

## Fase 1: Persiapan Database & Prisma

- [ ] 1. Nyalakan **MySQL** di XAMPP, lalu buat database kosong `laporwarga` lewat phpMyAdmin.
- [ ] 2. Install Prisma:
  ```bash
  npm i prisma -D
  npm i @prisma/client
  ```
- [ ] 3. Inisialisasi Prisma:
  ```bash
  npx prisma init --datasource-provider mysql
  ```
- [ ] 4. Konfigurasi file `.env`:
  ```env
  DATABASE_URL="mysql://root:@localhost:3306/laporwarga"
  ```
- [ ] 5. Update `.env.example` (tanpa data rahasia) dan pastikan `.env` sudah terdaftar di `.gitignore`.
- [ ] 6. Pastikan `package.json` memiliki `"type": "module"` (karena menggunakan ES Module / `import`).

---

## Fase 2: Desain Schema (`prisma/schema.prisma`)

- [ ] 1. **Model `User`**: `id`, `nama`, `email`, `password`, `role` (`WARGA` / `ADMIN`), `avatar`, `createdAt`
- [ ] 2. **Model `Category`**: `id`, `nama` (contoh: *Jalan Rusak*, *Sampah*, *Banjir*, *Lampu Mati*, dll.)
- [ ] 3. **Model `Report`**: `id`, `judul`, `deskripsi`, `lokasi`/`alamat`, `latitude`, `longitude`, `status` (`PENDING` / `DIPROSES` / `SELESAI` / `DITOLAK`), `userId`, `categoryId`, `createdAt`, `updatedAt`
- [ ] 4. **Model `ReportImage`**: `id`, `url`, `reportId` (1 laporan bisa punya banyak foto)
- [ ] 5. **Model `Like`**: `userId`, `reportId` (unique constraint gabungan keduanya)
- [ ] 6. **Model `Comment`**: `id`, `isi`, `userId`, `reportId`, `createdAt`
- [ ] 7. *(Opsional)* **Model `StatusHistory`**: Riwayat perubahan status laporan
- [ ] 8. *(Opsional)* **Model `Notification`**
- [ ] 9. Tambahkan relasi, indeks, dan `onDelete: Cascade` di tempat yang diperlukan.
- [ ] 10. Jalankan migrasi awal:
  ```bash
  npx prisma migrate dev --name init
  ```
- [ ] 11. Cek struktur tabel di phpMyAdmin.
- [ ] 12. Generate Prisma Client:
  ```bash
  npx prisma generate
  ```

---

## Fase 3: Struktur Folder

- [ ] 1. Rapikan struktur folder `src/` menjadi:
  - `src/config/`
  - `src/routes/`
  - `src/controllers/`
  - `src/services/`
  - `src/middlewares/`
  - `src/utils/`
  - `src/validators/`
- [ ] 2. Buat `src/config/prisma.js` (satu instance `PrismaClient` yang dipakai bersama).
- [ ] 3. Pisahkan `app.js` (konfigurasi Express) dan `index.js` (entry point / `listen`).
- [ ] 4. Buat folder `uploads/` di root proyek, lalu tambahkan ke `.gitignore` (beri file `.gitkeep`).

---

## Fase 4: Seeder

- [ ] 1. Buat file `prisma/seed.js`.
- [ ] 2. Tambahkan script `seed` di `package.json`.
- [ ] 3. Seed data kategori dasar.
- [ ] 4. Seed akun Admin (dengan password yang sudah di-hash).
- [ ] 5. Seed beberapa user warga *dummy*.
- [ ] 6. Seed laporan *dummy* (beserta foto, *like*, dan komentar) agar feed terisi data awal.
- [ ] 7. Jalankan seeder dan verifikasi di phpMyAdmin:
  ```bash
  npx prisma db seed
  ```

---

## Fase 5: Middleware & Utilitas

- [ ] 1. Install library utama:
  ```bash
  npm i bcrypt jsonwebtoken zod multer
  ```
- [ ] 2. Buat helper standar format response API (`success`, `error`).
- [ ] 3. Buat Global Error Handler + 404 Handler.
- [ ] 4. Buat Middleware `authenticate` (verifikasi JWT).
- [ ] 5. Buat Middleware `authorize(role)` (membatasi akses khusus Admin).
- [ ] 6. Buat Middleware validasi request (menggunakan Zod).
- [ ] 7. Buat Middleware upload foto (Multer):
  - Batasi tipe file (`.jpg`, `.png`, `.webp`)
  - Batasi ukuran (misal max 5MB)
  - Batasi jumlah file per upload
- [ ] 8. Atur penamaan file unik (timestamp / UUID + ekstensi asli).
- [ ] 9. Serve folder statis untuk file foto:
  ```javascript
  app.use('/uploads', express.static('uploads'));
  ```
- [ ] 10. *(Opsional)* Kompres/resize foto menggunakan library `sharp`.
- [ ] 11. *(Opsional)* Pasang `helmet` dan `express-rate-limit` untuk meningkatkan keamanan.

---

## Fase 6: Otentikasi (Auth)

- [ ] `POST /api/auth/register` — Registrasi akun warga
- [ ] `POST /api/auth/login` — Login & mendapatkan token JWT
- [ ] `GET /api/auth/me` — Ambil data profil user yang sedang login
- [ ] `PUT /api/users/me` — Edit data profil
- [ ] `PUT /api/users/me/avatar` — Upload foto profil
- [ ] `PUT /api/users/me/password` — Ganti password

---

## Fase 7: Kategori

- [ ] `GET /api/categories` — Lihat daftar kategori
- [ ] `POST /api/categories` — Tambah kategori *(Admin)*
- [ ] `PUT /api/categories/:id` — Edit kategori *(Admin)*
- [ ] `DELETE /api/categories/:id` — Hapus kategori *(Admin)*

---

## Fase 8: Laporan (Core Application)

- [ ] `POST /api/reports` — Buat laporan (`multipart/form-data`: `judul`, `deskripsi`, `kategori`, `lokasi`, `foto`) *(Authenticated)*
- [ ] `GET /api/reports` — Feed utama (Mirip Instagram)
  - Cursor-based pagination (`?cursor=...&limit=10`) untuk infinite scroll
  - Urutan terbaru terlebih dahulu
  - Filter berdasarkan kategori, status, dan pencarian kata kunci
  - Mengembalikan data user, foto, jumlah *like*, jumlah komentar, & flag `isLikedByMe`
- [ ] `GET /api/reports/:id` — Detail laporan
- [ ] `GET /api/reports/me` — Daftar laporan milik user yang login
- [ ] `PUT /api/reports/:id` — Edit laporan *(Pemilik)*
- [ ] `DELETE /api/reports/:id` — Hapus laporan *(Pemilik / Admin, hapus juga berkas di `uploads/`)*
- [ ] `PATCH /api/reports/:id/status` — Ubah status laporan & catat ke riwayat *(Admin)*
- [ ] *(Opsional)* `GET /api/reports/nearby` — Filter berdasarkan lokasi terdekat

---

## Fase 9: Interaksi Sosial

- [ ] `POST /api/reports/:id/like` — Toggle *like* / *unlike*
- [ ] `GET /api/reports/:id/comments` — Ambil komentar laporan (dengan pagination)
- [ ] `POST /api/reports/:id/comments` — Tambah komentar baru
- [ ] `DELETE /api/comments/:id` — Hapus komentar *(Pemilik Komentar / Admin)*
- [ ] *(Opsional)* `GET /api/notifications` — Ambil & tandai notifikasi sudah dibaca

---

## Fase 10: Admin & Statistik

- [ ] `GET /api/admin/stats` — Total laporan per status, per kategori, & total user
- [ ] `GET /api/admin/users` — Kelola / nonaktifkan / hapus user *(Opsional)*
- [ ] `GET /api/admin/reports` — Daftar semua laporan untuk moderasi

---

## Fase 11: Pengujian (Testing di Hoppscotch / Postman)

- [ ] 1. Buat Collection **LaporWarga** & atur Environment Variables (`baseUrl`, `token`).
- [ ] 2. Uji endpoint `GET /api/health`.
- [ ] 3. Uji register & login, lalu salin token ke Environment Variable.
- [ ] 4. Set Header `Authorization: Bearer {{token}}`.
- [ ] 5. Uji upload foto: gunakan body `multipart/form-data` dengan field `images` bertipe *File*.
- [ ] 6. Uji semua endpoint laporan, termasuk cursor pagination pada feed.
- [ ] 7. Uji fitur *like*, *comments*, dan endpoint admin.
- [ ] 8. Uji *edge cases* (tanpa token, token invalid, role tidak sesuai, input tidak valid, format file salah, ukuran file berlebih).
- [ ] 9. Verifikasi akses foto via browser: `http://localhost:3000/uploads/namafile.jpg`.

---

## Fase 12: Penyelesaian & Finalisasi

- [ ] 1. Konfigurasi **CORS** agar hanya menerima *origin* dari frontend.
- [ ] 2. Standardisasi format error dan HTTP Status Code pada semua endpoint.
- [ ] 3. Atur npm scripts di `package.json` (`start`, `dev`, `seed`, `migrate`).
- [ ] 4. Dokumentasikan semua endpoint di `README.md` (atau export Hoppscotch Collection).
- [ ] 5. Commit ke Git (pastikan `.env`, `node_modules/`, dan `uploads/` terabaikan).
- [ ] 6. Hubungkan backend dengan frontend dan uji alur end-to-end.
- [ ] 7. *(Opsional)* Deploy backend & migrasikan media ke Cloud Storage (Cloudinary / AWS S3 / Supabase Storage).

---

> **Langkah Selanjutnya:**  
> Fokus awal yang paling tepat adalah **Fase 1 dan Fase 2** (Setup Prisma & Desain Schema).