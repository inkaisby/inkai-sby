import { test, expect } from "@playwright/test";

test.describe("UKT (Ujian Kenaikan Tingkat) Workflow", () => {
  // Jalankan langkah ini sebelum setiap pengujian (misal: Login terlebih dahulu)
  test.beforeEach(async ({ page }) => {
    // 1. Masuk ke halaman login
    await page.goto("/login");

    // 2. Isi form login (Menggunakan kredensial akun uji coba)
    // Catatan: Ganti dengan kredensial dummy/test yang sesuai di database lokal Anda
    await page.fill("#login-identifier", "member.test@example.com");
    await page.fill("#login-password", "InkaiSby2026");

    // 3. Klik tombol login/submit form
    await page.click("button[type='submit']");

    // 4. Pastikan berhasil diarahkan ke dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("Anggota dapat melihat kartu UKT dan membuka formulir pendaftaran", async ({ page }) => {
    // Pengujian ini mensimulasikan alur pendaftaran mandiri UKT oleh anggota:
    
    // 1. Cari kartu status UKT atau menu UKT
    const uktCard = page.locator("text=Ujian Kenaikan Tingkat");
    await expect(uktCard).toBeVisible();

    // 2. Klik tombol "Daftar UKT sekarang"
    const registerButton = page.locator("button:has-text('Daftar UKT sekarang')");
    // Jika sedang dalam periode pendaftaran aktif, tombol ini harusnya bisa diklik
    if (await registerButton.isVisible()) {
      await registerButton.click();

      // 3. Pastikan modal / halaman pendaftaran terbuka
      const formHeader = page.locator("text=Formulir Pendaftaran UKT");
      await expect(formHeader).toBeVisible();

      // 4. Pilih Kyu target (misal Kyu 5 Sabuk Biru)
      await page.selectOption("select[name='targetRank']", { label: "Kyu 5 (Biru)" });

      // 5. Submit pendaftaran
      await page.click("button:has-text('Kirim Pendaftaran')");

      // 6. Verifikasi notifikasi sukses atau perubahan status
      await expect(page.locator("text=Pendaftaran berhasil diajukan")).toBeVisible();
    }
  });

  test("Admin dapat melihat pendaftar UKT di panel admin", async ({ page }) => {
    // Contoh pengujian alur untuk Admin/Pengurus cabang:
    
    // Pergi ke halaman admin khusus UKT
    await page.goto("/admin/ukt");

    // Pastikan tabel data UKT dirender
    const uktTable = page.locator("table");
    await expect(uktTable).toBeVisible();

    // Pastikan KPI ringkasan data pendaftar muncul
    const kpiSummary = page.locator("text=Total Peserta");
    await expect(kpiSummary).toBeVisible();
  });
});
