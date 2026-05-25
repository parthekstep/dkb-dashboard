import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Card, SkeletonCard } from '../components/Card.jsx';
import { fmtNum, fmtPct } from '../lib/metrics.js';

const PIE_COLORS = ['#22C55E', '#EF4444', '#F59E0B', '#1F3864', '#3B82F6', '#8B5CF6'];

export function Overview({ metrics, loading }) {
  const jobStatusData = Object.entries(metrics.jobStatusBreakdown).map(
    ([name, value]) => ({ name, value })
  );

  return (
    <>
      <Section title="Outcome Metrics — Openings" loading={loading} count={5}>
        <Card
          title="Total Openings (Before Campaign)"
          value={fmtNum(metrics.totalOpeningsBeforeCampaign)}
          subtext="Vacancies across all contacted companies"
        />
        <Card
          title="Active Openings"
          value={fmtNum(metrics.totalOpeningsActive)}
          subtext={`${fmtPct(metrics.activeOpeningRate)} of total openings`}
          borderColor="#22C55E"
        />
        <Card
          title="Closed Openings"
          value={fmtNum(metrics.totalOpeningsClosed)}
          subtext={`${fmtPct(metrics.closedOpeningRate)} — positions filled`}
          borderColor="#EF4444"
        />
        <Card
          title="Unresolved Openings"
          value={fmtNum(metrics.totalOpeningsUnresolved)}
          subtext={`${fmtPct(metrics.unresolvedOpeningRate)} — not confirmed`}
          borderColor="#F59E0B"
        />
        <Card
          title="New Openings Captured"
          value={fmtNum(metrics.totalNewOpenings)}
          subtext="From new jobs posted this campaign"
          borderColor="#3B82F6"
        />
      </Section>

      <Section title="Outcome Metrics — Companies" loading={loading} count={5}>
        <Card
          title="Companies Called"
          value={fmtNum(metrics.uniqueCompaniesCount)}
          subtext="Unique phone numbers"
        />
        <Card
          title="Jobs Confirmed Active"
          value={fmtNum(metrics.companiesActive)}
          subtext={`${fmtPct(metrics.activeCompanyRate)} of companies called`}
          borderColor="#22C55E"
        />
        <Card
          title="Jobs Confirmed Closed"
          value={fmtNum(metrics.companiesClosed)}
          subtext={`${fmtPct(metrics.closedCompanyRate)} — no longer hiring`}
          borderColor="#EF4444"
        />
        <Card
          title="Unresolved"
          value={fmtNum(metrics.companiesUnresolved)}
          subtext={`${fmtPct(metrics.unresolvedCompanyRate)} — no confirmation`}
          borderColor="#F59E0B"
        />
        <Card
          title="New Jobs Discussed"
          value={fmtNum(metrics.companiesWithNewJobs)}
          subtext="Companies that mentioned a new role"
          borderColor="#3B82F6"
        />
      </Section>

      <Section title="Call Metrics" loading={loading} count={5}>
        <Card title="Total Calls" value={fmtNum(metrics.totalCalls)} />
        <Card
          title="Answered Calls"
          value={fmtNum(metrics.answeredCalls)}
          subtext={`${fmtPct(metrics.pickupRate)} pickup rate`}
          borderColor="#22C55E"
        />
        <Card
          title="Unanswered"
          value={fmtNum(metrics.unansweredCalls)}
          borderColor="#EF4444"
        />
        <Card
          title="Productive Conversations"
          value={fmtPct(metrics.productiveRate)}
          subtext={`${fmtNum(metrics.productiveCalls)} calls — answered + over 30 seconds`}
          borderColor="#F59E0B"
        />
        <Card
          title="Avg Call Duration"
          value={`${metrics.avgDurationAnswered.toFixed(1)} sec`}
          subtext="Answered calls only"
        />
      </Section>

      <section className="mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#F8F9FA] rounded-lg p-4">
            <h3 className="text-base font-semibold text-[#1F3864] mb-3">Calls by Day</h3>
            {loading ? (
              <div className="h-72 bg-gray-100 rounded animate-pulse" />
            ) : metrics.callsByDay.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-sm text-gray-500">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.callsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#1F3864" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-[#F8F9FA] rounded-lg p-4">
            <h3 className="text-base font-semibold text-[#1F3864] mb-3">Job Status Breakdown</h3>
            {loading ? (
              <div className="h-72 bg-gray-100 rounded animate-pulse" />
            ) : jobStatusData.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-sm text-gray-500">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={jobStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    label={(d) => `${d.name}: ${d.value}`}
                  >
                    {jobStatusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <DropReasonsTable
        breakdown={metrics.dropReasonBreakdown}
        dropPopulationCount={metrics.dropPopulationCount}
        totalCalls={metrics.totalCalls}
        loading={loading}
      />
    </>
  );
}

const DROP_REASON_ORDER = [
  'Audio or Comprehension Issues',
  'Hung Up Immediately',
  'Hung Up Mid-Conversation',
  'Silent / No Response',
  'Busy / Call Back Requested',
  'Bot Stuck / Phase Loop',
  'Owner Refused / Declined',
  'Wrong Person / Owner Unavailable',
];

function DropReasonsTable({ breakdown, dropPopulationCount, totalCalls, loading }) {
  const entries = Object.entries(breakdown || {});
  const total = dropPopulationCount ?? entries.reduce((s, [, v]) => s + v, 0);
  const pctOfTotal = totalCalls > 0 ? (total / totalCalls) * 100 : 0;

  // Sort: canonical order first (when present), then any extras by count desc.
  const ordered = [];
  for (const k of DROP_REASON_ORDER) {
    if (breakdown && Object.prototype.hasOwnProperty.call(breakdown, k)) {
      ordered.push([k, breakdown[k]]);
    }
  }
  const extras = entries
    .filter(([k]) => !DROP_REASON_ORDER.includes(k))
    .sort((a, b) => b[1] - a[1]);
  const rows = [...ordered, ...extras];

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-[#1F3864] mb-1">Drop Reasons</h2>
      <p className="text-xs text-gray-500 mb-3">
        {loading
          ? 'Loading…'
          : total === 0
          ? 'No mid-journey drop-offs in the current filter.'
          : `Among ${fmtNum(total)} mid-journey drop-offs (${pctOfTotal.toFixed(1)}% of ${fmtNum(totalCalls)} calls)`}
      </p>
      <div className="bg-[#F8F9FA] rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 || total === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No data</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white border-b border-gray-200">
              <tr className="text-left text-xs font-medium text-gray-600 uppercase">
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Count</th>
                <th className="px-4 py-3">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, count]) => {
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <tr
                    key={name}
                    className="border-b border-gray-200 last:border-0 hover:bg-white/60"
                  >
                    <td className="px-4 py-3 text-gray-700">{name}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtNum(count)}</td>
                    <td className="px-4 py-3 text-gray-700 w-1/2">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-200 rounded overflow-hidden">
                          <div
                            className="h-full bg-[#1F3864]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 w-12 text-right">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-white border-t border-gray-300 font-semibold">
                <td className="px-4 py-3 text-gray-700">Total</td>
                <td className="px-4 py-3 text-gray-700">{fmtNum(total)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Section({ title, loading, count, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-[#1F3864] mb-3">{title}</h2>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {children}
        </div>
      )}
    </section>
  );
}
