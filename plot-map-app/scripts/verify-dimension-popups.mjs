import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..");
const baseUrl = process.env.MAP_URL || "http://localhost:3001";

async function openBySearch(page, id) {
  const input = page.locator('input[placeholder="Type plot id"]').first();
  await input.fill("");
  await input.type(String(id), { delay: 40 });
  await page.waitForTimeout(900);
  const label = page
    .locator("svg text")
    .filter({ hasText: new RegExp(`^${id}$`) })
    .first();
  await label.click({ force: true });
  await page
    .getByRole("dialog", { name: `Plot ${id} details` })
    .waitFor({ timeout: 15000 });
  await page.waitForTimeout(700);
}

async function closeDialog(page) {
  await page.locator('[role=dialog] button[aria-label=Close]').click();
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  await openBySearch(page, "10");
  await page.screenshot({
    path: path.join(outDir, "popup-plot-10-dimensions.png"),
    fullPage: false,
  });
  await closeDialog(page);

  await openBySearch(page, "1");
  await page.screenshot({
    path: path.join(outDir, "popup-plot-1-irregular.png"),
    fullPage: false,
  });

  await browser.close();
  console.log("Wrote popup-plot-10-dimensions.png and popup-plot-1-irregular.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
