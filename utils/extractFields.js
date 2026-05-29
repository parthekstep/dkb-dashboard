import OpenAI from 'openai';
import { appendCallRecord } from './sheets.js';

const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    call_status: {
      type: 'string',
      enum: ['Not answered', 'Answered and dropped', 'Answered and partial', 'Answered and completed'],
    },
    phases_reached: {
      type: 'string',
      enum: ['Not Called', 'Phase 1', 'Phase 1 and 2', 'Phase 1, 2 and 3', 'Phase 3 only'],
    },
    job_status: {
      type: 'string',
      enum: ['Active', 'Closed', 'Unverified'],
    },
    job_role_value: { type: ['string', 'null'] },
    num_vacancies_value: { type: ['number', 'null'] },
    salary_value: { type: ['string', 'null'] },
    location_value: { type: ['string', 'null'] },
    qualification_value: { type: ['string', 'null'] },
    fields_updated: { type: ['string', 'null'] },
    new_job_mentioned: { type: 'string', enum: ['Yes', 'No'] },
    new_job_role: { type: ['string', 'null'] },
    new_job_vacancies: { type: ['number', 'null'] },
    new_job_salary: { type: ['string', 'null'] },
    new_job_location: { type: ['string', 'null'] },
    new_job_qualification: { type: ['string', 'null'] },
    new_job_posted: { type: 'string', enum: ['Yes', 'No'] },
    talent_insights_shown: { type: 'string', enum: ['Yes', 'No'] },
    call_datetime_ist: { type: 'string' },
    final_summary: { type: 'string' },
    call_language: { type: 'string', enum: ['Hindi', 'Kannada', 'English', 'Unknown'] },
    drop_reason: {
      type: ['string', 'null'],
      enum: [
        'Audio or Comprehension Issues',
        'Hung Up Immediately',
        'Hung Up Mid-Conversation',
        'Silent / No Response',
        'Busy / Call Back Requested',
        'Bot Stuck / Phase Loop',
        'Owner Refused / Declined',
        'Wrong Person / Owner Unavailable',
        null,
      ],
    },
  },
  required: [
    'call_status', 'phases_reached', 'job_status',
    'job_role_value', 'num_vacancies_value', 'salary_value', 'location_value', 'qualification_value',
    'fields_updated',
    'new_job_mentioned', 'new_job_role', 'new_job_vacancies', 'new_job_salary',
    'new_job_location', 'new_job_qualification', 'new_job_posted',
    'talent_insights_shown', 'call_datetime_ist', 'final_summary', 'call_language', 'drop_reason',
  ],
};

