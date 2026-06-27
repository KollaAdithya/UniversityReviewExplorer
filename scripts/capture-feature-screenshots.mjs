#!/usr/bin/env node
/**
 * One screenshot per feature bullet — deployed GCS frontend (+ API for backend-only features).
 * Each screenshot is annotated with red circles and arrows highlighting the described feature.
 */
import { chromium } from "playwright";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE =
  "https://storage.googleapis.com/course-review-frontend-project-7418296523698995083/index.html#";
const API = "https://course-review-api-7f5aay2nrq-uc.a.run.app";
const ROOT = path.resolve(".");
const OUT = path.resolve("docs/feature-screenshots");
const DEMO_EMAIL = "adithyakolla@demo.edu";
const DEMO_PASSWORD = "demo123456";

const FEATURES = [
  { id: "01-jeny-university-search", owner: "Jeny", line: "University search — search and browse 46+ universities with course/review counts" },
  { id: "02-jeny-university-course-search", owner: "Jeny", line: "University course search — filter courses by code, name, or department at a selected school" },
  { id: "03-jeny-multi-university-support", owner: "Jeny", line: "Multi-university support — each university has its own courses, professors, and reviews" },
  { id: "04-jeny-anonymous-browsing", owner: "Jeny", line: "Anonymous browsing — explore universities, courses, analytics, and reviews without signing in" },
  { id: "05-kanika-course-analytics-dashboard", owner: "Kanika", line: "Course analytics dashboard — KPIs: review count, average rating, sentiment score, top topic" },
  { id: "06-kanika-sentiment-breakdown", owner: "Kanika", line: "Sentiment breakdown — positive / neutral / negative percentages with a pie chart" },
  { id: "07-kanika-topic-analysis", owner: "Kanika", line: "Topic analysis — most-mentioned topics per course with a bar chart" },
  { id: "08-kanika-semester-trends", owner: "Kanika", line: "Semester trends — sentiment and rating over time (Fall/Spring terms) with a line chart" },
  { id: "09-kanika-course-comparison", owner: "Kanika", line: "Course comparison — compare sentiment metrics across courses at the same university" },
  { id: "10-kanika-review-explorer", owner: "Kanika", line: "Review explorer — browse reviews with filters for semester, professor, and sentiment" },
  { id: "11-kanika-review-text-search", owner: "Kanika", line: "Review text search — client-side search within review bodies on the dashboard" },
  { id: "12-sagarikha-submit-course-reviews", owner: "Sagarikha", line: "Submit course reviews — star rating + free-text review tied to a professor/offering (login required)" },
  { id: "13-sagarikha-sign-in", owner: "Sagarikha", line: "Sign in — email/password login for returning users" },
  { id: "14-sagarikha-sign-up", owner: "Sagarikha", line: "Sign up — switch to registration mode from the login page" },
  { id: "15-sagarikha-account-creation", owner: "Sagarikha", line: "Account creation — fill credentials and create a new Firebase account" },
  { id: "16-sagarikha-auth-gated-submission", owner: "Sagarikha", line: "Auth-gated submission — review form only appears when signed in; others see a login prompt" },
  { id: "17-sagarikha-user-profiles", owner: "Sagarikha", line: "User profiles — Firebase users synced to the backend (/api/v1/auth/me)" },
  { id: "18-veerish-ai-course-summaries", owner: "Veerish", line: "AI course summaries — generate summaries from review text (not just templates)" },
  { id: "19-veerish-multiple-summary-providers", owner: "Veerish", line: "Multiple summary providers — Ollama (local), Groq, OpenAI, Gemini/Vertex, or default template" },
  { id: "20-veerish-live-review-nlp", owner: "Veerish", line: "Live review NLP — new reviews get AI sentiment + topic tags on submit" },
  { id: "21-veerish-automatic-fallback", owner: "Veerish", line: "Automatic fallback — if an AI provider is down or unconfigured, falls back to mock/template" },
  { id: "22-veerish-provider-availability-ui", owner: "Veerish", line: "Provider availability UI — dashboard dropdown shows which AI providers are currently available" },
  { id: "23-adithya-real-rmp-dataset", owner: "Adithya", line: "Real RMP dataset — ~1,000 real RateMyProfessors-style reviews imported from public research data" },
  { id: "24-adithya-bulk-data-import-pipeline", owner: "Adithya", line: "Bulk data import pipeline — import admin console with audit log and CSV import triggers" },
  { id: "25-adithya-bigquery-analytics-sync", owner: "Adithya", line: "BigQuery analytics sync — live warehouse dashboard with row counts and cross-university charts" },
  { id: "26-adithya-cross-university-top-topics-api", owner: "Adithya", line: "Cross-university top topics — browse and filter top review topics across all schools" },
  { id: "27-adithya-data-catalog", owner: "Adithya", line: "Data catalog — public dataset provenance, licenses, and live database counts" },
  { id: "28-adithya-professor-analytics", owner: "Adithya", line: "Professor analytics — per-instructor sentiment, ratings, and top topics" },
];

