/**
 * LaporWarga - Seeder (Prisma 7 + MySQL)
 *
 * Cakupan awal : Kota Bandung (30 kecamatan)
 * Instansi     : Dishub Kota Bandung & Satpol PP Kota Bandung
 * Letak file   : prisma/seed.ts
 * Jalankan     : npx prisma db seed
 *
 * Aman dijalankan berulang (idempotent): hanya menambah data yang belum ada
 * dan TIDAK menimpa data yang sudah diubah lewat aplikasi (termasuk password).
 *
 * Mau tambah wilayah/instansi nanti? Cukup tambah entri di konstanta
 * KECAMATAN_*, AGENCIES, CATALOG, atau USERS di bawah, lalu jalankan ulang.
 */
import 'dotenv/config';
import { PrismaClient, ReportStatus, Role } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL belum diisi di .env');
}

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

// =====================================================================
// DATA MASTER
// =====================================================================

// 30 kecamatan Kota Bandung
const KECAMATAN_BANDUNG = [
  'Andir',
  'Antapani',
  'Arcamanik',
  'Astanaanyar',
  'Babakan Ciparay',
  'Bandung Kidul',
  'Bandung Kulon',
  'Bandung Wetan',
  'Batununggal',
  'Bojongloa Kaler',
  'Bojongloa Kidul',
  'Buahbatu',
  'Cibeunying Kaler',
  'Cibeunying Kidul',
  'Cibiru',
  'Cicendo',
  'Cidadap',
  'Cinambo',
  'Coblong',
  'Gedebage',
  'Kiaracondong',
  'Lengkong',
  'Mandalajati',
  'Panyileukan',
  'Rancasari',
  'Regol',
  'Sukajadi',
  'Sukasari',
  'Sumur Bandung',
  'Ujungberung',
];

const AGENCIES = [
  {
    key: 'DISHUB',
    name: 'Dinas Perhubungan Kota Bandung',
    description:
      'Menangani perparkiran, lalu lintas dan perlengkapan jalan (rambu, marka, lampu lalu lintas, PJU/PJL), serta angkutan umum dan terminal.',
  },
  {
    key: 'SATPOLPP',
    name: 'Satuan Polisi Pamong Praja Kota Bandung',
    description:
      'Menegakkan Peraturan Daerah serta menjaga ketertiban umum dan ketenteraman masyarakat di Kota Bandung.',
  },
] as const;

type AgencyKey = (typeof AGENCIES)[number]['key'];

// Kategori -> subjenis -> instansi penanganan.
// Pemetaan agency disimpan di Subcategory (sesuai skema), di sini dikelompokkan per kategori.
const CATALOG: { category: string; agency: AgencyKey; subcategories: string[] }[] = [
  // ---------- Dishub ----------
  {
    category: 'Perparkiran',
    agency: 'DISHUB',
    subcategories: [
      'Parkir liar / juru parkir tanpa izin',
      'Tarif parkir tidak sesuai ketentuan',
      'Parkir di trotoar atau badan jalan yang menghambat lalu lintas',
    ],
  },
  {
    category: 'Lalu Lintas & Perlengkapan Jalan',
    agency: 'DISHUB',
    subcategories: [
      'Lampu lalu lintas (APILL) mati atau rusak',
      'Rambu lalu lintas rusak, hilang, atau tertutup',
      'Marka jalan pudar atau hilang',
      'Lampu penerangan jalan (PJU/PJL) mati atau rusak',
      'Titik rawan macet / pengaturan lalu lintas',
    ],
  },
  {
    category: 'Angkutan Umum & Terminal',
    agency: 'DISHUB',
    subcategories: [
      'Angkutan umum berhenti sembarangan (ngetem)',
      'Tarif angkutan umum tidak wajar / pungutan liar',
      'Halte rusak atau tidak layak',
      'Terminal atau fasilitas terminal tidak layak',
    ],
  },

  // ---------- Satpol PP ----------
  {
    category: 'Ketertiban Umum',
    agency: 'SATPOLPP',
    subcategories: [
      'PKL berjualan di trotoar, badan jalan, atau tempat terlarang',
      'Gelandangan, pengemis, dan anak jalanan',
      'Reklame, spanduk, atau baliho liar',
      'Bangunan liar di fasilitas umum atau lahan pemerintah',
      'Penyalahgunaan taman, jalur hijau, atau fasilitas umum',
    ],
  },
  {
    category: 'Ketenteraman Masyarakat',
    agency: 'SATPOLPP',
    subcategories: [
      'Peredaran minuman keras ilegal',
      'Tempat usaha atau hiburan melanggar jam operasional',
      'Gangguan ketenteraman lingkungan (keributan, kebisingan usaha)',
    ],
  },
];

// [P2] Batas waktu default tiap tahap (hari). Admin bisa mengubahnya lewat aplikasi.
// DITOLAK dan SELESAI sengaja tidak punya SLA (tahap akhir).
const SLA_DEFAULTS = [
  { stage: ReportStatus.MENUNGGU_VERIFIKASI, maxDays: 2 },
  { stage: ReportStatus.TERVERIFIKASI, maxDays: 1 },
  { stage: ReportStatus.DITERUSKAN, maxDays: 3 },
  { stage: ReportStatus.DALAM_PENANGANAN, maxDays: 7 },
];

