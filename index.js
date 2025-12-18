const express = require("express");
const puppeteer = require("puppeteer");
const { execSync } = require("child_process");

const app = express();
const PORT = process.env.PORT || 5000;

let cache = null;
let loading = false;
let lastError = null;

function getChromiumPath() {
  try {
    return process.env.PUPPETEER_EXECUTABLE_PATH
      || execSync("which chromium").toString().trim();
  } catch {
    return puppeteer.executablePath();
  }
}

async function fetchData() {
  loading = true;
  lastError = null;
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: getChromiumPath(),
      args: ["--no-sandbox","--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

    await page.goto("http://anjujewellery.in/", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await page.waitForTimeout(5000);

    const data = await page.evaluate(() => {

      function parseBox(title){
        const box = [...document.querySelectorAll("h4,h3,div")]
          .find(e => e.innerText?.includes(title));
        if(!box) return null;

        const parent = box.closest("div");
        const spans = parent?.querySelectorAll("span") || [];

        const nums = [...spans]
          .map(s => s.innerText.replace(/[^\d.]/g,""))
          .filter(Boolean);

        return {
          bid: nums[0] || null,
          ask: nums[1] || null,
          high: nums[2] || null,
          low: nums[3] || null
        };
      }

      function parseTables(){
        return [...document.querySelectorAll("table")].map(t=>{
          const html = t.outerHTML;
          let type = "unknown";

          if(html.includes("RTGS")) type = "rtgs";
          if(html.includes("Retail")) type = "retail";

          return { type, html };
        });
      }

      function parseDirection(){
        return [...document.querySelectorAll(".bgm")].map(e=>{
          return {
            value: e.innerText.trim(),
            dir: e.classList.contains("l") ? "up"
               : e.classList.contains("e") ? "down"
               : "same"
          };
        });
      }

      return {
        spots:{
          gold: parseBox("GOLD SPOT"),
          silver: parseBox("SILVER SPOT"),
          inr: parseBox("INR SPOT")
        },
        futures:{
          gold: parseBox("GOLD FUTURE"),
          silver: parseBox("SILVER FUTURE")
        },
        next:{
          gold: parseBox("GOLD NEXT"),
          silver: parseBox("SILVER NEXT")
        },
        tables: parseTables(),
        movement: parseDirection()
      };
    });

    cache = data;
  } catch (e) {
    lastError = e.message;
  } finally {
    loading = false;
    if(browser) await browser.close();
  }
}

async function scheduler(){
  while(true){
    await fetchData();
    await new Promise(r=>setTimeout(r,10000));
  }
}
scheduler();

/* ================= API ================= */

app.get("/",(_,res)=>res.send("Ambica Live Server OK"));

app.get("/data",(req,res)=>{
  if(loading) return res.json({status:"loading"});
  if(!cache) return res.json({status:"error",error:lastError});
  res.json({status:"ok",data:cache});
});

app.listen(PORT,"0.0.0.0",()=>{
  console.log("Server running on",PORT);
});
