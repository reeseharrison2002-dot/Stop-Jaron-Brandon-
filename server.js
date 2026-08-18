require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-please-' + Math.random().toString(36);

if (!ADMIN_PASSWORD) {
  console.error('\nFATAL: set ADMIN_PASSWORD in your environment (.env locally, or your host\'s env var settings) before starting the server.\n');
  process.exit(1);
}

const CONTENT_PATH = path.join(__dirname, 'data', 'content.json');
const STYLE_PATH = path.join(__dirname, 'views', 'style.css');

// ---------- helpers ----------

function readContent() {
  return JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));
}

function writeContent(data) {
  fs.writeFileSync(CONTENT_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function placeholderFlag(isPlaceholder) {
  return isPlaceholder ? '<span class="placeholder-flag">PLACEHOLDER</span> ' : '';
}

// very small in-memory rate limiter for the login route
const loginAttempts = new Map(); // ip -> { count, resetAt }
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxAttempts = 10;
  let rec = loginAttempts.get(ip);
  if (!rec || now > rec.resetAt) {
    rec = { count: 0, resetAt: now + windowMs };
  }
  rec.count += 1;
  loginAttempts.set(ip, rec);
  return rec.count <= maxAttempts;
}

// ---------- page rendering ----------

function renderPage(content) {
  const style = fs.readFileSync(STYLE_PATH, 'utf8');
  const c = content;

  const headlineHtml = c.hero.headlineLines
    .map((line, i) => {
      const isLast = i === c.hero.headlineLines.length - 1;
      const srcTag = isLast
        ? `<span class="src"><a href="${escapeHtml(c.hero.sourceUrl)}" title="Source">[${escapeHtml(c.hero.sourceNumber)}]</a></span>`
        : '';
      return `${escapeHtml(line)}${srcTag}${isLast ? '' : '<br>'}`;
    })
    .join('\n      ');

  function contrastColumn(col, srcId) {
    const figure = col.imageUrl
      ? `<img src="${escapeHtml(col.imageUrl)}" alt="${escapeHtml(col.heading)}" style="width:100%;aspect-ratio:4/3;object-fit:cover;margin-bottom:1.75rem;">`
      : `<div class="contrast-figure">[ PLACEHOLDER IMAGE — ${escapeHtml(col.heading)}, photographic/documentary style ]</div>`;
    return `
      ${figure}
      <h2>${escapeHtml(col.heading)}</h2>
      <p>${placeholderFlag(col.isPlaceholder)}${escapeHtml(col.claim)}<span class="src"><a href="#record">[${escapeHtml(col.sourceNumber)}]</a></span></p>
      <p class="src-line"><a href="${escapeHtml(col.sourceUrl)}">Source: ${escapeHtml(col.sourceLabel)}</a></p>`;
  }

  const recordItemsHtml = c.record.items
    .map(
      (item) => `
    <li class="record-item">
      <span class="record-date">${escapeHtml(item.date)}</span>
      <span class="record-desc">${placeholderFlag(item.isPlaceholder)}${escapeHtml(item.desc)}</span>
      <span class="record-src"><a href="${escapeHtml(item.sourceUrl)}">Source ↗</a></span>
    </li>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(c.meta.pageTitle)}</title>
<meta name="description" content="${escapeHtml(c.meta.metaDescription)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://${escapeHtml(c.meta.domain)}/">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://${escapeHtml(c.meta.domain)}/">
<meta property="og:title" content="${escapeHtml(c.meta.ogTitle)}">
<meta property="og:description" content="${escapeHtml(c.meta.ogDescription)}">
<meta property="og:image" content="${escapeHtml(c.meta.ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(c.meta.ogTitle)}">
<meta name="twitter:description" content="${escapeHtml(c.meta.ogDescription)}">
<meta name="twitter:image" content="${escapeHtml(c.meta.ogImage)}">

<style>
${style}
</style>
</head>
<body>

<!-- ============ BAND 1: HERO ============ -->
<section class="band-hero">
  <div class="hero-inner">
    <h1 class="hero-headline">
      ${headlineHtml}
    </h1>
    <p class="hero-subhead">
      ${escapeHtml(c.hero.subhead)}
    </p>
  </div>
</section>

<!-- ============ BAND 2: TRANSITION ============ -->
<section class="band-transition">
  <p class="transition-line display">${escapeHtml(c.transition.line)}</p>
</section>

<!-- ============ BAND 3: CONTRAST PAIR ============ -->
<section class="band-contrast">
  <div class="contrast-grid">
    <div class="contrast-col">${contrastColumn(c.contrast.left, 2)}
    </div>
    <div class="contrast-col">${contrastColumn(c.contrast.right, 3)}
    </div>
  </div>
</section>

<!-- ============ BAND 4: RECORD SUMMARY ============ -->
<section class="band-record" id="record">
  <h2 class="display">${escapeHtml(c.record.heading)}</h2>
  <ul class="record-list">${recordItemsHtml}
  </ul>
</section>

<!-- ============ BAND 5: FOOTER ============ -->
<footer class="band-footer">
  ${c.footer.isPlaceholder ? '<p><span class="placeholder-flag">PLACEHOLDER — REQUIRED BEFORE PUBLISHING</span></p>' : ''}
  <p>Paid for by <strong>${escapeHtml(c.footer.committeeName)}</strong>, FPPC ID# <strong>${escapeHtml(c.footer.fppcId)}</strong>.</p>
  <p>Not authorized by any candidate or candidate's committee.</p>
  <p>All factual claims on this page are sourced to public records; see linked citations above. ${escapeHtml(c.footer.additionalDisclosure)}</p>
</footer>

</body>
</html>
`;
}

function renderComingSoon() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Coming Soon</title>
<meta name="robots" content="noindex, nofollow">
<style>
  body{background:#161616;color:#f2f0ea;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:2rem;}
  p{color:#8a8a8a;max-width:32ch;line-height:1.6;}
</style>
</head>
<body>
  <p>This page is not yet available.</p>
</body>
</html>`;
}

// ---------- admin UI ----------

function renderLoginPage(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Admin Login</title>
<meta name="robots" content="noindex, nofollow">
<style>
  body{background:#161616;color:#f2f0ea;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
  form{background:#1e1e1e;padding:2.5rem;border-radius:8px;width:100%;max-width:360px;border:1px solid #333;}
  h1{font-size:1.2rem;margin:0 0 1.5rem;}
  label{display:block;font-size:0.85rem;color:#b7b3aa;margin-bottom:0.4rem;}
  input{width:100%;padding:0.65rem;border-radius:4px;border:1px solid #444;background:#111;color:#fff;font-size:1rem;margin-bottom:1.25rem;box-sizing:border-box;}
  button{width:100%;padding:0.7rem;border-radius:4px;border:none;background:#e8a13c;color:#161616;font-weight:700;font-size:1rem;cursor:pointer;}
  button:hover{background:#f0b25a;}
  .err{color:#ff8080;font-size:0.85rem;margin-bottom:1rem;}
</style>
</head>
<body>
  <form method="POST" action="/admin/login">
    <h1>Site Admin</h1>
    ${error ? `<div class="err">${escapeHtml(error)}</div>` : ''}
    <label for="password">Password</label>
    <input type="password" id="password" name="password" autofocus required>
    <button type="submit">Log in</button>
  </form>
</body>
</html>`;
}

function field(label, name, value, opts = {}) {
  const type = opts.textarea ? null : (opts.type || 'text');
  const inputEl = opts.textarea
    ? `<textarea id="${name}" name="${name}" rows="${opts.rows || 2}">${escapeHtml(value)}</textarea>`
    : `<input type="${type}" id="${name}" name="${name}" value="${escapeHtml(value)}">`;
  return `
    <div class="f">
      <label for="${name}">${escapeHtml(label)}</label>
      ${inputEl}
    </div>`;
}

function checkboxField(label, name, checked) {
  return `
    <div class="f cb">
      <label><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}> ${escapeHtml(label)}</label>
    </div>`;
}

function renderDashboard(content, message) {
  const c = content;
  const recordRows = c.record.items
    .map(
      (item, i) => `
      <div class="record-row" data-idx="${i}">
        <input type="text" name="record_date" value="${escapeHtml(item.date)}" placeholder="YYYY-MM-DD" class="rdate">
        <input type="text" name="record_desc" value="${escapeHtml(item.desc)}" placeholder="Vote description" class="rdesc">
        <input type="text" name="record_src" value="${escapeHtml(item.sourceUrl)}" placeholder="Source URL" class="rsrc">
        <label class="rph"><input type="checkbox" name="record_placeholder_${i}" ${item.isPlaceholder ? 'checked' : ''}> placeholder</label>
        <button type="button" class="remove-row" onclick="this.closest('.record-row').remove()">✕</button>
      </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Admin — Site Content</title>
<meta name="robots" content="noindex, nofollow">
<style>
  *{box-sizing:border-box;}
  body{background:#161616;color:#f2f0ea;font-family:system-ui,sans-serif;margin:0;padding:2rem 1.5rem 6rem;}
  .wrap{max-width:820px;margin:0 auto;}
  h1{font-size:1.5rem;margin-bottom:0.25rem;}
  .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;}
  a.logout{color:#e8a13c;font-size:0.85rem;}
  .msg{background:rgba(232,161,60,0.15);border:1px solid #e8a13c;color:#e8a13c;padding:0.75rem 1rem;border-radius:4px;margin-bottom:1.5rem;font-size:0.9rem;}
  .publish-bar{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.25rem;border-radius:8px;margin-bottom:1.5rem;border:1px solid;}
  .publish-bar.live{background:rgba(80,200,120,0.1);border-color:#4caf6f;}
  .publish-bar.hidden{background:rgba(232,161,60,0.1);border-color:#e8a13c;}
  .publish-bar .status{font-weight:700;font-size:0.9rem;}
  .publish-bar.live .status{color:#4caf6f;}
  .publish-bar.hidden .status{color:#e8a13c;}
  .publish-bar .desc{color:#b7b3aa;font-size:0.82rem;margin-top:0.2rem;}
  .publish-toggle{display:flex;align-items:center;gap:0.6rem;white-space:nowrap;}
  .publish-toggle label{color:#f2f0ea;font-size:0.9rem;margin:0;}
  fieldset{border:1px solid #333;border-radius:8px;padding:1.25rem 1.5rem 1.5rem;margin-bottom:1.5rem;}
  legend{padding:0 0.5rem;color:#e8a13c;font-weight:700;font-size:0.95rem;text-transform:uppercase;letter-spacing:0.03em;}
  label{display:block;font-size:0.8rem;color:#b7b3aa;margin-bottom:0.3rem;}
  input[type=text],input[type=url],textarea{
    width:100%;padding:0.55rem;border-radius:4px;border:1px solid #444;background:#111;color:#fff;font-size:0.95rem;font-family:inherit;
  }
  textarea{resize:vertical;}
  .f{margin-bottom:1rem;}
  .f.cb label{display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;color:#f2f0ea;}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:0 2rem;}
  .two-col > div{padding-top:0.5rem;}
  .two-col h3{font-size:0.85rem;color:#b7b3aa;text-transform:uppercase;margin:0 0 0.75rem;}
  .record-row{display:grid;grid-template-columns:9rem 1fr 10rem auto auto;gap:0.5rem;align-items:center;margin-bottom:0.6rem;}
  .rph{font-size:0.75rem;color:#b7b3aa;display:flex;align-items:center;gap:0.3rem;white-space:nowrap;}
  .remove-row{background:#3a1f1f;color:#ff8080;border:1px solid #5a2c2c;border-radius:4px;cursor:pointer;padding:0.3rem 0.5rem;}
  #add-row{background:#222;color:#e8a13c;border:1px solid #444;border-radius:4px;padding:0.5rem 0.9rem;cursor:pointer;margin-top:0.5rem;}
  .save-bar{position:fixed;bottom:0;left:0;right:0;background:#1a1a1a;border-top:1px solid #333;padding:1rem 1.5rem;display:flex;justify-content:center;gap:1rem;}
  button.save{background:#e8a13c;color:#161616;font-weight:700;border:none;border-radius:4px;padding:0.75rem 2rem;font-size:1rem;cursor:pointer;}
  a.preview{color:#e8a13c;align-self:center;font-size:0.9rem;}
  @media (max-width:700px){.two-col{grid-template-columns:1fr;} .record-row{grid-template-columns:1fr;}}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div>
      <h1>Site Content</h1>
      <div style="color:#888;font-size:0.85rem;">Changes go live immediately on save.</div>
    </div>
    <a class="logout" href="/admin/logout">Log out</a>
  </div>
  ${message ? `<div class="msg">${escapeHtml(message)}</div>` : ''}

  <form method="POST" action="/admin/save">

    <div class="publish-bar ${c.meta.published ? 'live' : 'hidden'}">
      <div>
        <div class="status">${c.meta.published ? '● LIVE — visible to the public' : '● HIDDEN — only visible to you while logged in'}</div>
        <div class="desc">${c.meta.published ? 'Anyone with the link can see this page right now.' : 'Uncheck stays this way while you edit. Check the box and save to publish.'}</div>
      </div>
      <div class="publish-toggle">
        <label for="published"><input type="checkbox" id="published" name="published" ${c.meta.published ? 'checked' : ''}> Publish site</label>
      </div>
    </div>

    <fieldset>
      <legend>Hero (Band 1)</legend>
      ${field('Headline line 1', 'headline1', c.hero.headlineLines[0] || '')}
      ${field('Headline line 2', 'headline2', c.hero.headlineLines[1] || '')}
      ${field('Headline line 3', 'headline3', c.hero.headlineLines[2] || '')}
      ${field('Subhead', 'subhead', c.hero.subhead, { textarea: true, rows: 2 })}
      ${field('Source citation number (superscript)', 'heroSourceNumber', c.hero.sourceNumber)}
      ${field('Source link URL', 'heroSourceUrl', c.hero.sourceUrl)}
    </fieldset>

    <fieldset>
      <legend>Transition (Band 2)</legend>
      ${field('Line', 'transitionLine', c.transition.line)}
    </fieldset>

    <fieldset>
      <legend>Contrast Pair (Band 3)</legend>
      <div class="two-col">
        <div>
          <h3>Left column</h3>
          ${field('Heading', 'leftHeading', c.contrast.left.heading)}
          ${field('Claim text', 'leftClaim', c.contrast.left.claim, { textarea: true, rows: 3 })}
          ${field('Source number', 'leftSourceNumber', c.contrast.left.sourceNumber)}
          ${field('Source label', 'leftSourceLabel', c.contrast.left.sourceLabel)}
          ${field('Source URL', 'leftSourceUrl', c.contrast.left.sourceUrl)}
          ${field('Image URL (blank = placeholder box)', 'leftImageUrl', c.contrast.left.imageUrl)}
          ${checkboxField('Mark as placeholder', 'leftPlaceholder', c.contrast.left.isPlaceholder)}
        </div>
        <div>
          <h3>Right column</h3>
          ${field('Heading', 'rightHeading', c.contrast.right.heading)}
          ${field('Claim text', 'rightClaim', c.contrast.right.claim, { textarea: true, rows: 3 })}
          ${field('Source number', 'rightSourceNumber', c.contrast.right.sourceNumber)}
          ${field('Source label', 'rightSourceLabel', c.contrast.right.sourceLabel)}
          ${field('Source URL', 'rightSourceUrl', c.contrast.right.sourceUrl)}
          ${field('Image URL (blank = placeholder box)', 'rightImageUrl', c.contrast.right.imageUrl)}
          ${checkboxField('Mark as placeholder', 'rightPlaceholder', c.contrast.right.isPlaceholder)}
        </div>
      </div>
    </fieldset>

    <fieldset>
      <legend>Record Summary (Band 4)</legend>
      ${field('Section heading', 'recordHeading', c.record.heading)}
      <div id="record-rows">${recordRows}</div>
      <button type="button" id="add-row">+ Add vote entry</button>
    </fieldset>

    <fieldset>
      <legend>Footer / FPPC Disclosure (Band 5)</legend>
      ${field('Committee name', 'committeeName', c.footer.committeeName)}
      ${field('FPPC ID number', 'fppcId', c.footer.fppcId)}
      ${field('Additional disclosure text', 'additionalDisclosure', c.footer.additionalDisclosure, { textarea: true, rows: 2 })}
      ${checkboxField('Mark footer as placeholder (shows warning banner on page)', 'footerPlaceholder', c.footer.isPlaceholder)}
    </fieldset>

    <fieldset>
      <legend>SEO / Meta</legend>
      ${field('Domain', 'domain', c.meta.domain)}
      ${field('Page title (browser tab)', 'pageTitle', c.meta.pageTitle)}
      ${field('Meta description', 'metaDescription', c.meta.metaDescription, { textarea: true, rows: 2 })}
      ${field('Share card title (OG/Twitter)', 'ogTitle', c.meta.ogTitle)}
      ${field('Share card description', 'ogDescription', c.meta.ogDescription, { textarea: true, rows: 2 })}
      ${field('Share card image URL', 'ogImage', c.meta.ogImage)}
    </fieldset>

    <div class="save-bar">
      <a class="preview" href="/" target="_blank">View live page ↗</a>
      <button type="submit" class="save">Save changes</button>
    </div>
  </form>
</div>

<script>
  document.getElementById('add-row').addEventListener('click', function () {
    const container = document.getElementById('record-rows');
    const row = document.createElement('div');
    row.className = 'record-row';
    row.innerHTML =
      '<input type="text" name="record_date" placeholder="YYYY-MM-DD" class="rdate">' +
      '<input type="text" name="record_desc" placeholder="Vote description" class="rdesc">' +
      '<input type="text" name="record_src" placeholder="Source URL" class="rsrc">' +
      '<label class="rph"><input type="checkbox" checked> placeholder</label>' +
      '<button type="button" class="remove-row" onclick="this.closest(\\'.record-row\\').remove()">✕</button>';
    container.appendChild(row);
  });
</script>
</body>
</html>`;
}

// ---------- middleware ----------

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  })
);

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin');
}

