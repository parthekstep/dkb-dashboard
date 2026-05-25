// One-shot backfill for the drop_reason column (Master!AN).
// Usage:  node --env-file=.env.local scripts/backfill-drop-reason.js
//
// Idempotent: rows that already have drop_reason populated are skipped.
// Trivial classifications (no-answer / cleanly-completed) are written directly
// without an LLM call. Everything else is sent to gpt-4o-mini.

import OpenAI from 'openai';
import { getSheetsClient } from '../utils/sheets.js';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CONCURRENCY = 8;
const BATCH_WRITE_SIZE = 100;
const BATCH_WRITE_PAUSE_MS = 1200;

const DROP_REASON_ENUM = [
  'Audio or Comprehension Issues',
  'Hung Up Immediately',
  'Hung Up Mid-Conversation',
  'Silent / No Response',
  'Busy / Call Back Requested',
  'Bot Stuck / Phase Loop',
  'Owner Refused / Declined',
  'Wrong Person / Owner Unavailable',
];

const dropReasonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    drop_reason: {
      type: ['string', 'null'],
      enum: [...DROP_REASON_ENUM, null],
    },
  },
  required: ['drop_reason'],
};

function buildPrompt(row) {
  const agent_args_summary = [
    `Job role: ${row.job_role_input || 'NA'}`,
    `Vacancies: ${row.num_vacancies_input || 'NA'}`,
    `Salary: ${row.salary_input || 'NA'}`,
    `Location: ${row.location_input || 'NA'}`,
    `Qualification: ${row.qualification_input || 'NA'}`,
    `City: ${row.city_campaign || ''}`,
  ].join('\n');

  return `You are categorising a DKB voice-AI call between an Indian MSME owner and a bot that confirms job postings on ONEST Blue Dot. The owner journey has three phases: (1) confirm existing job is still open, (2) confirm job details, (3) capture any new job.

INPUT (existing job baseline):
${agent_args_summary}

CALL DATA:
- Duration: ${row.call_duration_seconds} seconds
- Outcome: ${row.call_outcome}
- call_status: ${row.call_status}
- phases_reached: ${row.phases_reached}
- job_status: ${row.job_status}
- new_job_mentioned: ${row.new_job_mentioned}
- new_job_posted: ${row.new_job_posted}
- Transcript: ${row.call_transcript || '(empty)'}

TASK — emit ONE field: drop_reason.

EMIT NULL when:
- call_status is "Not answered"
- OR the owner gave a clear yes/no on the existing job AND a clear yes/no on whether they have a new job (the journey is complete).

OTHERWISE pick ONE of these 8 buckets (journey started but did not finish):
- "Audio or Comprehension Issues" — bot consistently could not understand owner. Frequent "*No audio*" / "*User is speaking softly*", repeated "क्या?", bot asks same question multiple times. Includes language mismatch and network audio failures.
- "Hung Up Immediately" — picked up, said "hello" or silence, call ended within ~15 seconds.
- "Hung Up Mid-Conversation" — owner engaged >15s with at least one real response, then disconnected before journey resolved.
- "Silent / No Response" — picked up, stayed on line >15s, but produced essentially no audible speech.
- "Busy / Call Back Requested" — owner explicitly deferred ("baad me", "kal", "busy hu").
- "Bot Stuck / Phase Loop" — bot asked same question repeatedly; conversation failed to advance.
- "Owner Refused / Declined" — owner engaged briefly and explicitly said no.
- "Wrong Person / Owner Unavailable" — someone other than the owner picked up, or owner unavailable.

Pick the single dominant reason if multiple apply. Output valid JSON only.`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isCleanlyCompleted(row) {
  // Owner gave clear yes/no on existing job AND on new job — journey finished.
  const jobStatus = (row.job_status || '').trim();
  const newJob = (row.new_job_mentioned || '').trim();
  const newJobPosted = (row.new_job_posted || '').trim();
  const hasJobDecision = jobStatus === 'Active' || jobStatus === 'Closed';
  const hasNewJobDecision = newJob === 'No' || (newJob === 'Yes' && newJobPosted);
  return hasJobDecision && hasNewJobDecision;
}

function isNotAnswered(row) {
  return (row.call_status || '').trim() === 'Not answered'
    || (row.call_outcome || '').trim().toLowerCase() === 'no answer';
}

async function classifyOne(openai, row) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildPrompt(row) },
      { role: 'user', content: 'Return the drop_reason now.' },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'DropReason', strict: true, schema: dropReasonSchema },
    },
  });
  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty completion');
  return JSON.parse(content).drop_reason;
}

