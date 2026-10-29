// Dev helper: node scripts/shoot.mjs <url> <out.png> [width] [height] [fullPage] [colorScheme]
import { chromium } from "@playwright/test"
const [url, out, w = "1440", h = "960", full = "false", scheme = "light"] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: +w, height: +h }, colorScheme: scheme, deviceScaleFactor: 1 })
const errors = []
page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
page.on("pageerror", (e) => errors.push(String(e)))
await page.goto(url, { waitUntil: "networkidle", timeout: 120000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: out, fullPage: full === "true" })
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no console errors")
await browser.close()
