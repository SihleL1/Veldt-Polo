import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto("http://localhost:4173/", { waitUntil: "networkidle" });
const bad = await p.evaluate(() => {
  const out = [];
  const w = document.documentElement.clientWidth;
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width > w + 2 || r.right > w + 6) out.push(`${el.tagName}.${(el.className||"").toString().slice(0,80)} w=${Math.round(r.width)} right=${Math.round(r.right)}`);
  }
  return out.slice(0, 15);
});
console.log(bad.join("\n") || "no overflow");
await b.close();
