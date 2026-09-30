# Stroke — website and progress-sync backend

Stroke is an adaptive Maths, Science, and Coding game. This repository contains the complete static website in `public/` and a Node.js API in `server/`. The server hosts the website and optionally syncs learner progress between devices with a private recovery key. No third-party login is needed. The existing browser-only experience still works without enabling sync.

## Run locally

Requires Node.js 20 or newer.

```bash
npm ci
npm start
```

Open **http://localhost:3000**. The local backend stores sync data in `server/data/progress.json` (ignored by Git). To use PostgreSQL instead, set `DATABASE_URL` in your environment before starting. Production refuses to start without a database URL because local disks on cloud hosts may be ephemeral.

Run tests: `npm test`.

## Deploy to Render

1. Push this repository to GitHub. The intended remote supplied by the user is `https://github.com/praveen-gk18/stroke..git` (note the two dots; verify the repository exists and that you have write access).
2. In Render, choose **New → Blueprint**, connect the repository, and select its `render.yaml`.
3. Review the **web-service and PostgreSQL plans/pricing** in Render before approving creation. The Blueprint supplies `DATABASE_URL` from the database to the web service. No secret belongs in Git.
4. When deployment succeeds, visit the generated Render service URL and `/api/health`. Render provides the public HTTPS hostname. The app uses same-origin relative `/api` calls, so it needs no CORS configuration.
5. In Stroke, open **Manage sync → Enable cloud save**, then store the recovery key somewhere private. Enter that key on another device and choose **Restore that progress**.

This workspace can run a local preview, but **cannot publish a live Render site or push to GitHub without the account's authentication/authorization**.

## API

- `GET /api/health` — status and storage backend.
- `GET /api/progress` — returns the snapshot and revision for `Authorization: Bearer <recovery-key>`; 404 if none.
- `PUT /api/progress` — body `{ "data": <progress-snapshot>, "revision": <last-known-revision> }`; creates at revision 0 or updates an exact matching revision. A stale revision returns 409. Snapshots are capped by the 300 KB JSON body limit. No key is stored on the server; only its SHA-256 hash is stored.

Progress contains a student name and learning history. Treat the recovery key like a password. Anyone holding it can retrieve or replace that learner's data. This is **not** a full account or school multi-user identity system, and it should not be used as-is for sensitive school records. Add proper authentication, consent, retention/deletion, backups, and administrator controls before a real school rollout. The client caches no `/api` responses in its service worker. On Render, data is kept in PostgreSQL; the file fallback is for local development only.

## Structure

- `public/index.html`, `public/css/`, `public/js/`, `public/data/`, `public/vendor/`: existing Stroke game, all 118 periodic elements, live coding, interactive maths, Three.js molecules/atoms/solar system.
- `public/js/sync.js`, `public/css/sync.css`: optional cloud-save UI and client-side sync.
- `server/index.js`: Express static server and API.
- `server/storage.js`: PostgreSQL storage with local-file fallback.
- `server/storage.test.js`: storage/revision test.
- `render.yaml`: Render Blueprint.
- `package.json`, `package-lock.json`: pinned app dependencies.

Licenses for vendored Three.js and the periodic-element dataset are included under `public/vendor/` and `public/data/`.
