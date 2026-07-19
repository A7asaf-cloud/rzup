# פנקס (Pinkas) — Personal Finance App

A Hebrew/RTL personal finance app: cash-flow forecasting, auto-categorization,
recurring-charge detection, budgets, alerts, and savings goals. Built as a
real full-stack prototype — frontend and backend actually talk to each other.

**Bank connections are mocked.** There's no live link to any bank or card
company in this codebase — see "Going further" below for what that would
actually take.

## Structure

```
backend/    Node.js + Express + SQLite API (see backend/README.md)
frontend/   Vite + React app (see frontend/README.md)
schema-architecture.md   Full system design (Postgres schema, security, phased plan)
```

## Run it locally

```bash
# terminal 1
cd backend
npm install
npm run seed
npm start          # http://localhost:4000

# terminal 2
cd frontend
npm install
npm run dev         # http://localhost:5173
```

Open `http://localhost:5173` — the header badge confirms it's reading from
the live API rather than fallback mock data.

## Push this to your own GitHub

This folder is already a git repo with an initial commit. To put it under
your own account:

```bash
git remote add origin https://github.com/<your-username>/pinkas.git
git branch -M main
git push -u origin main
```

(Create the empty repo on GitHub first, without a README, so there's no
merge conflict on push.)

## Deploying so you can actually use it day-to-day

Deployment config files are already in this repo — Render and Vercel will
both auto-detect them, so most fields are pre-filled for you.

**Backend (Render):**
1. render.com → sign in with GitHub → **New +** → **Blueprint**
2. Pick this repo — it'll read `render.yaml` at the root and pre-fill
   everything (root dir `backend`, build/start commands). Confirm and deploy.
3. Copy the resulting URL (looks like `https://pinkas-backend-xxxx.onrender.com`)

**Frontend (Vercel):**
1. vercel.com → sign in with GitHub → **Add New → Project** → pick this repo
2. Set **Root Directory** to `frontend` (it'll pick up `vercel.json` from there automatically)
3. Under Environment Variables, add `VITE_API_BASE` = the Render URL from above
4. Deploy — you'll get a live URL like `https://pinkas.vercel.app`

Note: Render's free tier sleeps after inactivity — the first request after a
quiet period takes ~30s to wake up. Normal for the free plan.

SQLite is file-based; fine for this single-user demo, but Render's free tier
doesn't persist disk across deploys, so re-seeds on every deploy. For
anything long-term, swap in Postgres using the schema in
`schema-architecture.md` (already written in Postgres syntax).

## Going further: real bank connections

Everything here is mocked because a live connection needs either a licensed
Open Banking provider (via Bank of Israel's framework) or a self-hosted
`israeli-bank-scrapers` instance you run with your own encrypted credential
store — not something to plug into a shared repo or chat session. The
`POST /api/accounts/:id/sync` route in `backend/src/server.js` is the seam
where that integration would go; everything downstream (categorization,
forecasting, budgets) already expects real transaction rows in that shape.