function featureById(id) {
  return FEATURES.find((f) => f.id === id);
}

/** Red circle + optional arrow per selector. style: "circle" | "arrow" | "both" */
const HIGHLIGHTS = {
  "01-jeny-university-search": [
    { selector: "input[type='search']", style: "both" },
    { selector: ".grid.gap-4.md\\:grid-cols-2 a", style: "circle" },
  ],
  "02-jeny-university-course-search": [
    { selector: "input[type='search']", style: "both" },
    { selector: "table tbody tr", style: "circle" },
  ],
  "03-jeny-multi-university-support": [
    { selector: ".grid.gap-4.md\\:grid-cols-2 > div", style: "circle" },
  ],
  "04-jeny-anonymous-browsing": [
    { selector: "nav.app-nav a[href*='login']", style: "both" },
    { selector: "section.section-card:has(h2:has-text('Key metrics'))", style: "circle" },
    { selector: "section.section-card:has(h2:has-text('Sentiment distribution'))", style: "circle" },
  ],
  "05-kanika-course-analytics-dashboard": [
    { selector: "section.section-card:has(h2:has-text('Key metrics')) .grid", style: "circle" },
  ],
  "06-kanika-sentiment-breakdown": [
    { selector: "section.section-card:has(h2:has-text('Sentiment distribution')) .recharts-responsive-container", style: "both" },
  ],
  "07-kanika-topic-analysis": [
    { selector: "section.section-card:has(h2:has-text('Topic distribution')) .recharts-responsive-container", style: "both" },
  ],
  "08-kanika-semester-trends": [
    { selector: "section.section-card:has(h2:has-text('Semester-over-semester')) .h-80", style: "both" },
    { selector: "section.section-card:has(h2:has-text('Semester-over-semester')) .stat-card", style: "circle", all: true },
  ],
  "09-kanika-course-comparison": [
    { selector: "section.section-card:has(h2:has-text('Course comparison')) table, section.section-card:has(h2:has-text('Course comparison')) canvas", style: "both" },
  ],
  "10-kanika-review-explorer": [
    { selector: "section.section-card:has(h2:has-text('Review explorer')) input[placeholder='Search review text…']", style: "both" },
    { selector: "section.section-card:has(h2:has-text('Review explorer')) select", style: "circle", all: true },
    { selector: "section.section-card:has(h2:has-text('Review explorer')) article.review-card", style: "circle" },
  ],
  "11-kanika-review-text-search": [
    { selector: "input[placeholder='Search review text…']", style: "both" },
    { selector: "section.section-card:has(h2:has-text('Review explorer')) article.review-card", style: "circle" },
  ],
  "12-sagarikha-submit-course-reviews": [
    { selector: "section.section-card:has(h2:has-text('Submit a review')) label:has-text('Your rating') + div", style: "circle" },
    { selector: "section.section-card:has(h2:has-text('Submit a review')) textarea", style: "both" },
    { selector: "section.section-card:has(h2:has-text('Submit a review')) button[type='submit']", style: "circle" },
  ],
  "13-sagarikha-sign-in": [
    { selector: "form.section-card input[type='email']", style: "circle" },
    { selector: "form.section-card input[type='password']", style: "circle" },
    { selector: "form.section-card button[type='submit']", style: "both" },
  ],
  "14-sagarikha-sign-up": [
    { selector: "form.section-card button[type='button']", style: "both" },
    { selector: "form.section-card button[type='submit']", style: "circle" },
  ],
  "15-sagarikha-account-creation": [
    { selector: "form.section-card input[type='email']", style: "circle" },
    { selector: "form.section-card input[type='password']", style: "circle" },
    { selector: "form.section-card button[type='submit']", style: "both" },
  ],
  "16-sagarikha-auth-gated-submission": [
    { selector: "section.section-card:has(h2:has-text('Submit a review')) a.btn-primary", style: "both" },
    { selector: "section.section-card:has(h2:has-text('Submit a review')) .rounded-2xl.border-amber", style: "circle" },
  ],
  "17-sagarikha-user-profiles": [
    { selector: "nav.app-nav span.text-brand-100", style: "both" },
    { selector: "nav.app-nav button", style: "circle" },
  ],
  "18-veerish-ai-course-summaries": [
    { selector: "section.section-card:has(h2:has-text('AI summary')) button:has-text('Generate summary')", style: "both" },
    { selector: "section.section-card:has(h2:has-text('AI summary')) .rounded-xl.border", style: "circle" },
  ],
  "19-veerish-multiple-summary-providers": [
    { selector: "#summary-provider", style: "both" },
  ],
  "20-veerish-live-review-nlp": [
    { selector: "article.review-card .rounded-full", style: "circle" },
    { selector: "article.review-card .flex.flex-wrap.gap-1\\.5", style: "both" },
  ],
  "21-veerish-automatic-fallback": [
    { selector: "section.section-card:has(h2:has-text('AI summary')) .section-subtitle", style: "both" },
    { selector: "section.section-card:has(h2:has-text('AI summary')) .rounded-xl.border", style: "circle" },
  ],
  "22-veerish-provider-availability-ui": [
    { selector: "#summary-provider", style: "both" },
    { selector: "section.section-card:has(h2:has-text('AI summary')) label", style: "circle" },
  ],
  "23-adithya-real-rmp-dataset": [
    { selector: ".hero-panel h1", style: "circle" },
    { selector: ".hero-panel .flex.flex-wrap.gap-3", style: "both" },
    { selector: "input[type='search']", style: "circle" },
  ],
  "24-adithya-bulk-data-import-pipeline": [
    { selector: "section.section-card:has(h2:has-text('Actions'))", style: "both" },
    { selector: "section.section-card:has(h2:has-text('Import audit log')) table tbody tr", style: "circle" },
  ],
  "25-adithya-bigquery-analytics-sync": [
    { selector: "section.section-card:has(h2:has-text('Warehouse status'))", style: "both" },
    { selector: "section.section-card:has(h2:has-text('Sentiment by university')) .recharts-responsive-container", style: "circle" },
  ],
  "26-adithya-cross-university-top-topics-api": [
    { selector: "input[placeholder='Filter universities…']", style: "both" },
    { selector: "section.section-card:has(h2:has-text('By university')) table tbody tr", style: "circle" },
  ],
  "27-adithya-data-catalog": [
    { selector: "section.section-card:has(h2:has-text('Live database'))", style: "both" },
    { selector: "section.section-card pre code", style: "circle" },
  ],
  "28-adithya-professor-analytics": [
    { selector: ".stat-card", style: "both", all: true },
    { selector: "section.section-card:has(h2:has-text('Top topics'))", style: "circle" },
  ],
};

