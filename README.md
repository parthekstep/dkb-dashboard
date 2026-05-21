# Dhandhe Ki Baat (DKB) — Webhook Service

Vercel-deployed Node.js webhook for the DKB voice agent (Bolna/Raya). Receives one POST per call, extracts structured fields from the transcript via GPT-4o-mini, and appends a row to Google Sheets.

## Endpoints

- `POST /api/webhook` — main receiver
- `GET /api/health` — `{ status: "ok", service: "dkb-webhook" }`

## Setup

### 1. Google Sheet

Create a new Google Sheet with two tabs:

**Sheet1** — header row (39 columns, in this exact order):
```
campaign_day | campaign_date | campaign_type | contact_phone | job_id | city_campaign | language | company_name | job_role_input | num_vacancies_input | city_input | location_input | salary_input | qualification_input | call_id | call_duration_seconds | call_datetime_ist | call_recording_url | call_outcome | call_status | contact_attempts | phases_reached | job_status | job_role_value | num_vacancies_value | salary_value | location_value | qualification_value | fields_updated | new_job_mentioned | new_job_role | new_job_vacancies | new_job_salary | new_job_location | new_job_qualification | new_job_posted | talent_insights_shown | final_summary | call_transcript
```

**Errors** — header row (8 columns):
```
timestamp_ist | call_id | phone | task | error_message | stack_trace | retry_attempted | retry_succeeded
```

Share the sheet with your Google service account email (Editor access).

### 2. Service account → base64

```bash
base64 -i service-account.json | tr -d '\n'
```

Copy the output and set as the `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` env var.

### 3. Environment variables (Vercel dashboard)

| Var | Value |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI key with access to `gpt-4o-mini` |
| `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` | base64 of `service-account.json` |
| `SPREADSHEET_ID` | ID portion of your sheet URL |

### 4. Deploy

```bash
npm install
vercel --prod
```

Then set the DKB Bolna/Raya webhook URL to `https://<your-project>.vercel.app/api/webhook`.

## Local testing

```bash
npm install
vercel dev
# POST a sample payload to http://localhost:3000/api/webhook
```

## How it works

1. Webhook validates `body.uuid` and `body.call_transcript`; returns `400` if missing.
2. Returns `200 { status: "received", call_id }` immediately.
3. `waitUntil` runs `extractAndLog` in the background:
   - One `gpt-4o-mini` call (strict JSON schema) extracts 19 fields from the transcript.
   - Row appended to `Sheet1`.
4. If the extraction throws, retries once after 2s. Logs to `Errors` on any failure or recovered retry.

## Dashboard

The React/Vite analytics dashboard lives at the repo root alongside the webhook (`src/`, `index.html`). One `npm install`, one Vercel project: `vercel build` produces the static dashboard while `api/*.js` are deployed as serverless functions.

```bash
npm install
npm run dev   # http://localhost:5173 — dashboard
```
