export function parseVacancies(val) {
  if (val === null || val === undefined) return 0;
  const s = String(val).trim().toLowerCase();
  if (!s || s === 'not available' || s === 'na' || s === 'nan') return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

export function isAnswered(row) {
  const v = String(row.call_outcome ?? '').trim().toLowerCase();
  return v && v !== 'no answer' && v !== 'nan';
}

export function extractDateStr(s) {
  if (typeof s !== 'string') return '';
  const cleaned = s.replace(/\s*IST\s*$/i, '').trim();
  return cleaned.slice(0, 10);
}

export function fmtPct(n) {
  return (Number.isFinite(n) ? n.toFixed(1) : '0.0') + '%';
}

export function fmtNum(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

const lc = (v) => String(v ?? '').trim().toLowerCase();

export function computeMetrics(rows) {
  const totalCalls = rows.length;
  const answeredRows = rows.filter(isAnswered);
  const answeredCalls = answeredRows.length;
  const unansweredCalls = totalCalls - answeredCalls;
  const productiveCalls = answeredRows.filter(
    (r) => (parseFloat(r.call_duration_seconds) || 0) >= 30
  ).length;

  const activeRows = rows.filter((r) => lc(r.job_status) === 'active');
  const closedRows = rows.filter((r) => lc(r.job_status) === 'closed');
  const unresolvedRows = rows.filter((r) => {
    const v = lc(r.job_status);
    return v !== 'active' && v !== 'closed';
  });

  const sumVac = (list, key) =>
    list.reduce((s, r) => s + parseVacancies(r[key]), 0);

  const totalOpeningsBeforeCampaign = sumVac(rows, 'num_vacancies_input');
  const totalOpeningsActive = sumVac(activeRows, 'num_vacancies_input');
  const totalOpeningsClosed = sumVac(closedRows, 'num_vacancies_input');
  const totalOpeningsUnresolved = sumVac(unresolvedRows, 'num_vacancies_input');
  const totalNewOpenings = sumVac(rows, 'new_job_vacancies');

  const uniquePhones = new Set();
  for (const r of rows) {
    const p = String(r.contact_phone ?? '').trim();
    if (p && p.toLowerCase() !== 'nan') uniquePhones.add(p);
  }
  const uniqueCompaniesCount = uniquePhones.size;

  const companiesActive = activeRows.length;
  const companiesClosed = closedRows.length;
  const companiesUnresolved = Math.max(
    uniqueCompaniesCount - companiesActive - companiesClosed,
    0
  );
  const companiesWithNewJobs = rows.filter(
    (r) => lc(r.new_job_mentioned) === 'yes' || lc(r.new_job_posted) === 'yes'
  ).length;

  const pct = (a, b) => (b > 0 ? (a / b) * 100 : 0);

  const avgDurationAnswered =
    answeredCalls > 0
      ? answeredRows.reduce(
          (s, r) => s + (parseFloat(r.call_duration_seconds) || 0),
          0
        ) / answeredCalls
      : 0;

  const callsByDayMap = {};
  for (const r of rows) {
    const d = extractDateStr(r.call_datetime_ist);
    if (!d) continue;
    callsByDayMap[d] = (callsByDayMap[d] || 0) + 1;
  }
  const callsByDay = Object.entries(callsByDayMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  const bucket = (key) => {
    const map = {};
    for (const r of rows) {
      const v = String(r[key] ?? '').trim() || 'Unknown';
      map[v] = (map[v] || 0) + 1;
    }
    return map;
  };

  return {
    totalOpeningsBeforeCampaign,
    totalOpeningsActive,
    totalOpeningsClosed,
    totalOpeningsUnresolved,
    totalNewOpenings,
    activeOpeningRate: pct(totalOpeningsActive, totalOpeningsBeforeCampaign),
    closedOpeningRate: pct(totalOpeningsClosed, totalOpeningsBeforeCampaign),
    unresolvedOpeningRate: pct(totalOpeningsUnresolved, totalOpeningsBeforeCampaign),

    uniqueCompaniesCount,
    companiesActive,
    companiesClosed,
    companiesUnresolved,
    companiesWithNewJobs,
    activeCompanyRate: pct(companiesActive, uniqueCompaniesCount),
    closedCompanyRate: pct(companiesClosed, uniqueCompaniesCount),
    unresolvedCompanyRate: pct(companiesUnresolved, uniqueCompaniesCount),

    totalCalls,
    answeredCalls,
    unansweredCalls,
    productiveCalls,
    pickupRate: pct(answeredCalls, totalCalls),
    productiveRate: pct(productiveCalls, answeredCalls),
    avgDurationAnswered,

    callsByDay,
    cityBreakdown: bucket('city_campaign'),
    languageBreakdown: bucket('language'),
    phaseBreakdown: bucket('phases_reached'),
    jobStatusBreakdown: bucket('job_status'),
    dropReasonBreakdown: bucket('drop_reason'),
  };
}
