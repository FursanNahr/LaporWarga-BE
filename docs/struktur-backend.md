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
│   │   ├── contact.routes.js            
│   │   ├── stats.routes.js
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
│   │   ├── stats.service.js
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
│   │   ├── cleanupUploads.js
│   │   └── errorHandler.js
│   │
│   ├── validators/                      # skema zod per modul
│   │   ├── auth.validator.js
│   │   ├── user.validator.js
│   │   ├── report.validator.js
│   │   ├── progress.validator.js
│   │   ├── comment.validator.js
│   │   ├── support.validator.js
│   │   ├── common.validator.js
│   │   ├── confirmation.validator.js    # [P2]
│   │   ├── category.validator.js
│   │   ├── agency.validator.js
│   │   ├── stats.validator.js
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
│       ├── statsHelpers.js
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
├── vercel.json
├── package.json
├── package-lock.json
└── README.md
```
