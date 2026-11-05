# Form Submissions CRM Dashboard (Clean Product)

A clean, lightning-fast dashboard that fetches and manages all form submissions and pipeline opportunity statuses directly from GoHighLevel (GHL).

## Why this replaces the AI Studio setup
- **Zero hanging loops or semaphore locks**: AI Studio generated thousands of lines of isolate queues, token buckets, and fragmented client server functions that caused race conditions and 28s client timeouts.
- **Fast parallel sync**: Fetches all forms, pipelines, submissions, and opportunity statuses in **~2 seconds flat**.
- **No stale caches**: Fresh fetch on page load or when clicking the "Refresh" button.
- **Live UI status**: Real-time progress banner showing exactly how many submissions and statuses were synced.
- **Detailed console logs**: Clear, categorized logs both in the terminal and in the browser developer tools.
- **Full pagination & filters**: Clean 50 items per page with instant search and dropdown filters (Forms, Statuses, Services, Date ranges).
- **Interactive status updater**: Change a lead's stage directly from the table or the details drawer.

## Quick Start

```bash
cd "D:\markdown-parser (4)\final-product"
npm run dev
```

Open your browser at:
👉 **`http://localhost:3000/`**

## Environment Variables (.env)
Configured in `final-product/.env`:
- `GHL_API_TOKEN`: Your GoHighLevel Private API Token (`pit-us-...`)
- `GHL_LOCATION_ID`: Location ID (`cckHAePWlX9aGnx16fQI`)

