# פנקס — Frontend

Vite + React app. Talks to the backend API at `http://localhost:4000` by
default (override with a `.env` file: `VITE_API_BASE=http://your-api-url`).

```bash
npm install
npm run dev      # http://localhost:5173
```

If the backend isn't running, the app falls back to built-in mock data so
the UI is still fully explorable — a small badge in the header shows
whether it's live ("מחובר ל-API") or demo data.