function buildPrompt({ uuid, duration, transcript_text, outcome, start_time, agent_args }) {
  const a = agent_args || {};
  return `You are analyzing a call transcript from "Dhandhe Ki Baat", a voice AI helping Indian MSME business owners manage job postings on ONEST Blue Dot.

The conversation may be in Hindi, Hinglish, Kannada, or English.

INPUT VARIABLES (pre-filled before the call — use as baseline to detect changes):
- City: ${a.city ?? ''}
- Job ID: ${a.job_id ?? ''}
- Salary: ${a.salary ?? ''}
- Job Role: ${a.job_role ?? ''}
- Location: ${a.location ?? ''}
- Company Name: ${a.company_name ?? ''}
- Number of Vacancies: ${a.num_vacancies ?? ''}
- Qualification: ${a.qualification ?? ''}

CALL DATA:
- Call UUID: ${uuid}
- Duration: ${duration} seconds
- Transcript: ${transcript_text}
- Outcome: ${outcome}
- Start Time: ${start_time}

CORE PRINCIPLE:
Extract only what is explicitly stated or confirmed in the transcript. Do not infer. Do not assume. Do not carry forward input variable values as confirmed unless the owner explicitly confirmed them during the call.

FIELD EXTRACTION RULES:

1. call_status — choose ONE:
- "Not answered" — never picked up
- "Answered and dropped" — picked up but ended within 15 seconds or before useful exchange
- "Answered and partial" — some exchange but did not complete
- "Answered and completed" — all relevant phases completed

2. phases_reached — choose ONE:
- "Not Called" — never connected
- "Phase 1" — only job freshness check reached
- "Phase 1 and 2" — freshness + completeness check reached
- "Phase 1, 2 and 3" — all three phases completed
- "Phase 3 only" — no existing jobs passed, went directly to new job capture

3. job_status — choose ONE:
- "Active" — owner explicitly confirmed job is still open
- "Closed" — owner explicitly said job is filled or no longer needed
- "Unverified" — not answered, dropped before confirmation, or owner was unclear

4. job_role_value — job role confirmed or corrected by owner. Return confirmed input value if owner confirmed without changing. null if not discussed.

5. num_vacancies_value — vacancies confirmed or corrected by owner. Number or null.

6. salary_value — salary explicitly stated or confirmed by owner. String like "18000" or "15000 to 20000". null if not discussed.

7. location_value — work location explicitly stated or confirmed. String or null.

8. qualification_value — required qualification explicitly stated or confirmed. String or null.

9. fields_updated — fields newly provided or corrected vs input variables. A field counts if input was "Not Available"/"NA" and owner provided a value, OR owner explicitly corrected a different value. Comma-separated names from: job_role, num_vacancies, salary, location, qualification. null if nothing updated.

10. new_job_mentioned — "Yes" or "No" — did owner describe a new job role not part of the existing posted job?

11. new_job_role — role title of new job as stated. null if none.

12. new_job_vacancies — vacancies for new job as stated. Number or null.

13. new_job_salary — salary for new job as stated. String or null.

14. new_job_location — work location for new job as stated. String or null.

15. new_job_qualification — qualification for new job as stated. String or null.

16. new_job_posted — "Yes" or "No" — was new job successfully posted? Look for explicit bot confirmation e.g. "हो गया", "post ho gaya", "posted successfully", or Kannada/Hindi equivalent.

17. talent_insights_shown — "Yes" or "No" — did bot show candidate availability, supply density, or salary range for any role?

18. call_datetime_ist — convert start_time to IST format YYYY-MM-DD HH:MM:SS.

19. final_summary — plain English, max 3 sentences. If not answered: "Call was not answered. No data collected." If answered: mention what was confirmed about the existing job, what fields were filled in, and whether any new job was discussed. Do not use technical field names or phase numbers. Write as if briefing a human ops team member.

20. call_language — the primary language the BOT used to speak with the owner. "Hindi" if the bot spoke Hindi/Hinglish (Devanagari script), "Kannada" if the bot spoke Kannada (Kannada script), "English" if predominantly English, "Unknown" if it cannot be determined. This determines the campaign city (Hindi → Ghaziabad, Kannada → Hubli-Dharwad).

21. drop_reason — categorise WHY the call dropped off mid-journey. The journey has three phases: (1) confirm existing job is still open, (2) confirm completeness of job details, (3) capture any new job.

EMIT NULL (do not categorise) WHEN:
- call_status is "Not answered" — no journey started.
- OR the owner gave a clear yes/no on the existing job status AND gave a clear yes/no on whether they have a new job. The journey is complete; it is not a drop.

OTHERWISE choose ONE of these 8 buckets. The journey started but did not finish:
- "Audio or Comprehension Issues" — bot consistently could not understand the owner. Triggers: frequent "*No audio*" / "*User is speaking softly*" markers, repeated "क्या?", bot asks the same question multiple times because it didn't catch the answer, owner audible but bot keeps mis-parsing. Includes language mismatch and network/audio failures — they look identical in transcript.
- "Hung Up Immediately" — owner picked up, said little or nothing (just "hello" or silence), and call ended within ~15 seconds. Owner heard the AI pitch and dropped.
- "Hung Up Mid-Conversation" — owner engaged for more than 15 seconds and gave at least one real response, then disconnected before the journey reached resolution.
- "Silent / No Response" — owner picked up and stayed on the line for >15 seconds but produced essentially no audible speech; bot filled the call with prompts and eventually ended it. Distinct from "Hung Up Immediately" because the call did not end fast.
- "Busy / Call Back Requested" — owner explicitly deferred. Triggers: "abhi busy hu", "baad me call karna", "kal", "meeting me hu".
- "Bot Stuck / Phase Loop" — bot asked the same question repeatedly within one phase; owner gave responses but conversation failed to advance. Call ended without owner refusing or hanging up — the bot itself got stuck.
- "Owner Refused / Declined" — owner picked up, engaged briefly, and explicitly said no — "interest nahi hai", "nahi karna", refused to confirm or share info.
- "Wrong Person / Owner Unavailable" — someone other than the owner picked up, or owner was said to be unavailable. Triggers: "owner nahi hai", "galat number", "main employee hu", "boss nahi hai".

Pick the SINGLE dominant reason if multiple seem to apply.

OUTPUT: Valid JSON only. No explanations. All fields required. Use null for string/number fields not discussed. Do not return empty strings.`;
}

