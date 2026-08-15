-- ArticleEntry: berita/kegiatan publik (modul Konten → Artikel)
-- Terapkan di Postgres produksi (Supabase) sebelum/bersamaan deploy.
-- Lokal: npm run db:local:bootstrap (setelah Docker + DATABASE_URL port 5433).

CREATE TABLE IF NOT EXISTS "ArticleEntry" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "photoUrl" TEXT,
  "publishedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ArticleEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ArticleEntry_isActive_order_idx"
  ON "ArticleEntry"("isActive", "order");
