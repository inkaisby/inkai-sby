# INKAI Surabaya

Website aplikasi resmi **Institut Karate-Do Indonesia (INKAI) Cabang Surabaya**.

Terhubung ke **database Supabase PostgreSQL** yang sama dengan `inkai-backend`.

## Fitur

### Halaman Publik
- Beranda + carousel dari tabel `NewsCarousel`
- Sejarah, Makna Lambang, Struktur Organisasi, Visi & Misi
- Login & Pendaftaran anggota

### Dashboard
- **Anggota** (`MEMBER`) → `/dashboard` — data dari tabel `Member`
- **Admin** → `/admin` — statistik & kelola anggota sesuai RBAC

### RBAC (selaras inkai-backend)
| Role DB | Scope |
|---------|-------|
| `ADMIN_PUSAT` / `ADMINISTRATOR` | Seluruh nasional |
| `ADMIN_PROVINCE` | Provinsi (`managedProvinceId`) |
| `ADMIN_BRANCH` | Cabang (`managedBranchId`) |
| `ADMIN_DOJO` | Dojo/Ranting (`managedDojoId`) |
| `MEMBER` | Dashboard anggota |

## Setup Lokal

```bash
npm install
cp .env.example .env   # isi DATABASE_URL Supabase
npx prisma generate
npm run dev
```

### Environment Variables

```env
DATABASE_URL=postgresql://...@...pooler.supabase.com:5432/postgres?sslmode=require
DIRECT_URL=postgresql://...@...pooler.supabase.com:5432/postgres?sslmode=require
AUTH_SECRET=random-secret-string
NEXTAUTH_URL=http://localhost:3000
```

## Deploy Vercel

Set `DATABASE_URL`, `DIRECT_URL`, dan `AUTH_SECRET` di Vercel Environment Variables (sama dengan inkai-backend).

## Tabel Supabase yang Dipakai

- `Province`, `Branch`, `Dojo` — struktur organisasi
- `User`, `Role`, `Member` — auth & anggota
- `NewsCarousel` — carousel berita di beranda

Schema Prisma: `prisma/schema.prisma` (identik dengan inkai-backend).
