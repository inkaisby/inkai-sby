import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = dbUrl.replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.article.deleteMany();
  await prisma.user.deleteMany();
  await prisma.anggota.deleteMany();
  await prisma.dojo.deleteMany();
  await prisma.cabang.deleteMany();
  await prisma.provinsi.deleteMany();
  await prisma.pusat.deleteMany();

  const pusat = await prisma.pusat.create({
    data: { nama: "INKAI Pusat" },
  });

  const jatim = await prisma.provinsi.create({
    data: { nama: "Jawa Timur", kode: "JATIM", pusatId: pusat.id },
  });

  const cabangSby = await prisma.cabang.create({
    data: {
      nama: "INKAI Cabang Surabaya",
      kota: "Surabaya",
      provinsiId: jatim.id,
    },
  });

  const dojos = await Promise.all([
    prisma.dojo.create({
      data: {
        nama: "Dojo Ranting Wonokromo",
        alamat: "Jl. Wonokromo No. 12, Surabaya",
        cabangId: cabangSby.id,
      },
    }),
    prisma.dojo.create({
      data: {
        nama: "Dojo Ranting Gubeng",
        alamat: "Jl. Gubeng No. 45, Surabaya",
        cabangId: cabangSby.id,
      },
    }),
    prisma.dojo.create({
      data: {
        nama: "Dojo Ranting Rungkut",
        alamat: "Jl. Rungkut Asri No. 8, Surabaya",
        cabangId: cabangSby.id,
      },
    }),
  ]);

  const passwordHash = await bcrypt.hash("inkai123", 12);

  await prisma.user.create({
    data: {
      email: "admin@inkai.id",
      name: "Administrator Pusat",
      passwordHash,
      role: "PUSAT",
    },
  });

  await prisma.user.create({
    data: {
      email: "admin.jatim@inkai.id",
      name: "Admin Provinsi Jatim",
      passwordHash,
      role: "PROVINSI",
      scopeProvinsiId: jatim.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "admin.sby@inkai.id",
      name: "Admin Cabang Surabaya",
      passwordHash,
      role: "CABANG",
      scopeProvinsiId: jatim.id,
      scopeCabangId: cabangSby.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "admin.dojo@inkai.id",
      name: "Admin Dojo Wonokromo",
      passwordHash,
      role: "DOJO",
      scopeProvinsiId: jatim.id,
      scopeCabangId: cabangSby.id,
      scopeDojoId: dojos[0].id,
    },
  });

  const anggota = await prisma.anggota.create({
    data: {
      nomorInduk: "INKAI-00001",
      nama: "Budi Santoso",
      sabuk: "Hijau",
      dojoId: dojos[0].id,
    },
  });

  await prisma.user.create({
    data: {
      email: "anggota@inkai.id",
      name: "Budi Santoso",
      passwordHash,
      role: "ANGGOTA",
      anggotaId: anggota.id,
      scopeDojoId: dojos[0].id,
    },
  });

  await prisma.article.createMany({
    data: [
      {
        title: "INKAI Surabaya Raih Juara Umum Kompetisi Regional",
        slug: "juara-umum-regional-2026",
        excerpt:
          "Tim karateka INKAI Surabaya berhasil meraih juara umum dalam kompetisi regional Jawa Timur 2026.",
        content:
          "Dalam ajang kompetisi regional Jawa Timur 2026, seluruh dojo ranting di bawah INKAI Cabang Surabaya menunjukkan performa luar biasa dengan total 15 medali emas, 8 perak, dan 5 perunggu.",
        imageUrl: "/logo-inkai.png",
        published: true,
      },
      {
        title: "Pelatihan Sabuk Hitam Batch 2026 Dibuka",
        slug: "pelatihan-sabuk-hitam-2026",
        excerpt:
          "Pendaftaran pelatihan persiapan ujian sabuk hitam untuk seluruh anggota INKAI Surabaya.",
        content:
          "Pelatihan intensif akan dilaksanakan selama 3 bulan dengan instruktur bersertifikat nasional. Pendaftaran dibuka mulai 1 Agustus 2026.",
        imageUrl: "/logo-inkai.png",
        published: true,
      },
      {
        title: "Seminar Karate-Do: Filosofi Budo Modern",
        slug: "seminar-filosofi-budo",
        excerpt:
          "Seminar nasional membahas integrasi nilai-nilai budo karate dalam kehidupan sehari-hari.",
        content:
          "Seminar ini menghadirkan Sensei nasional dan terbuka untuk seluruh anggota INKAI dari berbagai cabang di Indonesia.",
        imageUrl: "/logo-inkai.png",
        published: true,
      },
      {
        title: "INKAI Surabaya Gelar Latihan Rutin Mingguan",
        slug: "latihan-rutin-mingguan",
        excerpt:
          "Jadwal latihan rutin setiap hari Sabtu dan Minggu di seluruh dojo ranting Surabaya.",
        content:
          "Latihan rutin diadakan untuk meningkatkan teknik kihon, kata, dan kumite. Seluruh anggota diharapkan hadir tepat waktu.",
        imageUrl: "/logo-inkai.png",
        published: true,
      },
    ],
  });

  console.log("Seed completed!");
  console.log("Demo accounts (password: inkai123):");
  console.log("  admin@inkai.id - Administrator Pusat");
  console.log("  admin.jatim@inkai.id - Admin Provinsi");
  console.log("  admin.sby@inkai.id - Admin Cabang Surabaya");
  console.log("  admin.dojo@inkai.id - Admin Dojo");
  console.log("  anggota@inkai.id - Anggota");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
