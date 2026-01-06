const puppeteer = require("puppeteer");

module.exports = async (req, res) => {
  let browser = null;

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

    await page.goto("http://anjujewellery.in/", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await new Promise(r => setTimeout(r, 5000));

    const data = await page.evaluate(() => {

      function getBox(title) {
        const headers = Array.from(document.querySelectorAll("div"))
          .filter(d => d.innerText && d.innerText.includes(title));

        if (!headers.length) return null;

        const box = headers[0].closest("div");
        if (!box) return null;

        const spans = box.querySelectorAll("span");

        const nums = Array.from(spans)
          .map(s => s.innerText.trim())
          .filter(v => /^[0-9]/.test(v));

        return {
          bid: nums[0] || null,
          ask: nums[1] || null,
          high: nums[2] || null,
          low: nums[3] || null
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
        }
      };
    });

    res.json({
      status: "ok",
      data
    });

  } catch (err) {
    res.json({
      status: "error",
      error: err.message
    });

  } finally {
    if (browser) await browser.close();
  }
};