export async function extractAndLog(payload) {
  const body = payload?.body ?? {};
  const uuid = body.uuid;
  const phone = body.to_number ?? '';
  const duration = body.call_duration;
  const start_time = body.call_start_time ?? '';
  const outcome = body.outcome ?? '';
  const recording_url = body.call_recording_url ?? '';
  const transcript = Array.isArray(body.call_transcript) ? body.call_transcript : [];
  const agent_args = body.agent_args || {};

  const transcript_text = transcript
    .filter((t) => t?.content !== null && t?.content !== undefined)
    .map((t) => t.content)
    .join(' ');

  const raw_transcript_str = JSON.stringify(body.call_transcript);
  const raw_transcript = raw_transcript_str.length > 40000
    ? raw_transcript_str.slice(0, 40000) + '…"]'
    : raw_transcript_str;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildPrompt({ uuid, duration, transcript_text, outcome, start_time, agent_args }) },
      { role: 'user', content: 'Extract the fields now.' },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'DkbExtraction', strict: true, schema: extractionSchema },
    },
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content for extraction');
  const m = JSON.parse(content);

  const campaign_date = typeof start_time === 'string' && start_time.includes('T')
    ? start_time.split('T')[0]
    : '';

  // City is determined by the call language, not by the (often messy) agent_args.city.
  const cityByLanguage = m.call_language === 'Hindi' ? 'Ghaziabad'
    : m.call_language === 'Kannada' ? 'Hubli-Dharwad'
    : '';

  // 39-column row in exact order per spec.
  const row = [
    '',                                //  1  campaign_day         (manual)
    campaign_date,                     //  2  campaign_date
    '',                                //  3  campaign_type        (manual)
    phone,                             //  4  contact_phone
    agent_args.job_id ?? '',           //  5  job_id
    cityByLanguage,                    //  6  city_campaign (derived from language)
    m.call_language ?? '',             //  7  language (detected by LLM)
    agent_args.company_name ?? '',     //  8  company_name
    agent_args.job_role ?? '',         //  9  job_role_input
    agent_args.num_vacancies ?? '',    // 10  num_vacancies_input
    agent_args.city ?? '',             // 11  city_input
    agent_args.location ?? '',         // 12  location_input
    agent_args.salary ?? '',           // 13  salary_input
    agent_args.qualification ?? '',    // 14  qualification_input
    uuid,                              // 15  call_id
    duration,                          // 16  call_duration_seconds
    m.call_datetime_ist,               // 17  call_datetime_ist
    recording_url,                     // 18  call_recording_url
    outcome,                           // 19  call_outcome
    m.call_status,                     // 20  call_status
    1,                                 // 21  contact_attempts
    m.phases_reached,                  // 22  phases_reached
    m.job_status,                      // 23  job_status
    m.job_role_value ?? '',            // 24  job_role_value
    m.num_vacancies_value ?? '',       // 25  num_vacancies_value
    m.salary_value ?? '',              // 26  salary_value
    m.location_value ?? '',            // 27  location_value
    m.qualification_value ?? '',       // 28  qualification_value
    m.fields_updated ?? '',            // 29  fields_updated
    m.new_job_mentioned,               // 30  new_job_mentioned
    m.new_job_role ?? '',              // 31  new_job_role
    m.new_job_vacancies ?? '',         // 32  new_job_vacancies
    m.new_job_salary ?? '',            // 33  new_job_salary
    m.new_job_location ?? '',          // 34  new_job_location
    m.new_job_qualification ?? '',     // 35  new_job_qualification
    m.new_job_posted,                  // 36  new_job_posted
    m.talent_insights_shown,           // 37  talent_insights_shown
    m.final_summary,                   // 38  final_summary
    raw_transcript,                    // 39  call_transcript
    m.drop_reason,                     // 40  drop_reason
  ];

  await appendCallRecord(row);
}
