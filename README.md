# INKAI Surabaya

Website aplikasi resmi **Institut Karate-Do Indonesia (INKAI) Cabang Surabaya**.

Dibangun dengan Next.js 16, Prisma, Auth.js, dan Tailwind CSS. Deploy di [Vercel](https://vercel.com) dan source code di [GitHub](https://github.com/inkaisby/inkai-sby).

## Fitur

### Halaman Publik
- **Beranda** — Hero dengan logo INKAI, carousel artikel, motto
- **Sejarah** — Sejarah organisasi INKAI Surabaya
- **Makna Lambang** — Filosofi Merah, Putih, Hitam, Kuning
- **Struktur Organisasi** — Hierarki Pusat → Provinsi → Cabang → Dojo/Ranting
- **Visi & Misi** — Visi, misi, dan nilai inti organisasi
- **Artikel** — Carousel berita & kegiatan terbaru

### Autentikasi & Dashboard
- Login & Pendaftaran anggota
- **Dashboard Anggota** — Profil keanggotaan, sabuk, dojo
- **Beranda Admin** — Statistik scoped per role
- **Kelola Anggota** — Daftar anggota sesuai scope RBAC

### RBAC (Role-Based Access Control)
| Role | Scope |
|------|-------|
| Administrator Pusat | Seluruh nasional |
| Admin Provinsi | Cabang & ranting di provinsinya |
| Admin Cabang | Dojo/ranting di cabangnya |
| Admin Dojo/Ranting | Anggota di rantingnya |
| Anggota | Dashboard pribadi |

## Development

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

### Akun Demo (password: `inkai123`)

| Email | Role |
|-------|------|
| admin@inkai.id | Administrator Pusat |
| admin.jatim@inkai.id | Admin Provinsi |
| admin.sby@inkai.id | Admin Cabang Surabaya |
| admin.dojo@inkai.id | Admin Dojo/Ranting |
| anggota@inkai.id | Anggota |

## Deploy ke Vercel

1. Push ke GitHub
2. Import repo di [vercel.com/new](https://vercel.com/new)
3. Set environment variables:
   - `AUTH_SECRET` — random secret string
   - `DATABASE_URL` — PostgreSQL connection (disarankan [Neon](https://neon.tech))
4. Deploy

> **Catatan:** SQLite hanya untuk development lokal. Production di Vercel memerlukan PostgreSQL.

## Struktur

```
src/
├── app/
│   ├── (public)/     # Halaman publik
│   ├── admin/        # Panel admin (RBAC)
│   ├── dashboard/    # Dashboard anggota
│   └── api/          # API routes
├── components/       # UI components
└── lib/              # Prisma, RBAC, utils
prisma/
├── schema.prisma     # Database schema
└── seed.ts           # Data awal
```
