import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
for (const path of ["/", "/rankings", "/live", "/statistics"]) {
  await p.goto("http://localhost:4173" + path, { waitUntil: "networkidle" });
  const sw = await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  console.log(path, JSON.stringify(sw));
}
await b.close();
