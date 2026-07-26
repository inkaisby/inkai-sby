import { test, expect } from "@playwright/test";

test("should load homepage and display title", async ({ page }) => {
  await page.goto("/");
  // Check that the title or header contains INKAI
  await expect(page).toHaveTitle(/.*INKAI.*/i);
});
