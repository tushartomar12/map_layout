import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.locator("#plan").scrollIntoViewIfNeeded();
await page.waitForTimeout(600);

const info = await page.evaluate(() => {
  const svg = document.querySelector('svg[aria-label="Plot map"]');
  const water = svg.querySelectorAll("#layout-water polygon").length;
  const roads = svg.querySelectorAll("#layout-roads polygon").length;
  const parks = svg.querySelectorAll("#layout-parks polygon").length;
  const plots = svg.querySelectorAll("#plots polygon").length;
  const labels = [...svg.querySelectorAll("#labels text")].slice(0, 12).map((t) => t.textContent);
  const order = [...svg.children]
    .map((el) => el.id || el.tagName)
    .filter(Boolean);
  return { water, roads, parks, plots, labels, order };
});

console.log(JSON.stringify(info, null, 2));
await page.locator("#plan").screenshot({ path: "layout-layers-verify.png" });
await browser.close();
