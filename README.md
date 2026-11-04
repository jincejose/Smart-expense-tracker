# Pennywise — Smart Expense Tracker

A responsive expense tracker built with React, CSS, JavaScript, Express, and PostgreSQL. It includes a ready-to-use local browser storage mode when PostgreSQL is not configured.

## Run locally

```sh
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The app starts with sample transactions saved in the browser. You can add, edit, delete, search, filter, and export expenses; set category budgets; and view monthly reports, budget alerts, and an estimated month end spend. Use the currency selector in the top bar to format amounts as USD, INR, EUR, GBP, JPY, CAD, AUD, or SGD. The currency choice is saved in your browser. It changes the displayed currency and number format, but does not convert amounts using exchange rates.

## Use PostgreSQL

1. Create an empty PostgreSQL database named `pennywise` (or choose another database name).
2. Copy `.env.example` to `.env` and update `DATABASE_URL` with your PostgreSQL username, password, host, port, and database.
3. Initialize the tables with `npm run db:init`.
4. Start the app with `npm run dev`. The API stores expense and budget changes in PostgreSQL when it connects successfully.

The API runs on port 3001 and the Vite dev server proxies `/api` requests to it. `npm run build` builds the React frontend. Set `NODE_ENV=production` and `PORT` to run the production Express server, which serves both the built frontend and the API.
