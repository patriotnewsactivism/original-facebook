#!/usr/bin/env node
/**
 * Build a client-side search index for a static Facebook-style backup.
 *
 * Usage: node scripts/build-index.js /path/to/site-root
 *
 * This script walks the provided directory for HTML files, extracts
 * meaningful content (title, body text, publication date, etc.) and
 * produces a JSON index file that can be consumed by the client-side
 * search UI (Fuse.js). See README for details on customizing the
 * extraction logic.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Determine the root of the site to index. If no argument is given,
// default to the current working directory. Resolve to an absolute path.
const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const OUT_DIR = path.join(ROOT, 'data');
const OUT_FILE = path.join(OUT_DIR, 'search-index.json');

// Only HTML/HTM files are considered for indexing.
const VALID_EXT = new Set(['.html', '.htm']);

// Heuristics for guessing the type of content based on file path or
// extracted text. Extend this list if you have additional categories.
const TYPE_RULES = [
  { key: 'photo',  tests: [/photo|image|album/i] },
  { key: 'video',  tests: [/video/i] },
  { key: 'status', tests: [/status|post|timeline/i] },
  { key: 'link',   tests: [/shared.*link|external/i] },
];

// Recursively walk a directory and return a flat list of file paths.
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (VALID_EXT.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

// Guess a content type for an extracted record using the TYPE_RULES.
function guessType({ filepath, title, text }) {
  const hay = `${filepath}\n${title}\n${text}`.slice(0, 2000);
  for (const rule of TYPE_RULES) if (rule.tests.some(rx => rx.test(hay))) return rule.key;
  return 'post';
}

// Attempt to extract a publication date from the document using common
// selectors. If a datetime attribute is found, return it as-is. If a
// human-readable timestamp exists, try to parse it into ISO format.
function extractDate(doc) {
  const t = doc.querySelector('time[datetime]')?.getAttribute('datetime');
  if (t) return t;
  const meta = doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content');
  if (meta) return meta;
  const ts = doc.querySelector('.timestamp, .date, .meta')?.textContent?.trim();
  if (ts) return ts;
  return null;
}

// Normalize a date string into ISO 8601 format. If parsing fails, return
// null so the consumer can handle missing dates gracefully.
function normalizeDate(s) {
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString();
  const tryNum = Date.parse(s.replace(/\bat\b/i, '').trim());
  return isNaN(tryNum) ? null : new Date(tryNum).toISOString();
}

// Extract meaningful metadata from an HTML file. The return value is
// consumed by the search UI. You may wish to extend this function to
// capture additional metadata, such as author names or tags.
function extract(doc, filepath, root) {
  const title = (doc.querySelector('title')?.textContent || '').trim();
  const contentNode =
    doc.querySelector('#content, main, article, .userContent, .content, .post, .story_body_container') || doc.body;
  const text = contentNode.textContent.replace(/\s+/g, ' ').trim();
  const dateRaw = extractDate(doc);
  const date = normalizeDate(dateRaw);
  const img =
    doc.querySelector('img')?.getAttribute('src') ||
    doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;
  const url = '/' + path.relative(root, filepath).replace(/\\/g, '/');
  const type = guessType({ filepath, title, text });
  return { id: url, url, title, text, date, year: date ? new Date(date).getFullYear() : null, type, img };
}

// Parse a single HTML file into a record using JSDOM. Catch and report
// parse errors so the build continues on malformed files.
function parseFile(file, root) {
  const html = fs.readFileSync(file, 'utf8');
  const dom = new JSDOM(html);
  return extract(dom.window.document, file, root);
}

function main() {
  console.log(`Scanning ${ROOT} ...`);
  const files = walk(ROOT).filter(f =>
    !f.includes('/data/search-index.json') &&
    !f.includes('/assets/') &&
    !f.endsWith('/service-worker.js')
  );

  const items = [];
  for (const f of files) {
    try {
      const rec = parseFile(f, ROOT);
      if (rec.text && rec.text.length > 40) items.push(rec);
    } catch (e) {
      console.warn('Skip (parse error):', f, e.message);
    }
  }
  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: items.length,
    items
  }, null, 2));
  console.log(`Wrote ${OUT_FILE} with ${items.length} items.`);
}

main();
