const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 5000;

let cache = null;
let loading = false;
let lastError = null;

async function fetchTables() {
  if (loading) return;
  loading = true;
  lastError = null;

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    });

    const page = await browser.newPage();

    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 2
    });

    await page.goto("https://anjujewellery.in/", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // manual delay (puppeteer compatible)
    await new Promise(r => setTimeout(r, 5000));

    const data = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll("table"))
        .map(t => t.outerHTML);

      return { tables };
    });

    cache = data;
    console.log("RTGS + Retail tables updated");

  } catch (err) {
    console.error("Fetch error:", err.message);
    lastError = err.message;
  } finally {
    loading = false;
    if (browser) await browser.close();
  }
}

/* ===== AUTO FETCH EVERY 1 SECOND ===== */
setInterval(fetchTables, 1000);

/* ===== ROUTES ===== */

app.get("/", (req, res) => {
  res.send("RTGS / Retail Table Server OK");
});

app.get("/data", (req, res) => {
  if (loading && !cache) {
    return res.json({ status: "loading" });
  }

  if (lastError) {
    return res.json({ status: "error", error: lastError });
  }

  if (!cache) {
    return res.json({ status: "loading" });
  }

  res.json({
    status: "ok",
    data: cache
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
