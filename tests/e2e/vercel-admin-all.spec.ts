import { test, expect } from "@playwright/test";

const PAGES = [
  "",
  "/absensi",
  "/anggota",
  "/apresiasi",
  "/audit",
  "/carousel",
  "/iuran",
  "/kegiatan",
  "/materi",
  "/notifikasi",
  "/online",
  "/organisasi",
  "/pengaturan",
  "/pesan",
  "/store",
  "/ukt",
  "/verifikasi",
];

test("Verify all admin pages load sequentially", async ({
  page,
  browserName,
}) => {
  test.setTimeout(120000);
  test.skip(
    browserName === "webkit",
    "Skip WebKit due to environment-specific timeout issues"
  );

  // Login satu kali saja
  await page.goto("https://inkai-sby.vercel.app/login");
  await page.fill("#login-identifier", "cabangsby@gmail.com");
  await page.fill("#login-password", "inkai123");
  await page.click("button[type='submit']");
  await page.waitForURL(/.*(dashboard|admin).*/, {
    waitUntil: "domcontentloaded",
  });

  // Kunjungi semua sub-halaman secara berurutan dalam satu sesi
  for (const path of PAGES) {
    const targetURL = `https://inkai-sby.vercel.app/admin${path}`;
    console.log(`Navigating to: ${targetURL}`);
    
    // Ganti timeout navigasi ke 15 detik saja agar tidak menghabiskan waktu tes global
    await page.goto(targetURL, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(err => {
      console.log(`Failed to navigate to ${targetURL}: ${err.message}`);
    });

    // Tunggu render halaman stabil
    await page.waitForTimeout(800);

    console.log(`Verifying content for: ${targetURL}`);
    // Pastikan tidak ada halaman crash
    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain("Internal Server Error");
    expect(bodyText).not.toContain("Application error");

    // Pastikan URL tujuan benar
    expect(page.url()).toContain(`/admin${path}`);
    console.log(`Successfully verified: ${targetURL}`);
  }
});
