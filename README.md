# Squad Goals on Tata Neu: clickable concept prototype

> **Disclaimer:** Concept prototype for the IIM Raipur case competition. **Not affiliated with, endorsed by or connected to Tata Digital or any Tata company.** All users (Aarav, Riya, Kabir, Meera), prices and dates are fictional. There is no real login, payment, booking or personal-data collection. Brand names appear only as text; every icon and illustration was drawn for this prototype, and no real logos or app images are used.

## What it shows
The locked feature "Squad Goals" (see `research/08_final_spec.md`) has four layers: Streak, Moments, Show up pay less (unlock ladder) and Squad. It's shown as 9 screens styled after the current Tata Neu app:

| # | Screen file | What it shows |
|---|---|---|
| 1 | `screens/home.html` | Current Home look + the Squad Goals module under quick actions + new "Squad" quick action |
| 2 | `screens/pay_success.html` | ₹60 at Sharma Canteen → streak kept 5/5, +5 NeuCoins (guaranteed), Diwali progress |
| 3 | `screens/moments.html` | Auto-built Moments from public dates, college-calendar and payday toggles |
| 4 | `screens/moment_detail.html` | Diwali plan (Air India Express + Ginger), 7-day sparkline, unlock ladder at 55%, fare lock |
| 5 | `screens/squad.html` | Members (Kabir as a WhatsApp "ghost"), +10% from friends, each pays their own share (ledger only) |
| 6 | `screens/drop.html` | Friday 6pm Squad Drop: tap to reveal, guaranteed +10 NeuCoins + baggage boost, odds published |
| 7 | `screens/recap.html` | Sunday 8pm lock-screen push → weekly recap card |
| 8 | `screens/unlock.html` | 100% unlocked → checkout summary (saved ₹756 = 15% of ₹5,040); Book is a dummy |
| 9 | `screens/widget.html` | Android home-screen widget |

**Judge mode** (side panel on desktop, "JM" floating button on mobile, or press `J`) overlays each screen with its Hook stage (Trigger / Action / Variable reward / Investment / Guardrail) and the case problem it solves (Event-based usage / Standalone preference / Missing hook).

## How it works
- `index.html` is the shell: phone frame (390×844) and side panel on screens ≥900px wide, full-screen on phones.
- Navigation uses **HTMX 2.0.4** (bundled at `assets/js/htmx.min.js`, no CDN needed). Every tappable element has `hx-get="screens/<name>.html"`. `hx-target="#screen"` and `hx-swap="innerHTML transition:true"` are inherited from `<body>`, so swaps run through the browser's View Transitions API (slide in/out).
- `assets/js/app.js` adds deep links (`index.html#moment_detail`), browser Back, Judge mode, toasts, confetti and count-up animations.
- `assets/css/app.css` holds all styles. Tokens sampled from the current app: hero `#6C49BD→#5132AD`, primary `#8800EC`, tiles `#F2F2F4`, NeuPass tile `#EBF0FF`/`#034793`, Scan & Pay `#444347`.
- Fonts: Poppins (SIL Open Font License), self-hosted in `assets/fonts/`. Icons: hand-drawn SVG sprite in `assets/icons/sprite.svg`.
- Zero external requests, so it works offline once loaded.

URL options: `?judge=1` starts with Judge mode on, `?shot=1` hides the mobile floating button (for screenshots), `#<screen>` opens a screen directly.

## Run locally
HTMX loads partials with HTTP requests, so **opening `index.html` as a file (file://) will not work**. Serve the folder instead:
```bash
cd prototype
python3 -m http.server 8000
# open http://localhost:8000
```

## Publish on GitHub Pages
1. Create a new public repo (e.g. `squad-goals-prototype`) on GitHub.
2. Push the **contents** of this `prototype/` folder to the repo root:
   ```bash
   cd prototype
   git init && git add . && git commit -m "Squad Goals concept prototype"
   git branch -M main
   git remote add origin https://github.com/<your-user>/squad-goals-prototype.git
   git push -u origin main
   ```
3. In the repo go to **Settings → Pages → Build and deployment → Source: Deploy from a branch**, then pick `main` / `(root)` and **Save**.
4. After about a minute the prototype is live at `https://<your-user>.github.io/squad-goals-prototype/`. Send judges `…/#home`, or `…/?judge=1#home` to start with annotations on.

The empty `.nojekyll` file stops GitHub Pages from hiding files that start with `_` (such as `screenshots/_montage.png`). Keep it.

## Screenshots (for the deck)
`screenshots/` contains 1170×2532 PNGs (3× of 390×844) with Judge mode off: `01_home` … `09_widget`, plus `06b_drop_revealed`, `07b_recap_card`, full-length scrolls (`full_home`, `full_moment_detail`, `full_squad`), two Judge-mode shots (`judge_01_home`, `judge_04_moment_detail`) and `_montage.png` (screens 1–8 side by side).

## Limitations
- A demo, not an app: no state is saved, and prices, countdowns and odds are illustrative.
- Only the Diwali Moment is clickable end to end. Other Moments, Categories, Offers and NeuCard show a "unchanged in this concept" toast.
- The slide animation needs View Transitions (Chrome/Edge 111+, Safari 18+). Other browsers get a simple fade, and everything else still works.