// [P3] Lencana. Seeder hanya mendefinisikan lencananya;
// aturan pemberiannya (ambang batas) ada di logika aplikasi.
const BADGES = [
  { code: 'PELAPOR_PERTAMA', name: 'Pelapor Pertama', description: 'Mengirim laporan pertama' },
  { code: 'PELAPOR_AKTIF', name: 'Pelapor Aktif', description: 'Mengirim 10 laporan' },
  { code: 'PENDUKUNG_SETIA', name: 'Pendukung Setia', description: 'Memberi 25 dukungan pada laporan warga' },
  { code: 'VERIFIKATOR', name: 'Verifikator Warga', description: 'Ikut memverifikasi 10 laporan' },
  { code: 'LAPORAN_TUNTAS', name: 'Laporan Tuntas', description: '5 laporanmu selesai ditangani' },
  { code: 'STREAK_7', name: 'Konsisten 7 Hari', description: 'Berkontribusi 7 hari berturut-turut' },
];

// =====================================================================
// AKUN
// =====================================================================

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DEV_PASSWORD = 'Password123!'; // hanya untuk lokal/dev

const USERS: {
  name: string;
  email: string;
  passwordEnv: string;
  role: Role;
  agency?: AgencyKey;
  isAgencyHead?: boolean;
}[] = [
  {
    name: 'Administrator LaporWarga',
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@laporwarga.test',
    passwordEnv: 'SEED_ADMIN_PASSWORD',
    role: Role.ADMIN,
  },
  {
    // Satu-satunya akun instansi: Dishub, sekaligus atasan (penerima eskalasi SLA).
    // Mau akun Satpol PP? Salin blok ini, ganti agency: 'SATPOLPP'.
    name: 'Petugas Dishub Kota Bandung',
    email: process.env.SEED_INSTANSI_EMAIL ?? 'dishub@laporwarga.test',
    passwordEnv: 'SEED_INSTANSI_PASSWORD',
    role: Role.INSTANSI,
    agency: 'DISHUB',
    isAgencyHead: true,
  },
  {
    name: 'Warga Demo',
    email: process.env.SEED_WARGA_EMAIL ?? 'warga@laporwarga.test',
    passwordEnv: 'SEED_WARGA_PASSWORD',
    role: Role.WARGA,
  },
];

function resolvePassword(envKey: string): { value: string; isDefault: boolean } {
  const fromEnv = process.env[envKey];
  if (fromEnv) return { value: fromEnv, isDefault: false };
  if (IS_PRODUCTION) {
    throw new Error(`${envKey} wajib diisi saat NODE_ENV=production`);
  }
  return { value: DEV_PASSWORD, isDefault: true };
}

// =====================================================================
// PROSES SEED
// =====================================================================

async function seedDistricts() {
  for (const name of KECAMATAN_BANDUNG) {
    await prisma.district.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`✔ Kecamatan   : ${KECAMATAN_BANDUNG.length}`);
}

async function seedAgencies(): Promise<Record<AgencyKey, number>> {
  const ids = {} as Record<AgencyKey, number>;
  for (const a of AGENCIES) {
    const row = await prisma.agency.upsert({
      where: { name: a.name },
      update: {},
      create: { name: a.name, description: a.description },
    });
    ids[a.key] = row.id;
  }
  console.log(`✔ Instansi    : ${AGENCIES.length}`);
  return ids;
}

async function seedCatalog(agencyIds: Record<AgencyKey, number>) {
  let subCount = 0;
  for (const entry of CATALOG) {
    const category = await prisma.category.upsert({
      where: { name: entry.category },
      update: {},
      create: { name: entry.category },
    });
    for (const name of entry.subcategories) {
      await prisma.subcategory.upsert({
        where: { categoryId_name: { categoryId: category.id, name } },
        update: {},
        create: { name, categoryId: category.id, agencyId: agencyIds[entry.agency] },
      });
      subCount++;
    }
  }
  console.log(`✔ Kategori    : ${CATALOG.length} (subjenis: ${subCount})`);
}

async function seedUsers(agencyIds: Record<AgencyKey, number>): Promise<number> {
  let adminId = 0;
  const usingDefaultPassword: string[] = [];

  for (const u of USERS) {
    const { value, isDefault } = resolvePassword(u.passwordEnv);
    if (isDefault) usingDefaultPassword.push(u.email);

    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: {}, // akun yang sudah ada tidak ditimpa
      create: {
        name: u.name,
        email: u.email,
        passwordHash: await bcrypt.hash(value, 12),
        role: u.role,
        agencyId: u.agency ? agencyIds[u.agency] : null,
        isAgencyHead: u.isAgencyHead ?? false,
      },
    });
    if (u.role === Role.ADMIN) adminId = row.id;
  }

  console.log(`✔ Akun        : ${USERS.length} (${USERS.map((u) => u.role).join(', ')})`);
  if (usingDefaultPassword.length > 0) {
    console.warn(
      `⚠ Memakai password default dev untuk: ${usingDefaultPassword.join(', ')}. ` +
        `Set SEED_*_PASSWORD di .env sebelum deploy.`,
    );
  }
  return adminId;
}

async function seedSla(adminId: number) {
  for (const s of SLA_DEFAULTS) {
    await prisma.slaSetting.upsert({
      where: { stage: s.stage },
      update: {},
      create: { stage: s.stage, maxDays: s.maxDays, updatedById: adminId || null },
    });
  }
  console.log(`✔ Pengaturan SLA : ${SLA_DEFAULTS.length} tahap`);
}

async function seedBadges() {
  for (const b of BADGES) {
    await prisma.badge.upsert({ where: { code: b.code }, update: {}, create: b });
  }
  console.log(`✔ Lencana     : ${BADGES.length}`);
}

async function main() {
  console.log('Seeding LaporWarga (Kota Bandung)...');
  await seedDistricts();
  const agencyIds = await seedAgencies();
  await seedCatalog(agencyIds);
  const adminId = await seedUsers(agencyIds);
  await seedSla(adminId);
  await seedBadges();
  console.log('Selesai.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });