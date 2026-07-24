import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..");
const baseUrl = process.env.MAP_URL || "http://localhost:3001";

async function openPlot(page, plotId) {
  // Click the plot label text inside the SVG
  const label = page.locator(`svg text`).filter({ hasText: new RegExp(`^${plotId}$`) }).first();
  await label.waitFor({ timeout: 15000 });
  await label.click({ force: true });
  await page.getByRole("dialog", { name: `Plot ${plotId} details` }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  // Available plot 103
  await openPlot(page, "103");
  await page.screenshot({
    path: path.join(outDir, "popup-available-103.png"),
    fullPage: false,
  });
  await page.getByLabel("Close").first().click();
  await page.waitForTimeout(400);

  // Sold plot 122
  await openPlot(page, "122");
  await page.screenshot({
    path: path.join(outDir, "popup-sold-122.png"),
    fullPage: false,
  });

  await browser.close();
  console.log("Wrote popup-available-103.png and popup-sold-122.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
