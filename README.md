# INKAI Surabaya

Website aplikasi resmi **Institut Karate-Do Indonesia (INKAI) Cabang Surabaya**.

Production terhubung ke **Supabase PostgreSQL** + **inkai-backend** (`inkai-ecosystem`). Dev lokal bisa full-stack dengan Postgres Docker di repo ini.

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

## Setup Lokal (Supabase / cloud DB)

```bash
npm install
cp .env.example .env   # isi DATABASE_URL Supabase + INKAI_API_URL
npx prisma generate
npm run dev
```

## Setup Lokal (Docker Postgres — full stack tanpa Supabase)

**Prasyarat:** Docker Desktop running, sibling `inkai-backend` dari repo `inkai-ecosystem`.

### 1. Portal — Postgres Docker

```powershell
# Salin blok "Lokal Docker" dari .env.example ke .env.local (port 5433, tanpa sslmode)
npm run db:local:up
npm run db:local:bootstrap
npm run dev
```

Script `db:local:bootstrap` menjalankan guard URL lokal → `prisma db push` → `prisma generate` → seed dummy.

| Script | Fungsi |
|--------|--------|
| `npm run db:local:up` | `docker compose up -d` (Postgres :5433) |
| `npm run db:local:down` | Stop container |
| `npm run db:local:reset` | Hapus volume + start ulang |
| `npm run db:local:bootstrap` | Push schema + seed lokal |
| `npm run db:local:assert` | Cek DATABASE_URL bukan Supabase |

Guard `scripts/assert-local-database.ts` **menolak** `db push`/seed jika `DATABASE_URL` mengandung Supabase atau host bukan `127.0.0.1:5433`.

### 2. Backend sibling (`inkai-backend` :5001)

Di folder sibling (mis. `D:\website\inkai\inkai-backend`):

```powershell
# .env — DATABASE_URL sama dengan portal (port 5433)
# DATABASE_URL="postgresql://inkai:inkai@127.0.0.1:5433/inkai_local?schema=public"
npm install
npm run dev
```

### 3. Verifikasi sebelum klaim "lokal jalan"

```text
GET http://localhost:5001/health/db     → { ok: true }
GET http://localhost:3000/api/auth/health → { ok: true, database: true }
```

Login seed (password **`inkai-local`**):

| Email | Role |
|-------|------|
| admin@local.inkai | ADMINISTRATOR |
| cabang@local.inkai | ADMIN_BRANCH |
| ranting@local.inkai | ADMIN_DOJO |
| anggota@local.inkai | MEMBER |

**Catatan:** Auto-sync ke cloud **belum ada**. Login wajib inkai-backend lokal; portal saja tidak cukup.

### Environment Variables (lokal Docker)

```env
DATABASE_URL=postgresql://inkai:inkai@127.0.0.1:5433/inkai_local?schema=public
DIRECT_URL=postgresql://inkai:inkai@127.0.0.1:5433/inkai_local?schema=public
INKAI_API_URL=http://localhost:5001
NEXT_PUBLIC_INKAI_API_URL=http://localhost:5001
AUTH_SECRET=dev-local-secret-minimum-32-characters
NEXTAUTH_URL=http://localhost:3000
```

## Deploy Vercel

Set `DATABASE_URL`, `DIRECT_URL`, `INKAI_API_URL`, dan `AUTH_SECRET` di Vercel Environment Variables.

## Tabel yang Dipakai

- `Province`, `Branch`, `Dojo` — struktur organisasi
- `User`, `Role`, `Member` — auth & anggota
- `NewsCarousel` — carousel berita di beranda

Schema Prisma: `prisma/schema.prisma` (identik dengan inkai-backend).
