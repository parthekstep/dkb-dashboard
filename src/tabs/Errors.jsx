import { useMemo, useState } from 'react';
import { Card, SkeletonCard } from '../components/Card.jsx';
import { fmtNum } from '../lib/metrics.js';

const truthy = (v) => String(v ?? '').trim().toLowerCase() === 'true';
const lc = (v) => String(v ?? '').trim().toLowerCase();

function parseTimestamp(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +se) - 5.5 * 3600 * 1000;
}

export function computeErrorBadge(rows) {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  return rows.reduce((n, r) => {
    const t = parseTimestamp(r.timestamp_ist);
    return n + (t !== null && t >= cutoff ? 1 : 0);
  }, 0);
}

function TaskPill({ task }) {
  const t = lc(task);
  const cls = t === 'extract' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{task || '—'}</span>;
}

function StatusBadge({ retryAttempted, retrySucceeded }) {
  if (!retryAttempted) {
    return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">No retry</span>;
  }
  if (retrySucceeded) {
    return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Recovered</span>;
  }
  return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Failed</span>;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function Errors({ rows, loading, error, onRetry }) {
  const [taskFilter, setTaskFilter] = useState('all');

  const summary = useMemo(() => {
    const total = rows.length;
    const cutoff = Date.now() - 24 * 3600 * 1000;
    let last24 = 0;
    let retried = 0;
    let recovered = 0;
    let extractCount = 0;
    for (const r of rows) {
      const t = parseTimestamp(r.timestamp_ist);
      if (t !== null && t >= cutoff) last24 += 1;
      const ra = truthy(r.retry_attempted);
      const rs = truthy(r.retry_succeeded);
      if (ra) retried += 1;
      if (ra && rs) recovered += 1;
      if (lc(r.task) === 'extract') extractCount += 1;
    }
    return {
      total,
      last24,
      retrySuccessRate: retried > 0 ? (recovered / retried) * 100 : null,
      extractCount,
    };
  }, [rows]);

  const sortedFiltered = useMemo(() => {
    const filtered = taskFilter === 'all'
      ? rows
      : rows.filter((r) => lc(r.task) === taskFilter);
    const withTs = filtered.map((r) => ({ r, t: parseTimestamp(r.timestamp_ist) ?? -Infinity }));
    withTs.sort((a, b) => b.t - a.t);
    return withTs.map((x) => x.r);
  }, [rows, taskFilter]);

  if (error) {
    return (
      <div className="border border-red-300 bg-red-50 rounded p-4 mb-6 flex items-center justify-between">
        <span className="text-sm text-red-700">Failed to load errors: {error}</span>
        <button onClick={onRetry} className="bg-red-600 text-white rounded px-3 py-1.5 text-sm">Retry</button>
      </div>
    );
  }

  return (
    <>
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[#1F3864] mb-3">Error Summary</h2>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card title="Total Errors" value={fmtNum(summary.total)} />
            <Card title="Last 24 Hours" value={fmtNum(summary.last24)} borderColor="#EF4444" />
            <Card
              title="Retry Success Rate"
              value={summary.retrySuccessRate === null ? 'N/A' : `${summary.retrySuccessRate.toFixed(0)}%`}
              borderColor="#F59E0B"
              subtext="Recovered ÷ retried"
            />
            <Card title="Errors by Task">
              <div className="mt-2">
                <div className="text-xs text-gray-500">Extract</div>
                <div className="text-2xl font-semibold text-[#1F3864]">{fmtNum(summary.extractCount)}</div>
              </div>
            </Card>
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-[#1F3864]">Errors</h2>
          <div className="flex items-center gap-1">
            {[
              { k: 'all', label: 'All Tasks' },
              { k: 'extract', label: 'Extract' },
            ].map((opt) => (
              <button
                key={opt.k}
                onClick={() => setTaskFilter(opt.k)}
                className={`px-3 py-1.5 text-sm rounded border ${
                  taskFilter === opt.k
                    ? 'bg-[#1F3864] text-white border-[#1F3864]'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#F8F9FA] rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          ) : sortedFiltered.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">No errors to display.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white border-b border-gray-200">
                  <tr className="text-left text-xs font-medium text-gray-600 uppercase">
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Call ID</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Error Message</th>
                    <th className="px-4 py-3">Retry</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFiltered.map((r, idx) => {
                    const ra = truthy(r.retry_attempted);
                    const rs = truthy(r.retry_succeeded);
                    const callId = r.call_id ?? '';
                    const shortCallId = callId.length > 8 ? callId.slice(0, 8) + '…' : callId;
                    return (
                      <tr key={idx} className="border-b border-gray-200 last:border-0 hover:bg-white/60">
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.timestamp_ist || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700" title={callId}>{shortCallId || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{r.phone || '—'}</td>
                        <td className="px-4 py-3"><TaskPill task={r.task} /></td>
                        <td className="px-4 py-3 text-gray-700 max-w-md" title={r.error_message || ''}>
                          {truncate(r.error_message, 80) || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{ra ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-3"><StatusBadge retryAttempted={ra} retrySucceeded={rs} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
