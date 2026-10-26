const { chromium } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3000");
  await page.getByText("Daftar Akun Tersimpan", { exact: true }).waitFor();
  await page.getByText("Terhubung", { exact: true }).waitFor();
  const search = page.getByPlaceholder("Cari alamat email...");
  await page.keyboard.press("/");
  if (!(await search.evaluate((e) => e === document.activeElement)))
    throw Error("Search shortcut failed");
  await search.fill("no-match@example.com");
  await page.waitForTimeout(200);
  await search.fill("");
  await page.getByText("Tambah Akun Baru", { exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Mobile horizontal overflow");
  await page.screenshot({ path: "dashboard-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "dashboard-desktop.png", fullPage: true });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS: live dashboard, local API connection, search shortcut, OAuth dialog, Escape, mobile layout, no runtime errors",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