async function runBatch(items, fn, concurrency) {
  let i = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

async function flushBatchWrite(sheets, pending) {
  if (pending.length === 0) return;
  const data = pending.map(({ rowIndex, value }) => ({
    range: `Master!AN${rowIndex}`,
    values: [[value === null ? '' : value]],
  }));
  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });
  } catch (e) {
    if (e?.code === 429 || e?.response?.status === 429) {
      console.warn('429 rate-limited; backing off 8s');
      await sleep(8000);
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data },
      });
    } else {
      throw e;
    }
  }
  await sleep(BATCH_WRITE_PAUSE_MS);
}

async function main() {
  if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID not set');
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const sheets = getSheetsClient();

  console.log('Reading Master tab…');
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Master!A:AN',
  });
  const all = data.values ?? [];
  if (all.length < 2) {
    console.log('No data rows.');
    return;
  }
  const header = all[0];
  const colIdx = Object.fromEntries(header.map((h, i) => [h, i]));
  const required = [
    'call_outcome', 'call_status', 'phases_reached', 'job_status',
    'new_job_mentioned', 'new_job_posted', 'call_transcript',
    'call_duration_seconds', 'call_id',
    'job_role_input', 'num_vacancies_input', 'salary_input',
    'location_input', 'qualification_input', 'city_campaign',
  ];
  for (const k of required) {
    if (!(k in colIdx)) console.warn(`Header column missing: ${k}`);
  }

  // Build rows[] with row indices (1-based for sheets API; header is row 1, data starts row 2)
  const rows = [];
  for (let i = 1; i < all.length; i++) {
    const r = all[i];
    const obj = { _rowIndex: i + 1 };
    for (const [k, idx] of Object.entries(colIdx)) obj[k] = r[idx] ?? '';
    rows.push(obj);
  }
  console.log(`${rows.length} data rows.`);

  const counts = {
    skippedAlreadyPopulated: 0,
    nullNotAnswered: 0,
    nullCompleted: 0,
    classifiedByLLM: 0,
    failed: 0,
  };
  const byBucket = {};

  let pending = [];
  let processed = 0;

  const drainIfFull = async () => {
    if (pending.length >= BATCH_WRITE_SIZE) {
      const chunk = pending.splice(0, BATCH_WRITE_SIZE);
      await flushBatchWrite(sheets, chunk);
    }
  };

  await runBatch(rows, async (row) => {
    processed += 1;
    if (processed % 25 === 0) console.log(`  …processed ${processed}/${rows.length}`);

    // Skip if already populated.
    if ((row.drop_reason || '').trim()) {
      counts.skippedAlreadyPopulated += 1;
      return;
    }

    // Trivial: not answered.
    if (isNotAnswered(row)) {
      counts.nullNotAnswered += 1;
      pending.push({ rowIndex: row._rowIndex, value: null });
      await drainIfFull();
      return;
    }

    // Trivial: cleanly completed.
    if (isCleanlyCompleted(row)) {
      counts.nullCompleted += 1;
      pending.push({ rowIndex: row._rowIndex, value: null });
      await drainIfFull();
      return;
    }

    // LLM classification.
    try {
      const value = await classifyOne(openai, row);
      counts.classifiedByLLM += 1;
      if (value === null) counts.nullCompleted += 1;
      else byBucket[value] = (byBucket[value] || 0) + 1;
      pending.push({ rowIndex: row._rowIndex, value });
      await drainIfFull();
    } catch (e) {
      counts.failed += 1;
      console.warn(`  row ${row._rowIndex} (${row.call_id || '?'}): ${e?.message}`);
    }
  }, CONCURRENCY);

  // Final flush.
  while (pending.length > 0) {
    const chunk = pending.splice(0, BATCH_WRITE_SIZE);
    await flushBatchWrite(sheets, chunk);
  }

  console.log('\n=== Backfill complete ===');
  console.log(`Skipped (already populated):     ${counts.skippedAlreadyPopulated}`);
  console.log(`Null (not answered):             ${counts.nullNotAnswered}`);
  console.log(`Null (cleanly completed):        ${counts.nullCompleted}`);
  console.log(`Classified by LLM:               ${counts.classifiedByLLM}`);
  console.log(`Failed:                          ${counts.failed}`);
  console.log('\nBucket distribution (LLM-classified drops):');
  const total = Object.values(byBucket).reduce((a, b) => a + b, 0);
  Object.entries(byBucket)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => {
      const pct = total > 0 ? ((100 * v) / total).toFixed(1) : '0.0';
      console.log(`  ${k.padEnd(40)} ${String(v).padStart(4)}  ${pct}%`);
    });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
