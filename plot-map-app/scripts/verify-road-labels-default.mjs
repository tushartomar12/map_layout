import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "verify-road-labels-default.png");
const baseUrl = process.env.MAP_URL || "http://localhost:3000";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);

const labels = await page.evaluate(() => {
  const svg = document.querySelector('svg[aria-label="Plot map"]');
  if (!svg) return { error: "svg not found" };
  const roadTexts = [...svg.querySelectorAll("#road-labels text")];
  const amenity = svg.querySelector('#landmark-decorations text');
  return {
    roadCount: roadTexts.length,
    roadFontSizes: roadTexts.map((t) => ({
      text: t.querySelector("textPath")?.textContent ?? "",
      fontSize: t.getAttribute("font-size"),
    })),
    amenityFontSize: amenity?.getAttribute("font-size"),
  };
});

console.log(JSON.stringify(labels, null, 2));
await page.locator(".map-main").screenshot({ path: outPath });
console.log(`Saved ${outPath}`);
await browser.close();
