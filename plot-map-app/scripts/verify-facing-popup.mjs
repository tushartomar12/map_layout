import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..");
const baseUrl = process.env.MAP_URL || "http://localhost:3000";

async function openPlot(page, plotId) {
  const label = page
    .locator("svg text")
    .filter({ hasText: new RegExp(`^${plotId}$`) })
    .first();
  await label.waitFor({ timeout: 15000 });
  await label.click({ force: true });
  await page
    .getByRole("dialog", { name: `Plot ${plotId} details` })
    .waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
}

async function facingText(page) {
  const card = page.locator("p", { hasText: "FACING" }).first();
  if (!(await card.count())) return null;
  return card.locator("xpath=following-sibling::p[1]").textContent();
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);

// Interior grid plot
await openPlot(page, "75");
const facing75 = await facingText(page);
await page.screenshot({
  path: path.join(outDir, "popup-facing-75.png"),
  fullPage: false,
});
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
await page.waitForTimeout(400);

// Edge cluster near 175-182
await openPlot(page, "178");
const facing178 = await facingText(page);
await page.screenshot({
  path: path.join(outDir, "popup-facing-178.png"),
  fullPage: false,
});

console.log(
  JSON.stringify(
    {
      plot75Facing: facing75,
      plot178Facing: facing178,
    },
    null,
    2,
  ),
);

await browser.close();
