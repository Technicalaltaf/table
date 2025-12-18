// ================= IMPORTS =================
const express = require("express");
const puppeteer = require("puppeteer");
const { execSync } = require("child_process");

// ================= APP =================
const app = express();
const PORT = process.env.PORT || 5000;

// ================= CACHE =================
let cache = {
  status: "loading",
  last_update: null,
  tables: []
};

let loading = true;
let lastError = null;

// ================= CHROMIUM PATH =================
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

// ================= FETCH TABLES =================
async function fetchTables() {
  loading = true;
  lastError = null;
  let browser;

  console.log("📋 Fetching TABLE data only...");

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

    await page.goto("http://anjujewellery.in/", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await page.waitForTimeout(6000);

    const tables = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("table"))
        .map(t => t.outerHTML)
        .filter(html => html.includes("table"));
    });

    cache = {
      status: "ok",
      last_update: new Date().toISOString(),
      tables
    };

    console.log(`✅ Tables updated: ${tables.length}`);
  } catch (err) {
    console.error("❌ Table fetch error:", err.message);
    lastError = err.message;
  } finally {
    loading = false;
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
}

// ================= SCHEDULER =================
async function startScheduler() {
  await fetchTables(); // first run
  setInterval(fetchTables, 30000); // every 30 sec (safe)
}

startScheduler();

// ================= ROUTES =================
app.get("/", (req, res) => {
  res.send("📋 Table-only service OK");
});

app.get("/tables", (req, res) => {
  if (loading) {
    return res.json({ status: "loading" });
  }
  if (lastError) {
    return res.json({ status: "error", error: lastError });
  }
  res.json(cache);
});

// ================= START =================
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Table service running on port", PORT);
});
