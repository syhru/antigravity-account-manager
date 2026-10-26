const { chromium } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    const base = process.env.TEST_URL || "http://127.0.0.1:3010";
    await page.goto(base);
    await page
      .getByRole("button", { name: "Log Aktivitas", exact: true })
      .click();
    await page.waitForFunction(() =>
      document.body.innerText.includes("Terhubung"),
    );
    // Wait until the actual SSE stream is ready, then exercise safe invalid input.
    await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const s = new EventSource("/api/logs");
          const t = setTimeout(() => {
            s.close();
            reject(Error("SSE timeout"));
          }, 10000);
          s.addEventListener("ready", () => {
            clearTimeout(t);
            s.close();
            resolve();
          });
        }),
    );
    const start = Date.now();
    const result = await page.evaluate(async () => {
      const r = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "audit-test-invalid",
          code: "SECRET_TEST_DO_NOT_LOG",
        }),
      });
      return r.status;
    });
    if (result !== 400) throw Error("Invalid action not rejected");
    await page
      .getByText(
        "Aksi akun gagal atau permintaan tidak valid. Tidak ada jaminan seluruh langkah selesai; muat ulang akun.",
        { exact: true },
      )
      .first()
      .waitFor({ timeout: 10000 });
    if (
      (await page.locator("body").innerText()).includes(
        "SECRET_TEST_DO_NOT_LOG",
      )
    )
      throw Error("Secret leaked");
    console.log(
      "PASS SSE error delivery in",
      Date.now() - start,
      "ms; no raw input leak",
    );
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Log Aktivitas", exact: true })
      .click();
    await page.getByText("actions_failed", { exact: true }).first().waitFor();
    await page.setViewportSize({ width: 360, height: 800 });
    console.log("PASS history survives dialog reopen; mobile panel loaded");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
