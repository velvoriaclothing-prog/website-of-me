# Gamers Arena

Gamers Arena is a clean multi-page gaming store built with Node.js, Express, vanilla HTML/CSS/JS, QR checkout, Telegram support handoff, admin controls, and a simple page builder.

## What is included

- Home page with 200 game accounts
- Fixed pricing at `₹45` for the seeded catalog
- Search and category filters
- Cart system
- QR checkout page
- Telegram support redirect after payment
- Order ID generation
- Admin dashboard
- Manual blog system
- Simple homepage editor
- Empty bundle section ready for later use

## Main pages

- `/`
- `/cart.html`
- `/checkout.html`
- `/chat.html`
- `/login.html`
- `/admin.html`
- `/blog.html`
- `/post.html`
- `/editor.html`

## Admin defaults

- Email: `admin@gamersarena.com`
- Password: set `ADMIN_PASSWORD` in your environment
- Secondary passcode: set `ADMIN_SECONDARY_PASSWORD` in your environment

## Telegram support

- Username: `@gamersarena_shop`
- Link: `https://t.me/gamersarena_shop`

## Run locally

```bash
npm install
node server.js
```

Then open:

- `http://localhost:3000`

## Notes

- Store data is kept in `data/store.json` by default
- Admin can change site title, QR image, homepage blocks, games, and blogs
- Users are redirected to Telegram after clicking `I Paid`
- Bundles are intentionally empty right now so you can add them later
- For deployment, set `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_SECONDARY_PASSWORD`
- To keep data across Render restarts, set `STORE_PATH` to a persistent-disk path such as `/var/data/store.json`
- If `STORE_PATH` points somewhere new, the app will seed that file from the bundled `data/store.json` on first boot

## Render deployment

This app is prepared for deployment from the repository root using `render.yaml`.

- Render service root directory: `website of me/Documents`
- Build command: `npm install`
- Start command: `npm start`
- Health check: `/health`

Use the repository root `README.md` for the GitHub, Render, and Hostinger launch steps.
