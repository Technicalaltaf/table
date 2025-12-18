const express = require("express");
const puppeteer = require("puppeteer");
const { execSync } = require("child_process");

const app = express();
const PORT = process.env.PORT || 5000;

let cache = null;
let loading = false;
let lastError = null;

/* ================= CHROMIUM PATH ================= */
function getChromiumPath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  try {
    return execSync("which chromium").toString().trim();
  } catch {
    return puppeteer.executablePath();
  }
}

/* ================= FETCH DATA ================= */
async function fetchData() {
  if (loading) return; // IMPORTANT
  loading = true;
  lastError = null;

  let browser = null;
  console.log("Fetching live data...");

  try {
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: getChromiumPath(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
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

    // puppeteer compatible delay
    await new Promise(r => setTimeout(r, 6000));

    const data = await page.evaluate(() => {

      function getBox(title) {
        const blocks = Array.from(document.querySelectorAll("div"))
          .filter(d => d.innerText && d.innerText.includes(title));

        if (!blocks.length) return null;

        const box = blocks[0].closest("div");
        if (!box) return null;

        const spans = Array.from(box.querySelectorAll("span"))
          .map(s => s.innerText.trim())
          .filter(v => /^[0-9]/.test(v));

        return {
          bid: spans[0] || null,
          ask: spans[1] || null,
          high: spans[2] || null,
          low: spans[3] || null
        };
      }

      return {
        spots: {
          gold: getBox("GOLD SPOT"),
          silver: getBox("SILVER SPOT"),
          inr: getBox("INR SPOT")
        },
        futures: {
          gold: getBox("GOLD FUTURE"),
          silver: getBox("SILVER FUTURE")
        },
        next: {
          gold: getBox("GOLD NEXT"),
          silver: getBox("SILVER NEXT")
        },
        tables: Array.from(document.querySelectorAll("table"))
          .map(t => t.outerHTML)
      };
    });

    cache = data;
    console.log("Data updated OK");

  } catch (error) {
    console.error("Fetch error:", error.message);
    lastError = error.message;
  } finally {
    loading = false;
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}

/* ================= SCHEDULER ================= */
// SAFE INTERVAL (no infinite while loop)
setInterval(fetchData, 3000);

/* ================= ROUTES ================= */
app.get("/", (req, res) => {
  res.send("Ambica Live Server OK");
});

app.get("/data", (req, res) => {
  if (!cache && loading) {
    return res.json({ status: "loading" });
  }
  if (!cache && lastError) {
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
  console.log("Server running on", PORT);
});
