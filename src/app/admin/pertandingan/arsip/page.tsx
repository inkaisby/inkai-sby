import AdminPertandinganPage from "../page";

export const metadata = {
  title: "Arsip Kejuaraan & Pertandingan | INKAI Kota Surabaya",
  description: "Arsip riwayat event kejuaraan karate dan rekapitulasi data atlet INKAI Kota Surabaya.",
};

export default function AdminPertandinganArsipPage() {
  return <AdminPertandinganPage viewMode="archive" />;
}