// ---------- routes ----------

app.get('/', (req, res) => {
  const content = readContent();
  const isAdmin = Boolean(req.session && req.session.isAdmin);
  res.set('Cache-Control', 'no-cache');
  if (!content.meta.published && !isAdmin) {
    return res.status(200).send(renderComingSoon());
  }
  res.send(renderPage(content));
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nAllow: /\n');
});

app.get('/admin', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.send(renderLoginPage());
});

app.post('/admin/login', (req, res) => {
  const ip = req.ip;
  if (!checkRateLimit(ip)) {
    return res.status(429).send(renderLoginPage('Too many attempts. Wait a few minutes and try again.'));
  }
  const { password } = req.body;
  if (password && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  }
  return res.status(401).send(renderLoginPage('Incorrect password.'));
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin'));
});

app.get('/admin/dashboard', requireAuth, (req, res) => {
  const content = readContent();
  res.send(renderDashboard(content, req.session.flash));
  req.session.flash = null;
});

app.post('/admin/save', requireAuth, (req, res) => {
  const b = req.body;
  const dates = [].concat(b.record_date || []);
  const descs = [].concat(b.record_desc || []);
  const srcs = [].concat(b.record_src || []);

  const items = dates.map((date, i) => {
    const placeholderKey = 'record_placeholder_' + i;
    return {
      date: date || '',
      desc: descs[i] || '',
      sourceUrl: srcs[i] || '#',
      isPlaceholder: Boolean(b[placeholderKey]),
    };
  }).filter(item => item.date || item.desc);

  const content = {
    meta: {
      published: Boolean(b.published),
      domain: b.domain || '',
      pageTitle: b.pageTitle || '',
      metaDescription: b.metaDescription || '',
      ogTitle: b.ogTitle || '',
      ogDescription: b.ogDescription || '',
      ogImage: b.ogImage || '',
    },
    hero: {
      headlineLines: [b.headline1, b.headline2, b.headline3].filter(Boolean),
      sourceNumber: b.heroSourceNumber || '1',
      sourceUrl: b.heroSourceUrl || '#record',
      subhead: b.subhead || '',
    },
    transition: {
      line: b.transitionLine || '',
    },
    contrast: {
      left: {
        heading: b.leftHeading || '',
        claim: b.leftClaim || '',
        sourceNumber: b.leftSourceNumber || '2',
        sourceLabel: b.leftSourceLabel || '',
        sourceUrl: b.leftSourceUrl || '#record',
        imageUrl: b.leftImageUrl || '',
        isPlaceholder: Boolean(b.leftPlaceholder),
      },
      right: {
        heading: b.rightHeading || '',
        claim: b.rightClaim || '',
        sourceNumber: b.rightSourceNumber || '3',
        sourceLabel: b.rightSourceLabel || '',
        sourceUrl: b.rightSourceUrl || '#record',
        imageUrl: b.rightImageUrl || '',
        isPlaceholder: Boolean(b.rightPlaceholder),
      },
    },
    record: {
      heading: b.recordHeading || 'The Record',
      items,
    },
    footer: {
      committeeName: b.committeeName || '',
      fppcId: b.fppcId || '',
      additionalDisclosure: b.additionalDisclosure || '',
      isPlaceholder: Boolean(b.footerPlaceholder),
    },
  };

  writeContent(content);
  req.session.flash = 'Saved. The live page now reflects these changes.';
  res.redirect('/admin/dashboard');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Public page:  http://localhost:${PORT}/`);
  console.log(`Admin login:  http://localhost:${PORT}/admin`);
});
