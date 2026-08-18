# jaronbrandon.com — backend

A tiny Node/Express app that server-renders the landing page from `data/content.json`,
plus a password-protected `/admin` page where you edit every piece of text on the site
(headline, subhead, the two contrast-band claims, all five vote-record rows, and the
FPPC footer) without touching code. Saving writes straight to `content.json` and the
live page reflects it on the next request — no rebuild, no redeploy.

## Run it locally first

```bash
npm install
cp .env.example .env
```

Edit `.env` and set:
- `ADMIN_PASSWORD` — a long, random password (this is the only thing standing between
  the public internet and your admin panel — don't reuse a password from anywhere else).
- `SESSION_SECRET` — generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

Then:
```bash
npm start
```
- Public page: http://localhost:3000/
- Admin: http://localhost:3000/admin

## Deploying somewhere cheap that indexes fine on Google

Google indexes based on the domain, HTTPS, page speed, and content — not which host you
pick — so any of these work for ranking purposes. Recommended for "cheap and simple":

### Render.com (recommended)
- Free tier available; paid "Starter" instance is ~$7/mo if you want it always-on
  (the free tier sleeps after inactivity, which adds a few seconds' delay on the
  first visit after a quiet period — fine for most traffic patterns, but worth
  knowing before an ad push).
- Steps:
  1. Push this `backend/` folder to a GitHub repo.
  2. On Render: New → Web Service → connect the repo.
  3. Build command: `npm install`. Start command: `npm start`.
  4. Add environment variables `ADMIN_PASSWORD` and `SESSION_SECRET` (and set
     `NODE_ENV=production`) in Render's dashboard — never commit `.env`.
  5. Once it's live on the `onrender.com` URL, add your custom domain
     (`jaronbrandon.com`) under Settings → Custom Domains, and point your domain's
     DNS at Render per their instructions. Render issues free HTTPS automatically.

### Railway.app — similar price/workflow to Render, also fine.

### A $5/mo VPS (DigitalOcean, Hetzner, etc.) — cheapest at scale, but you're
  responsible for HTTPS (use Caddy or certbot), process management (pm2 or systemd),
  and OS updates yourself. Only worth it if you're comfortable with basic sysadmin.

Whichever you pick, once it's live:
- Confirm `robots.txt` is reachable at `/robots.txt` (already wired up).
- Set canonical domain (apex vs. `www`) at the DNS/host level and 301 the other —
  this app doesn't do that redirect itself since it depends on your DNS provider.
- Swap the placeholder OG/share-card image (`meta.ogImage` in the admin's SEO section)
  for a real 1200×630 image hosted at that URL, or Google/social previews will 404 on it.

## Editing content day to day

1. Go to `https://jaronbrandon.com/admin`, log in with your password.
2. Every field from the page is there — hero headline/subhead, the two Band 3
   columns, the Band 4 vote-record rows (add/remove with the buttons), and the
   Band 5 FPPC footer (committee name, ID number, disclosure text).
3. Click **Save changes**. The live page updates immediately — no separate deploy step.
4. Un-check "Mark as placeholder" / "Mark footer as placeholder" once you've replaced
   the bracketed placeholder text with verified, sourced content — those checkboxes
   control the amber `PLACEHOLDER` warning badges baked into the page itself, so you
   don't accidentally publish unverified claims.

## What this does NOT do (by design, kept simple)

- **No image upload.** The two Band 3 images and the hero photo are still files —
  paste a hosted image URL into the "Image URL" field for Band 3, or replace
  `public/img/hero.jpg` directly and redeploy for the hero. Say the word if you want
  a proper upload button added later.
- **No multi-user accounts.** One shared admin password. Fine for one person; if you
  want separate logins for a campaign team, that's a bigger change (real user table,
  per-user audit log) — ask and I'll build it.
- **No version history / undo.** Every save overwrites `content.json`. If that's a
  concern, the next step up is auto-committing each save to a git history or keeping
  timestamped backups — straightforward to add if you want it.

## Security notes

- Change `ADMIN_PASSWORD` from anything used in testing before this goes anywhere
  public — the value used during my testing has already been removed from this project.
- The admin routes are marked `noindex, nofollow` and set no-cache, but the real
  protection is the password — keep it long and don't share it over insecure channels.
- Login attempts are rate-limited (10 per 10 minutes per IP) to slow down brute-forcing,
  but this is not a substitute for a strong password.
