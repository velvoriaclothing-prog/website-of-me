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
- Password: `Aditisubhan`

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

- Store data is kept in [store.json](C:/Users/subhan/Downloads/Documents-20260407T145643Z-3-001/Documents/data/store.json)
- Admin can change site title, QR image, homepage blocks, games, and blogs
- Users are redirected to Telegram after clicking `I Paid`
- Bundles are intentionally empty right now so you can add them later