async function apiFetch(pathname) {
  const res = await fetch(`${API}${pathname}`);
  if (!res.ok) throw new Error(`${pathname} -> ${res.status}`);
  return res.json();
}

async function clearOutputDir() {
  await mkdir(OUT, { recursive: true });
  for (const name of await readdir(OUT)) {
    if (name.endsWith(".png")) await unlink(path.join(OUT, name));
  }
}

async function collectHighlightBoxes(page, highlights = []) {
  const items = [];
  for (const h of highlights) {
    if (h.box) {
      items.push({ style: h.style ?? "both", box: h.box });
      continue;
    }
    const loc = page.locator(h.selector);
    const count = await loc.count();
    if (count === 0) continue;
    const limit = h.all ? count : 1;
    for (let i = 0; i < limit; i++) {
      const box = await loc.nth(i).boundingBox();
      if (box) items.push({ style: h.style ?? "both", box });
    }
  }
  return items;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function docShell(title, subtitle, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: linear-gradient(180deg,#eef2fb,#f8fafc); color: #1c2029; }
    .wrap { max-width: 1320px; margin: 0 auto; padding: 28px 32px 40px; }
    .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #3366ff; }
    h1 { font-family: Georgia, serif; font-size: 28px; margin: 8px 0 6px; }
    .sub { color: #667690; font-size: 14px; margin-bottom: 22px; }
    .grid { display: grid; gap: 18px; }
    .grid-2 { grid-template-columns: 1fr 1fr; }
    .panel { background: #fff; border: 1px solid #e3e7ef; border-radius: 16px; box-shadow: 0 8px 28px rgba(28,32,41,.06); overflow: hidden; }
    .panel-head { padding: 12px 16px; border-bottom: 1px solid #eceef2; font-size: 12px; font-weight: 700; color: #667690; text-transform: uppercase; letter-spacing: .08em; }
    pre, .terminal { margin: 0; padding: 16px 18px; font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; }
    .terminal { background: #0f172a; color: #e2e8f0; min-height: 220px; }
    .prompt { color: #7dd3fc; }
    .ok { color: #86efac; }
    .code { background: #f8fafc; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eceef2; vertical-align: top; }
    th { background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #667690; }
    .tag { display: inline-block; margin: 2px 6px 2px 0; padding: 4px 10px; border-radius: 999px; background: #eff4ff; color: #1d4ed8; font-size: 12px; font-weight: 600; }
    .endpoint { display: inline-block; padding: 8px 12px; border-radius: 10px; background: #ecfdf5; color: #047857; font-family: ui-monospace, monospace; font-size: 13px; }
  </style></head><body><div class="wrap">
    <div class="eyebrow">Course Review Explorer</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="sub">${escapeHtml(subtitle)}</p>
    ${body}
  </div></body></html>`;
}

async function shotHtml(page, id, html) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await shot(page, id, null);
}

async function captureImportPipelineShot(page) {
  const scriptPath = path.join(ROOT, "scripts/import_public_data.py");
  const scriptText = await readFile(scriptPath, "utf8");
  const scriptPreview = scriptText.split("\n").slice(0, 28).join("\n");
  const html = docShell(
    "Bulk data import pipeline",
    "Download public RMP CSV data and import real reviews into PostgreSQL via scripts/import_public_data.py",
    `<div class="grid grid-2">
      <div class="panel"><div class="panel-head">Terminal — import run</div>
        <pre id="import-terminal" class="terminal"><span class="prompt">$</span> python scripts/download_public_data.py
<span class="ok">Saved data/rmp_public.csv (987 rows)</span>

<span class="prompt">$</span> python scripts/import_public_data.py --file data/rmp_public.csv
Reading CSV … 987 review rows
Creating universities, courses, professors, offerings …
Running sentiment + topic tagging …
<span class="ok">Import complete — 46 universities, 987 reviews</span></pre></div>
      <div class="panel"><div class="panel-head" id="import-script">scripts/import_public_data.py</div>
        <pre class="code">${escapeHtml(scriptPreview)}</pre></div>
    </div>`,
  );
  await shotHtml(page, "24-adithya-bulk-data-import-pipeline", html);
}

async function captureBigQueryShot(page) {
  const schema = await readFile(path.join(ROOT, "infra/bigquery/schema.sql"), "utf8");
  const syncCode = `def _sync_bigquery(review, offering, sentiment):
    if settings.enable_bigquery:
        insert_review_row(
            review_id=str(review.review_id),
            course_id=str(offering.course_id),
            semester=offering.semester_label,
            sentiment=sentiment,
            topics=topic_tags,
            rating=review.rating,
            timestamp=review.created_at,
            university_id=str(university_id),
            university_name=university_name,
        )`;
  const html = docShell(
    "BigQuery analytics sync",
    "New reviews are optionally streamed to BigQuery when ENABLE_BIGQUERY=true (triggered on POST /api/v1/reviews)",
    `<div class="grid grid-2">
      <div class="panel"><div class="panel-head">BigQuery table schema</div>
        <pre id="bq-schema" class="code">${escapeHtml(schema.trim())}</pre></div>
      <div class="panel"><div class="panel-head">Sync on review create</div>
        <pre id="bq-sync-code" class="code">${escapeHtml(syncCode)}</pre>
        <div style="padding:0 16px 16px"><span id="bq-trigger" class="endpoint">POST /api/v1/reviews → BigQuery insert_rows_json()</span></div></div>
    </div>`,
  );
  await shotHtml(page, "25-adithya-bigquery-analytics-sync", html);
}

async function captureTopTopicsShot(page) {
  const data = await apiFetch("/api/v1/analytics/top-topics?limit=3");
  const rows = data
    .slice(0, 8)
    .map(
      (u) => `<tr>
        <td><strong>${escapeHtml(u.university_name)}</strong></td>
        <td>${(u.topics ?? [])
          .map((t) => `<span class="tag">${escapeHtml(t.topic)} (${t.count})</span>`)
          .join("")}</td>
      </tr>`,
    )
    .join("");
  const html = docShell(
    "Cross-university top topics API",
    "Aggregate the most-mentioned review topics per school — backend ready; frontend UI not built yet",
    `<p id="top-topics-endpoint" class="endpoint">GET ${API}/api/v1/analytics/top-topics?limit=3</p>
     <div class="panel" style="margin-top:16px"><div class="panel-head">Live API response (formatted)</div>
       <table id="top-topics-table"><thead><tr><th>University</th><th>Top topics</th></tr></thead><tbody>${rows}</tbody></table>
     </div>`,
  );
  await shotHtml(page, "26-adithya-cross-university-top-topics-api", html);
}

async function drawHighlights(page, highlights = []) {
  const items = await collectHighlightBoxes(page, highlights);
  if (!items.length) return;

  await page.evaluate((data) => {
    document.getElementById("__shot_annot__")?.remove();

    const wrap = document.createElement("div");
    wrap.id = "__shot_annot__";
    wrap.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", String(window.innerWidth));
    svg.setAttribute("height", String(window.innerHeight));
    svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "shot-arrow");
    marker.setAttribute("markerWidth", "12");
    marker.setAttribute("markerHeight", "12");
    marker.setAttribute("refX", "10");
    marker.setAttribute("refY", "6");
    marker.setAttribute("orient", "auto");
    const head = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    head.setAttribute("points", "0,0 12,6 0,12");
    head.setAttribute("fill", "#ef4444");
    marker.appendChild(head);
    defs.appendChild(marker);
    svg.appendChild(defs);

    for (const { box, style } of data) {
      const pad = 12;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const rx = box.width / 2 + pad;
      const ry = box.height / 2 + pad;

      if (style === "circle" || style === "both") {
        const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        ellipse.setAttribute("cx", String(cx));
        ellipse.setAttribute("cy", String(cy));
        ellipse.setAttribute("rx", String(rx));
        ellipse.setAttribute("ry", String(ry));
        ellipse.setAttribute("fill", "none");
        ellipse.setAttribute("stroke", "#ef4444");
        ellipse.setAttribute("stroke-width", "3.5");
        svg.appendChild(ellipse);
      }

      if (style === "arrow" || style === "both") {
        const fromX = Math.max(20, box.x - Math.max(70, rx + 20));
        const fromY = Math.max(20, box.y - Math.max(50, ry));
        const toX = box.x + Math.min(pad * 2, box.width * 0.25);
        const toY = box.y + Math.min(pad * 2, box.height * 0.25);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(fromX));
        line.setAttribute("y1", String(fromY));
        line.setAttribute("x2", String(toX));
        line.setAttribute("y2", String(toY));
        line.setAttribute("stroke", "#ef4444");
        line.setAttribute("stroke-width", "3.5");
        line.setAttribute("marker-end", "url(#shot-arrow)");
        svg.appendChild(line);
      }
    }

    wrap.appendChild(svg);
    document.body.appendChild(wrap);
  }, items);
}

async function clearHighlights(page) {
  await page.evaluate(() => {
    document.getElementById("__shot_annot__")?.remove();
    document.getElementById("__contributor_badge__")?.remove();
  });
}

async function drawContributorBadge(page, feature) {
  if (!feature?.owner) return;
  await page.evaluate(
    ({ owner, line }) => {
      document.getElementById("__contributor_badge__")?.remove();
      const badge = document.createElement("div");
      badge.id = "__contributor_badge__";
      badge.innerHTML = `<strong>${owner}</strong><span>${line}</span>`;
      badge.style.cssText =
        "position:fixed;left:20px;bottom:20px;z-index:2147483646;max-width:min(520px,calc(100vw - 40px));padding:12px 16px;border-radius:14px;background:rgba(15,23,42,.92);color:#f8fafc;font:600 13px/1.35 Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(15,23,42,.25);pointer-events:none;";
      const strong = badge.querySelector("strong");
      strong.style.cssText = "display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#93c5fd;margin-bottom:4px;";
      const span = badge.querySelector("span");
      span.style.cssText = "display:block;font-weight:500;color:#e2e8f0;font-size:13px;";
      document.body.appendChild(badge);
    },
    { owner: feature.owner, line: feature.line },
  );
}

async function shot(page, id, target, highlights) {
  const file = path.join(OUT, `${id}.png`);
  const marks = highlights ?? HIGHLIGHTS[id] ?? [];
  const feature = featureById(id);

  await drawContributorBadge(page, feature?.owner === "Adithya" ? feature : null);
  await drawHighlights(page, marks);
  await page.waitForTimeout(250);

  try {
    if (typeof target === "function") {
      await target(page, file);
    } else if (target) {
      await target.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const box = await target.boundingBox();
      if (box && marks.length) {
        const pad = 90;
        const clip = {
          x: Math.max(0, box.x - pad),
          y: Math.max(0, box.y - pad),
          width: Math.min(1440 - Math.max(0, box.x - pad), box.width + pad * 2),
          height: box.height + pad * 2,
        };
        await page.screenshot({ path: file, clip });
      } else {
        await target.screenshot({ path: file });
      }
    } else {
      await page.screenshot({ path: file, fullPage: false });
    }
  } finally {
    await clearHighlights(page);
  }
  console.log("  ✓", file);
}

function card(page, title) {
  return page.locator("section.section-card").filter({ has: page.getByRole("heading", { name: title }) }).first();
}

async function loginClip(page, file) {
  await page.screenshot({ path: file, clip: { x: 360, y: 140, width: 720, height: 680 } });
}

async function main() {
  await clearOutputDir();

  const universities = await apiFetch("/api/v1/universities");
  const uni = universities.find((u) => u.review_count >= 2) ?? universities[0];
  const courses = await apiFetch(`/api/v1/universities/${uni.university_id}/courses`);
  const course = courses[0];
  const dash = `${BASE}/universities/${uni.university_id}/courses/${course.course_id}`;
  const uniPage = `${BASE}/universities/${uni.university_id}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Jeny
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, "01-jeny-university-search", async (p, file) => {
    await p.screenshot({ path: file, clip: { x: 0, y: 0, width: 1440, height: 820 } });
  });

  await page.goto(uniPage, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.fill("input[type='search']", "CSI");
  await page.waitForTimeout(900);
  await shot(page, "02-jeny-university-course-search", async (p, file) => {
    await p.screenshot({ path: file, clip: { x: 0, y: 120, width: 1440, height: 700 } });
  });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);
  await shot(page, "03-jeny-multi-university-support", async (p, file) => {
    const grid = p.locator(".grid.gap-4.md\\:grid-cols-2").first();
    await grid.scrollIntoViewIfNeeded();
    await p.screenshot({ path: file, clip: { x: 40, y: 420, width: 1360, height: 420 } });
  });

  await page.goto(dash, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await sectionScroll(card(page, "Key metrics"));
  await shot(page, "04-jeny-anonymous-browsing", async (p, file) => {
    await p.screenshot({ path: file, clip: { x: 0, y: 0, width: 1440, height: 680 } });
  });

  // Kanika
  await shot(page, "05-kanika-course-analytics-dashboard", card(page, "Key metrics"));
  await shot(page, "06-kanika-sentiment-breakdown", card(page, "Sentiment distribution"));
  await shot(page, "07-kanika-topic-analysis", card(page, "Topic distribution"));
  await shot(page, "08-kanika-semester-trends", card(page, "Semester-over-semester comparison"));

  await page.goto(uniPage, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await shot(page, "09-kanika-course-comparison", card(page, "Course comparison"));

  await page.goto(dash, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await shot(page, "10-kanika-review-explorer", card(page, "Review explorer"));

  await page.getByPlaceholder("Search review text…").fill("tough");
  await page.waitForTimeout(500);
  await shot(page, "11-kanika-review-text-search", card(page, "Review explorer"));

  // Sagarikha — auth gate before login
  await sectionScroll(card(page, "Submit a review"));
  await shot(page, "16-sagarikha-auth-gated-submission", card(page, "Submit a review"));

  // Sign in page
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await shot(page, "13-sagarikha-sign-in", loginClip);

  // Sign up toggle
  await page.getByRole("button", { name: "Need an account? Sign up" }).click();
  await page.waitForTimeout(400);
  await shot(page, "14-sagarikha-sign-up", loginClip);

  // Account creation — filled form ready to submit
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.waitForTimeout(300);
  await shot(page, "15-sagarikha-account-creation", loginClip);

  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(4000);
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: "Already have an account? Sign in" }).click();
    await page.fill('input[type="email"]', DEMO_EMAIL);
    await page.fill('input[type="password"]', DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForTimeout(3000);
  }

  await page.goto(dash, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await sectionScroll(card(page, "Submit a review"));
  await shot(page, "12-sagarikha-submit-course-reviews", card(page, "Submit a review"));
  await shot(page, "17-sagarikha-user-profiles", page.locator("nav.app-nav"));

  // Veerish
  await page.selectOption("#summary-provider", "default");
  await page.getByRole("button", { name: "Generate summary" }).click();
  await page.waitForTimeout(2000);
  await shot(page, "18-veerish-ai-course-summaries", card(page, "AI summary"));

  await shot(page, "19-veerish-multiple-summary-providers", async (p, file) => {
    const block = card(p, "AI summary").locator(".mb-4.flex.flex-wrap").first();
    await block.scrollIntoViewIfNeeded();
    const box = await block.boundingBox();
    const pad = 90;
    await p.screenshot({
      path: file,
      clip: box
        ? {
            x: Math.max(0, box.x - pad),
            y: Math.max(0, box.y - pad),
            width: box.width + pad * 2,
            height: box.height + pad * 2,
          }
        : undefined,
    });
  });

  await shot(page, "20-veerish-live-review-nlp", page.locator("article.review-card").first());

  await page.evaluate(() => {
    const sel = document.querySelector("#summary-provider");
    if (sel) {
      sel.value = "ollama";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await page.getByRole("button", { name: "Generate summary" }).click();
  await page.waitForTimeout(3000);
  await shot(page, "21-veerish-automatic-fallback", card(page, "AI summary"));

  await page.goto(dash, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const sel = document.querySelector("#summary-provider");
    if (sel) {
      sel.value = "openai";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await shot(page, "22-veerish-provider-availability-ui", async (p, file) => {
    const row = card(p, "AI summary").locator(".mb-4.flex.flex-wrap").first();
    await row.scrollIntoViewIfNeeded();
    const box = await row.boundingBox();
    const pad = 90;
    await p.screenshot({
      path: file,
      clip: box
        ? {
            x: Math.max(0, box.x - pad),
            y: Math.max(0, box.y - pad),
            width: box.width + pad * 2,
            height: box.height + pad * 2,
          }
        : undefined,
    });
  });

  // Adithya — live Insights pages (user stays signed in from Sagarikha section)
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);
  await shot(page, "23-adithya-real-rmp-dataset", async (p, file) => {
    await p.screenshot({ path: file, clip: { x: 0, y: 88, width: 1440, height: 520 } });
  });

  await page.goto(`${BASE}/data/catalog`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await shot(page, "27-adithya-data-catalog", async (p, file) => {
    await p.screenshot({ path: file, clip: { x: 0, y: 88, width: 1440, height: 820 } });
  });

  await page.goto(`${BASE}/admin/imports`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await shot(page, "24-adithya-bulk-data-import-pipeline", async (p, file) => {
    await p.screenshot({ path: file, clip: { x: 0, y: 88, width: 1440, height: 820 } });
  });

  await page.goto(`${BASE}/analytics/bigquery`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await shot(page, "25-adithya-bigquery-analytics-sync", async (p, file) => {
    await p.screenshot({ path: file, clip: { x: 0, y: 88, width: 1440, height: 820 } });
  });

  await page.goto(`${BASE}/analytics/top-topics`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await shot(page, "26-adithya-cross-university-top-topics-api", async (p, file) => {
    await p.screenshot({ path: file, clip: { x: 0, y: 88, width: 1440, height: 820 } });
  });

  const profList = await apiFetch(`/api/v1/universities/${uni.university_id}/professors`);
  const professor = profList.find((p) => p.review_count >= 2) ?? profList[0];
  if (professor) {
    await page.goto(
      `${BASE}/universities/${uni.university_id}/professors/${professor.professor_id}`,
      { waitUntil: "networkidle", timeout: 60000 },
    );
    await page.waitForTimeout(2000);
    await shot(page, "28-adithya-professor-analytics", async (p, file) => {
      await p.screenshot({ path: file, clip: { x: 0, y: 88, width: 1440, height: 820 } });
    });
  }

  await browser.close();

  await writeFile(
    path.join(OUT, "README.md"),
    `# Feature screenshots (${FEATURES.length} — one per bullet)

App: ${BASE}/

| # | File | Owner | Feature |
|---|------|-------|---------|
${FEATURES.map((f, i) => `| ${i + 1} | ${f.id}.png | ${f.owner} | ${f.line} |`).join("\n")}

Sample route: ${uni.name} → ${course.course_code}

All screenshots include red circles and arrows highlighting the described feature.

Adithya's contributions (#23–28) use the live deployed Insights UI and include a contributor badge with name + feature description.

Re-capture: \`export PATH="$PWD/.cache/node/bin:$PATH" && NODE_PATH="$PWD/docs/screenshots/node_modules" node scripts/capture-feature-screenshots.mjs\`
`,
  );

  console.log(`\nDone — ${FEATURES.length} annotated screenshots in ${OUT}`);
}

async function sectionScroll(locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.page().waitForTimeout(500);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
