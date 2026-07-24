-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AppreciationKind" AS ENUM ('KENANGAN', 'PRESTASI');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppreciationEntry" (
    "id" TEXT NOT NULL,
    "kind" "AppreciationKind" NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "summary" TEXT NOT NULL,
    "photoUrl" TEXT,
    "eventDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppreciationEntry_pkey" PRIMARY KEY ("id")
);
