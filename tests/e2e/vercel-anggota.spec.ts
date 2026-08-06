import { test, expect } from "@playwright/test";

test("Verify Vercel admin anggota page loads and capture screenshot", async ({
  page,
  browserName,
}) => {
  test.skip(
    !process.env.PLAYWRIGHT_PROD,
    "Set PLAYWRIGHT_PROD=1 to run production Vercel smoke tests",
  );
  test.skip(
    browserName === "webkit",
    "Skip WebKit due to environment-specific timeout issues"
  );

  // Go to login page
  await page.goto("https://inkai-sby.vercel.app/login");

  // Log in
  await page.fill("#login-identifier", "cabangsby@gmail.com");
  await page.fill("#login-password", "inkai123");
  await page.click("button[type='submit']");

  // Wait for redirect
  await page.waitForURL(/.*(dashboard|admin).*/, {
    waitUntil: "domcontentloaded",
  });

  // Navigate to Anggota page
  await page.goto("https://inkai-sby.vercel.app/admin/anggota");

  // Wait for page to stabilize
  await page.waitForTimeout(3000);

  // Take screenshot and save to artifacts folder
  await page.screenshot({
    path: "C:/Users/USER/.gemini/antigravity/brain/b51b6868-bca0-4394-8703-b29d88a33b49/screenshot-anggota.png",
    fullPage: true,
  });

  // Verify URL matches
  expect(page.url()).toContain("/admin/anggota");
});
