-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ANGGOTA',
    "scopeProvinsiId" TEXT,
    "scopeCabangId" TEXT,
    "scopeDojoId" TEXT,
    "anggotaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_anggotaId_fkey" FOREIGN KEY ("anggotaId") REFERENCES "Anggota" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pusat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL DEFAULT 'INKAI Pusat'
);

-- CreateTable
CREATE TABLE "Provinsi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "pusatId" TEXT NOT NULL,
    CONSTRAINT "Provinsi_pusatId_fkey" FOREIGN KEY ("pusatId") REFERENCES "Pusat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cabang" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "kota" TEXT NOT NULL,
    "provinsiId" TEXT NOT NULL,
    CONSTRAINT "Cabang_provinsiId_fkey" FOREIGN KEY ("provinsiId") REFERENCES "Provinsi" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dojo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "alamat" TEXT,
    "cabangId" TEXT NOT NULL,
    CONSTRAINT "Dojo_cabangId_fkey" FOREIGN KEY ("cabangId") REFERENCES "Cabang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Anggota" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nomorInduk" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tanggalLahir" DATETIME,
    "sabuk" TEXT NOT NULL DEFAULT 'Putih',
    "dojoId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Anggota_dojoId_fkey" FOREIGN KEY ("dojoId") REFERENCES "Dojo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_anggotaId_key" ON "User"("anggotaId");

-- CreateIndex
CREATE UNIQUE INDEX "Provinsi_kode_key" ON "Provinsi"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "Anggota_nomorInduk_key" ON "Anggota"("nomorInduk");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");
