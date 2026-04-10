# Gamers Arena Repo

This repository is ready to deploy to Render as a Node web service.

## Repo Layout

- Render blueprint: `render.yaml`
- Deployable app: `website of me/Documents`
- Original archive and local-only folders are ignored by `.gitignore`

## GitHub Upload

Upload the whole repository root, not just the `Documents` folder. Render will use the blueprint at the repo root and automatically deploy the app from `website of me/Documents`.

## Render Launch

1. Push this repo to GitHub.
2. In Render, create a new Blueprint service from the repo.
3. Set the prompted secrets:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `ADMIN_SECONDARY_PASSWORD`
4. Deploy.

The blueprint already points Render at the correct subfolder, enables a persistent disk for app data, and generates a session secret automatically on first creation.
Keep this service on a paid Render web-service plan because Free instances do not support persistent disks and are not meant for production.

## Hostinger DNS

After Render gives you your `*.onrender.com` URL:

- Root domain:
  - Preferred on Hostinger: add an `ALIAS` record for `@` pointing to your Render hostname
  - Fallback: add an `A` record for `@` pointing to `216.24.57.1`
- `www` subdomain:
  - Add a `CNAME` record for `www` pointing to your Render hostname
- Remove conflicting `AAAA` records while verifying the domain

## App Notes

- Runtime data is stored through `STORE_PATH`, which Render mounts on a persistent disk.
- Admin credentials are meant to be managed with environment variables in production.
- Sessions are signed cookies, so logins survive restarts better than the previous in-memory approach.
