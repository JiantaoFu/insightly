// Pure helpers for netlify/edge-functions/prerender.ts.
//
// Plain ESM with no dependencies, so the same file runs in Netlify's Deno edge
// runtime and in Node (see prerender-core.test.mjs). Everything that ends up in
// HTML goes through esc() or mdToHtml(); mdToHtml() escapes input first, then
// adds a small set of tags itself, so report text can't inject markup.

export const SITE = 'https://insightly.top';

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// JSON that is safe to put inside <script type="application/json">.
export function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// Same rule as getSummary() in src/components/ShareReportView.tsx, so the
// server-sent description matches what the SPA sets after it loads: whole
// sentences up to ~155 chars. Sentences end at . ! ? followed by whitespace,
// so "68.4%" or "v7.4" don't cut a sentence in half.
export function extractSummary(markdown) {
  const clean = String(markdown || '')
    .replace(/#{1,6}\s?[^\n]+\n*/g, '')
    .replace(/\*\*/g, '')
    .replace(/Summary of Key Insights\s*\n+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = clean.replace(/([.!?])\s+/g, '$1\u0000').split('\u0000');
  let summary = '';
  for (const s of sentences) {
    const next = summary ? `${summary} ${s}` : s;
    if (next.length > 155) break;
    summary = next;
  }
  if (!summary && clean) {
    // First sentence alone is too long: cut at a word boundary.
    summary = clean.slice(0, 152).replace(/\s+\S*$/, '') + '…';
  }
  return summary.trim();
}

// Same split as the useMemo in ShareReportView.tsx: the first paragraph of
// "Summary of Key Insights" becomes the TL;DR card, the rest is the body.
export function splitReport(report) {
  const text = String(report || '');
  const headerRe = /^#{1,6}\s+Summary of Key Insights\s*$/m;
  const match = headerRe.exec(text);
  if (!match) return { tldr: '', body: text };
  const start = match.index + match[0].length;
  const nextHeader = /^#{1,6}\s+/m.exec(text.slice(start));
  const end = nextHeader ? start + nextHeader.index : text.length;
  const section = text.slice(start, end);
  const tldr = (section.trim().split(/\n\s*\n/)[0] || '').replace(/\*\*/g, '').trim();
  const body = (text.slice(0, match.index) + text.slice(end)).trim();
  return { tldr, body };
}

function inline(s) {
  // s is already escaped
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

// Minimal Markdown -> HTML for AI reports: headings (demoted one level so the
// page keeps a single <h1>), nested bullet/numbered lists, paragraphs, hr,
// bold/italic/code, and pipe tables. Unknown syntax degrades to text.
export function mdToHtml(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const listStack = []; // [{type, indent}]
  let para = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(esc(para.join(' ')))}</p>`);
      para = [];
    }
  };
  const closeLists = (toIndent = -1) => {
    while (listStack.length && listStack[listStack.length - 1].indent > toIndent) {
      out.push(`</li></${listStack.pop().type}>`);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flushPara(); continue; }

    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      flushPara(); closeLists();
      const level = Math.min(h[1].length + 1, 6);
      out.push(`<h${level}>${inline(esc(h[2]))}</h${level}>`);
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushPara(); closeLists();
      out.push('<hr>');
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      flushPara(); closeLists();
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(esc(c.trim())));
      const head = cells(line);
      i += 1;
      const rows = [];
      while (i + 1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[i + 1])) rows.push(cells(lines[++i]));
      out.push('<table><thead><tr>' + head.map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
        rows.map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      flushPara();
      const indent = li[1].replace(/\t/g, '  ').length;
      const type = /\d/.test(li[2]) ? 'ol' : 'ul';
      const top = listStack[listStack.length - 1];
      if (!top || indent > top.indent) {
        out.push(`<${type}><li>`);
        listStack.push({ type, indent });
      } else {
        closeLists(indent);
        const cur = listStack[listStack.length - 1];
        if (cur && cur.indent === indent && cur.type === type) {
          out.push('</li><li>');
        } else {
          if (cur && cur.indent === indent) out.push(`</li></${listStack.pop().type}>`);
          out.push(`<${type}><li>`);
          listStack.push({ type, indent });
        }
      }
      out.push(inline(esc(li[3])));
      continue;
    }
    if (listStack.length && /^\s+/.test(line)) {
      // continuation line of a list item
      out.push(' ' + inline(esc(line.trim())));
      continue;
    }
    closeLists();
    para.push(line.trim());
  }
  flushPara(); closeLists();
  return out.join('\n');
}

export function ratingStats(reviews) {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const r of Array.isArray(reviews) ? reviews : []) {
    const s = Math.round(Number(r && r.score) || 0);
    if (s >= 1 && s <= 5) counts[s] += 1;
  }
  const total = counts.reduce((a, b) => a + b, 0);
  const weighted = counts.reduce((a, c, s) => a + c * s, 0);
  const avg = total ? weighted / total : 0;
  const sentiment = avg >= 4 ? 'Positive' : avg >= 3 ? 'Mixed' : avg > 0 ? 'Negative' : '';
  return { counts, total, avg, sentiment };
}

const PLATFORM = { ios: 'App Store', android: 'Google Play' };

// ---------------------------------------------------------------- head ----

function setTag(html, re, tag) {
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function metaRe(attr, name) {
  return new RegExp(`<meta\\s+${attr}="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+content="[^"]*"\\s*/?>`, 'i');
}

/**
 * Rewrite the page-level <head> tags of the SPA shell.
 * meta: { title, description, canonical, image?, imageAlt?, ogType?, twitterCard?, jsonLd? }
 */
export function applyHead(html, meta) {
  const t = esc(meta.title);
  const d = esc(meta.description);
  const c = esc(meta.canonical);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${t}</title>`);
  html = setTag(html, metaRe('name', 'title'), `<meta name="title" content="${t}">`);
  html = setTag(html, metaRe('name', 'description'), `<meta name="description" content="${d}">`);
  html = setTag(html, /<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${c}">`);
  html = setTag(html, metaRe('property', 'og:type'), `<meta property="og:type" content="${esc(meta.ogType || 'website')}">`);
  html = setTag(html, metaRe('property', 'og:url'), `<meta property="og:url" content="${c}">`);
  html = setTag(html, metaRe('property', 'og:title'), `<meta property="og:title" content="${t}">`);
  html = setTag(html, metaRe('property', 'og:description'), `<meta property="og:description" content="${d}">`);
  html = setTag(html, metaRe('name', 'twitter:url'), `<meta name="twitter:url" content="${c}">`);
  html = setTag(html, metaRe('name', 'twitter:title'), `<meta name="twitter:title" content="${t}">`);
  html = setTag(html, metaRe('name', 'twitter:description'), `<meta name="twitter:description" content="${d}">`);
  if (meta.image) {
    const img = esc(meta.image);
    const alt = esc(meta.imageAlt || meta.title);
    html = setTag(html, metaRe('property', 'og:image'), `<meta property="og:image" content="${img}">`);
    html = setTag(html, metaRe('property', 'og:image:alt'), `<meta property="og:image:alt" content="${alt}">`);
    html = setTag(html, metaRe('name', 'twitter:image'), `<meta name="twitter:image" content="${img}">`);
    html = setTag(html, metaRe('name', 'twitter:image:alt'), `<meta name="twitter:image:alt" content="${alt}">`);
    // The shell's 1200x630 dimensions describe og-image.png only.
    html = html.replace(metaRe('property', 'og:image:width'), '').replace(metaRe('property', 'og:image:height'), '');
  }
  if (meta.twitterCard) {
    html = setTag(html, metaRe('name', 'twitter:card'), `<meta name="twitter:card" content="${esc(meta.twitterCard)}">`);
  }
  if (meta.jsonLd !== undefined) {
    // The shell's JSON-LD describes the home page (WebApplication); replace or drop it.
    const ld = meta.jsonLd ? `<script type="application/ld+json">${jsonForScript(meta.jsonLd)}</script>` : '';
    html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, ld);
  }
  return html;
}

// ---------------------------------------------------------------- body ----

const MAIN_RE = /<!--prerender:main:start-->[\s\S]*?<!--prerender:main:end-->/;

export function hasMainMarkers(html) {
  return MAIN_RE.test(html);
}

/** Replace the skeleton <main> (between the markers in index.html) and add page CSS + data. */
export function applyBody(html, { main, css = '', data = null }) {
  html = html.replace(MAIN_RE, `<!--prerender:main:start-->\n${main}\n        <!--prerender:main:end-->`);
  if (css) html = html.replace('</head>', `    <style id="ipr-style">${css}</style>\n  </head>`);
  if (data) {
    const script = `<script type="application/json" id="__INSIGHTLY_DATA__">${jsonForScript(data)}</script>`;
    html = html.replace('<div id="root">', `${script}\n    <div id="root">`);
  }
  return html;
}

// Styles for prerendered report / list pages. Scoped to .ipr*, mirrors the
// Tailwind classes the React views use so the swap to React barely moves.
export const PAGE_CSS = [
  'body{background:#fff}',
  '.ipr{max-width:56rem;margin:0 auto;padding:6rem 1rem 2rem;color:#111827}',
  '.ipr-wide{max-width:80rem}',
  '.ipr-card{background:#fff;border:1px solid #F3F4F6;border-radius:1rem;box-shadow:0 1px 2px rgba(0,0,0,.05);padding:1.5rem;margin-bottom:1.5rem}',
  '.ipr-head{display:flex;align-items:center;gap:1.25rem}',
  '.ipr-head img,.ipr-ph{width:5rem;height:5rem;border-radius:1rem;object-fit:cover;flex-shrink:0;background:#E0E7FF}',
  '.ipr h1{margin:0;font-size:1.5rem;line-height:2rem;font-weight:800}',
  '.ipr-meta{margin-top:.25rem;display:flex;flex-wrap:wrap;gap:.25rem .75rem;font-size:.875rem;color:#6B7280}',
  '.ipr-meta b{color:#374151}',
  '.ipr-pill{padding:.125rem .5rem;border-radius:9999px;font-size:.75rem;font-weight:600;background:#F3F4F6;color:#374151}',
  '.ipr-label{margin:0 0 .75rem;font-size:.875rem;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.025em}',
  '.ipr-bar{display:flex;align-items:center;gap:.5rem;font-size:.75rem;color:#4B5563;margin:.375rem 0}',
  '.ipr-bar span{width:1.5rem;text-align:right}.ipr-bar em{font-style:normal;width:2rem}',
  '.ipr-bar i{flex:1;height:.5rem;background:#E5E7EB;border-radius:9999px;overflow:hidden;display:block}',
  '.ipr-bar i b{display:block;height:100%}',
  '.ipr-tldr{background:#EEF2FF;border:1px solid #E0E7FF;border-radius:1rem;padding:1.5rem;margin-bottom:1.5rem;line-height:1.625}',
  '.ipr-tldr h2{margin:0 0 .5rem;font-size:.875rem;font-weight:700;color:#312E81;text-transform:uppercase;letter-spacing:.025em}',
  '.ipr-tldr p{margin:0;color:#1F2937}',
  '.ipr-body{font-size:.875rem;line-height:1.7;color:#374151;border-top:1px solid #E5E7EB;margin-top:2rem;padding-top:2rem}',
  '.ipr-body h2{font-size:1.25rem;color:#111827;margin:1.75rem 0 .75rem}.ipr-body h3,.ipr-body h4{font-size:1rem;color:#111827;margin:1.5rem 0 .5rem}',
  '.ipr-body p{margin:.75rem 0}.ipr-body ul{list-style:disc}.ipr-body ol{list-style:decimal}.ipr-body ul,.ipr-body ol{margin:.75rem 0;padding-left:1.5rem}.ipr-body strong{font-weight:600;color:#111827}.ipr-body li{margin:.25rem 0}.ipr-body hr{border:0;border-top:1px solid #E5E7EB;margin:2rem 0}',
  '.ipr-body table{border-collapse:collapse;width:100%;margin:1rem 0}.ipr-body th,.ipr-body td{border:1px solid #E5E7EB;padding:.375rem .5rem;text-align:left}',
  '.ipr-cta{margin:3rem 0 2rem;border-radius:1rem;padding:2rem;text-align:center;color:#fff;background:linear-gradient(90deg,#4F46E5,#9333EA)}',
  '.ipr-cta h2{margin:0 0 .5rem;font-size:1.5rem;font-weight:800}.ipr-cta p{margin:0 auto 1.5rem;max-width:36rem;color:#E0E7FF}',
  '.ipr-cta a{display:inline-block;margin:.25rem;padding:.75rem 1.5rem;border-radius:.5rem;font-weight:700}',
  '.ipr-cta a.w{background:#fff;color:#4338CA}.ipr-cta a.o{border:1px solid rgba(255,255,255,.4);color:#fff}',
  '.ipr-title{text-align:center;margin-bottom:2rem}.ipr-title h1{font-size:2.25rem;line-height:2.5rem;font-weight:700;color:#1F2937}',
  '.ipr-grid{display:grid;grid-template-columns:1fr;gap:1.5rem;list-style:none;padding:0;margin:0}',
  '@media (min-width:768px){.ipr-grid{grid-template-columns:repeat(2,1fr)}}@media (min-width:1024px){.ipr-grid{grid-template-columns:repeat(3,1fr)}}',
  '.ipr-grid li{border:1px solid #F3F4F6;border-radius:.75rem;box-shadow:0 1px 3px rgba(0,0,0,.08);padding:1rem}',
  '.ipr-grid a{display:flex;gap:.75rem;align-items:center;color:#111827;font-weight:600}',
  '.ipr-grid img{width:3rem;height:3rem;border-radius:.75rem}',
  '.ipr-grid p{margin:.5rem 0 0;font-size:.8125rem;color:#6B7280}',
  '.ipr-note{margin-top:3rem;text-align:center;color:#4B5563}',
  '.ipr-signin{display:grid;gap:2rem;align-items:center;padding:2rem}@media (min-width:768px){.ipr-signin{grid-template-columns:1fr 1fr}}',
  '.ipr-signin img{width:100%;height:auto;border-radius:.75rem}.ipr-signin p{color:#4B5563;font-size:.875rem}',
  '.isk .ipr-btn,.ipr-btn{display:block;margin-top:1.5rem;padding:.75rem 1.5rem;border-radius:.5rem;background:#2563EB;color:#fff;text-align:center;font-weight:600}',
  '.isk .ipr-lnk,.ipr-lnk{display:block;margin-top:1rem;text-align:center;color:#2563EB;font-size:.875rem;font-weight:500}.isk .ipr-muted{color:#6B7280}',
].join('');

const BAR_COLOR = { 5: '#22C55E', 4: '#22C55E', 3: '#EAB308', 2: '#EF4444', 1: '#EF4444' };

/** Main content for /shared-app-report/:id (mirrors SharedReportView). */
export function renderAppReportMain({ appDetails, report }) {
  const app = appDetails || {};
  const name = app.title || 'App Report';
  const { counts, total, avg, sentiment } = ratingStats(app.reviews);
  const { tldr, body } = splitReport(report);
  const platform = PLATFORM[app.platform] || '';
  const icon = app.icon
    ? `<img src="${esc(app.icon)}" alt="${esc(name)} icon" width="80" height="80">`
    : `<div class="ipr-ph"></div>`;
  const meta = [
    total ? `<b>★ ${avg.toFixed(1)}</b>` : '',
    total ? `<span>${total} reviews analyzed</span>` : '',
    sentiment ? `<span class="ipr-pill">${sentiment} sentiment</span>` : '',
    app.developer ? `<span>by ${esc(app.developer)}</span>` : '',
    platform ? `<span>${platform}</span>` : '',
  ].filter(Boolean).join('');
  const bars = total
    ? `<section class="ipr-card"><h2 class="ipr-label">Rating breakdown</h2>${[5, 4, 3, 2, 1]
        .map((s) => `<div class="ipr-bar"><span>${s}★</span><i><b style="width:${((counts[s] / total) * 100).toFixed(1)}%;background:${BAR_COLOR[s]}"></b></i><em>${counts[s]}</em></div>`)
        .join('')}</section>`
    : '';
  return `<main class="ipr" id="ipr-main" data-prerendered>
          <article>
            <header class="ipr-card ipr-head">${icon}<div><h1>${esc(name)}</h1><div class="ipr-meta">${meta}</div></div></header>
            ${bars}
            ${tldr ? `<section class="ipr-tldr"><h2>TL;DR</h2><p>${inline(esc(tldr))}</p></section>` : ''}
            <section class="ipr-body">${mdToHtml(body)}</section>
          </article>
          ${CTA}
        </main>`;
}

const CTA = `<aside class="ipr-cta"><h2>Want the same teardown for your app?</h2><p>Paste any App Store or Google Play link and get an AI report of user pain points, requested features, and startup opportunities — in minutes.</p><a class="w" href="/#pricing">Start for $1 →</a><a class="o" href="/app-insights">Browse 2,800+ free reports</a></aside>`;

/** Main content for /shared-competitor-report/:id. The API only returns { report }. */
export function renderCompetitorReportMain({ report, heading }) {
  return `<main class="ipr" id="ipr-main" data-prerendered>
          <article>
            <header class="ipr-card"><h1>${esc(heading)}</h1></header>
            <section class="ipr-body">${mdToHtml(report)}</section>
          </article>
          ${CTA}
        </main>`;
}

/** First markdown heading text, e.g. the comparison title. */
export function firstHeading(markdown) {
  const m = /^#{1,6}\s+(.+?)\s*#*\s*$/m.exec(String(markdown || ''));
  return m ? m[1].replace(/\*\*/g, '').trim() : '';
}

/** Main content for /app-insights: the latest reports as plain links. */
export function renderInsightsMain({ title, intro, items, total }) {
  const list = items
    .map((it) => `<li><a href="/shared-app-report/${esc(it.hashUrl)}">${it.icon ? `<img src="${esc(it.icon)}" alt="" width="48" height="48" loading="lazy">` : ''}<span>${esc(it.title)}</span></a><p>${[it.developer, PLATFORM[it.platform]].filter(Boolean).map(esc).join(' · ')}${it.avgRating ? ` · ★ ${esc(Number(it.avgRating).toFixed(1))}` : ''}</p></li>`)
    .join('');
  return `<main class="ipr ipr-wide" id="ipr-main" data-prerendered>
          <div class="ipr-title"><h1>${esc(title)}</h1>${total ? `<p>${esc(total.toLocaleString('en-US'))} public reports · latest ${items.length} below</p>` : ''}</div>
          <ul class="ipr-grid">${list}</ul>
          <p class="ipr-note">${esc(intro)}</p>
        </main>`;
}

/** Hero text swap for /for-teams (same layout as the home skeleton). */
export function applyHeroCopy(html, { heading, subtitle, cta }) {
  html = html
    .replace('<main class="isk-hero" id="isk-hero">', '<main class="isk-hero" id="isk-hero" data-prerendered>')
    .replace(/(<h1 class="isk-h1">)[\s\S]*?(<\/h1>)/, `$1${esc(heading)}$2`)
    .replace(/(<p class="isk-sub">)[\s\S]*?(<\/p>)/, `$1${esc(subtitle)}$2`);
  if (cta) {
    const ext = cta.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    html = html.replace(/<a href="[^"]*" class="isk-cta">[\s\S]*?<\/a>/, `<a href="${esc(cta.href)}" class="isk-cta"${ext}>${esc(cta.label)}</a>`);
  }
  return html;
}

/**
 * Main content for /app when logged out: static copy of the in-place sign-in
 * view (src/pages/AuthInterstitial.tsx with heading "Analyze my app ($1)").
 */
export function renderSignInMain({ heading }) {
  return `<main class="ipr" id="ipr-main" data-prerendered>
          <section class="ipr-card ipr-signin">
            <div><img src="/report-preview.webp" alt="Sample Insightly report" width="1919" height="902" loading="lazy"><p>Turn competitors&#39; 1-star reviews into your next product idea.</p></div>
            <div><h1>${esc(heading)}</h1><p>Login saves your credits &amp; report history. Reading public reports never requires login.</p>
              <a class="ipr-btn" href="/auth/google">Continue with Google</a>
              <a class="ipr-lnk" href="/app-insights">or browse free sample reports first →</a>
              <a class="ipr-lnk ipr-muted" href="/">← Back to free lookup on home</a></div>
          </section>
        </main>`;
}
