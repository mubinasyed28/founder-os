/**
 * Cofoundr OS — Research Paper Screenshot Capture Script
 * Captures all 11 required UI screens for the IEEE paper.
 * Uses Playwright with Chromium at 1440x900 viewport.
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SCREENSHOTS_DIR = path.resolve(__dirname, "screenshots");
const BASE_URL = "http://localhost:5173";
const VIEWPORT = { width: 1440, height: 900 };

// Ensure output directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const SCREENS = [
  {
    name: "01_landing_page",
    url: "/",
    description: "Landing / Marketing Page",
    waitFor: 3000,
  },
  {
    name: "02_onboarding",
    url: "/onboarding",
    description: "Startup Onboarding Wizard",
    waitFor: 3000,
  },
  {
    name: "03_dashboard",
    url: "/app/",
    description: "Main Dashboard with KPI Overview",
    waitFor: 4000,
  },
  {
    name: "04_workspace",
    url: "/app/workspace",
    description: "Company Workspace",
    waitFor: 3000,
  },
  {
    name: "05_knowledge_base",
    url: "/app/knowledge",
    description: "Knowledge Base / Document Store",
    waitFor: 3000,
  },
  {
    name: "06_health",
    url: "/app/health",
    description: "Startup Health Diagnostics",
    waitFor: 4000,
  },
  {
    name: "07_research",
    url: "/app/research",
    description: "AI Research Agent",
    waitFor: 3000,
  },
  {
    name: "08_simulator",
    url: "/app/simulator",
    description: "Decision Simulator",
    waitFor: 3000,
  },
  {
    name: "09_forecast",
    url: "/app/forecast",
    description: "ML Forecast / Predictions",
    waitFor: 4000,
  },
  {
    name: "10_reasoning",
    url: "/app/reasoning",
    description: "AI Reasoning / Chat Interface",
    waitFor: 3000,
  },
  {
    name: "11_documents",
    url: "/app/documents",
    description: "Document Management",
    waitFor: 3000,
  },
];

(async () => {
  console.log("🚀  Launching Chromium (headless)...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,          // retina-quality images
    colorScheme: "dark",           // match existing dark theme
  });
  const page = await context.newPage();

  // Navigate to app root first to init any session state
  console.log("⏳  Initializing session at /app/ ...");
  try {
    await page.goto(`${BASE_URL}/app/`, { waitUntil: "networkidle", timeout: 30000 });
  } catch (e) {
    console.log("   ⚠  Initial load timed out, continuing...");
  }
  await page.waitForTimeout(3000);

  const results = [];

  for (const screen of SCREENS) {
    const outPath = path.join(SCREENSHOTS_DIR, `${screen.name}.png`);
    console.log(`\n📸  Capturing: ${screen.description} (${screen.url})`);
    try {
      await page.goto(`${BASE_URL}${screen.url}`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(screen.waitFor);

      // Dismiss any modals or toasts that might block the view
      try {
        const closeButtons = await page.$$('[aria-label="Close"], [data-dismiss], .toast-close, .modal-close');
        for (const btn of closeButtons) {
          await btn.click().catch(() => {});
        }
      } catch (_) {}

      await page.screenshot({ path: outPath, fullPage: false });
      const stat = fs.statSync(outPath);
      console.log(`   ✅  Saved: ${outPath} (${(stat.size / 1024).toFixed(1)} KB)`);
      results.push({ name: screen.name, description: screen.description, status: "OK", file: outPath, size: stat.size });
    } catch (err) {
      console.error(`   ❌  FAILED: ${err.message}`);
      results.push({ name: screen.name, description: screen.description, status: "FAILED", error: err.message });
    }
  }

  // Also capture additional useful pages
  const extras = [
    { name: "12_metrics", url: "/app/metrics", description: "Business Metrics" },
    { name: "13_opportunities", url: "/app/opportunities", description: "Opportunity Scoring" },
    { name: "14_investors", url: "/app/investors", description: "Investor Matching" },
    { name: "15_profile", url: "/app/profile", description: "Founder Profile" },
    { name: "16_graph", url: "/app/graph", description: "Knowledge Graph" },
    { name: "17_runway", url: "/app/runway", description: "Financial Runway" },
    { name: "18_validation", url: "/app/validation", description: "Idea Validation" },
  ];

  for (const screen of extras) {
    const outPath = path.join(SCREENSHOTS_DIR, `${screen.name}.png`);
    console.log(`\n📸  Capturing extra: ${screen.description} (${screen.url})`);
    try {
      await page.goto(`${BASE_URL}${screen.url}`, {
        waitUntil: "networkidle",
        timeout: 20000,
      });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: outPath, fullPage: false });
      const stat = fs.statSync(outPath);
      console.log(`   ✅  Saved: ${outPath} (${(stat.size / 1024).toFixed(1)} KB)`);
      results.push({ name: screen.name, description: screen.description, status: "OK", file: outPath, size: stat.size });
    } catch (err) {
      console.error(`   ❌  FAILED: ${err.message}`);
      results.push({ name: screen.name, description: screen.description, status: "FAILED", error: err.message });
    }
  }

  await browser.close();

  // Summary
  console.log("\n\n" + "=".repeat(60));
  console.log("  SCREENSHOT CAPTURE SUMMARY");
  console.log("=".repeat(60));
  const ok = results.filter(r => r.status === "OK");
  const fail = results.filter(r => r.status === "FAILED");
  console.log(`  Total: ${results.length}  |  ✅ Success: ${ok.length}  |  ❌ Failed: ${fail.length}`);
  if (fail.length > 0) {
    console.log("\n  Failed screens:");
    fail.forEach(f => console.log(`    - ${f.name}: ${f.error}`));
  }
  console.log("=".repeat(60));

  // Write JSON manifest
  const manifestPath = path.join(SCREENSHOTS_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2));
  console.log(`\n📋  Manifest written to: ${manifestPath}`);
})();
