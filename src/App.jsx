import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCsv, MAIN_CSV_URL, ERRORS_CSV_URL } from './lib/csv.js';
import { computeMetrics, extractDateStr, normalizeCity } from './lib/metrics.js';
import { FilterBar } from './components/FilterBar.jsx';
import { Overview } from './tabs/Overview.jsx';
import { Errors, computeErrorBadge } from './tabs/Errors.jsx';

const TABS = [
  { k: 'overview', label: 'Overview' },
  { k: 'errors', label: 'Errors' },
];

function uniqueSorted(rows, key) {
  const s = new Set();
  for (const r of rows) {
    const v = String(r[key] ?? '').trim();
    if (v && v.toLowerCase() !== 'nan') s.add(v);
  }
  return [...s].sort();
}

function dayKey(s) {
  const m = String(s ?? '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : Infinity;
}

export default function App() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [errorRows, setErrorRows] = useState([]);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [errorsLoaded, setErrorsLoaded] = useState(false);
  const [errorsError, setErrorsError] = useState(null);

  const [activeTab, setActiveTab] = useState('overview');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [campaignType, setCampaignType] = useState('');
  const [campaignDay, setCampaignDay] = useState('');
  const [city, setCity] = useState('');
  const [language, setLanguage] = useState('');

  const fetchMain = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchCsv(MAIN_CSV_URL)
      .then((data) => { setRows(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const fetchErrors = useCallback(() => {
    setErrorsLoading(true);
    setErrorsError(null);
    fetchCsv(ERRORS_CSV_URL)
      .then((data) => { setErrorRows(data); setErrorsLoading(false); setErrorsLoaded(true); })
      .catch((e) => { setErrorsError(e.message); setErrorsLoading(false); });
  }, []);

  useEffect(() => { fetchMain(); }, [fetchMain]);

  useEffect(() => {
    if (activeTab === 'errors' && !errorsLoaded && !errorsLoading) {
      fetchErrors();
    }
  }, [activeTab, errorsLoaded, errorsLoading, fetchErrors]);

  const campaignTypes = useMemo(() => uniqueSorted(rows, 'campaign_type'), [rows]);
  const campaignDays = useMemo(
    () => uniqueSorted(rows, 'campaign_day').sort((a, b) => dayKey(a) - dayKey(b)),
    [rows]
  );
  const cities = useMemo(() => {
    const s = new Set();
    for (const r of rows) {
      const c = normalizeCity(r);
      if (c) s.add(c);
    }
    return [...s].sort();
  }, [rows]);
  const languages = useMemo(() => uniqueSorted(rows, 'language'), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const d = extractDateStr(r.campaign_date);
      if (startDate && (!d || d < startDate)) return false;
      if (endDate && (!d || d > endDate)) return false;
      if (campaignType && String(r.campaign_type ?? '').trim() !== campaignType) return false;
      if (campaignDay && String(r.campaign_day ?? '').trim() !== campaignDay) return false;
      if (city && normalizeCity(r) !== city) return false;
      if (language && String(r.language ?? '').trim() !== language) return false;
      return true;
    });
  }, [rows, startDate, endDate, campaignType, campaignDay, city, language]);

  const metrics = useMemo(() => computeMetrics(filteredRows), [filteredRows]);
  const errorBadge = useMemo(() => computeErrorBadge(errorRows), [errorRows]);

  const resetFilters = () => {
    setStartDate(''); setEndDate('');
    setCampaignType(''); setCampaignDay('');
    setCity(''); setLanguage('');
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-semibold text-[#1F3864]">
            Dhandhe Ki Baat — Analytics Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Voice AI helping Indian MSME owners manage ONEST Blue Dot job postings
          </p>
          <div className="mt-4 flex items-center gap-1">
            {TABS.map((opt) => (
              <button
                key={opt.k}
                onClick={() => setActiveTab(opt.k)}
                className={`px-3 py-1.5 text-sm rounded border inline-flex items-center gap-2 ${
                  activeTab === opt.k
                    ? 'bg-[#1F3864] text-white border-[#1F3864]'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span>{opt.label}</span>
                {opt.k === 'errors' && errorBadge > 0 && (
                  <span className="bg-[#EF4444] text-white text-xs font-semibold rounded-full px-2 py-0.5 leading-none">
                    {errorBadge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {activeTab !== 'errors' && (
          <>
            <FilterBar
              startDate={startDate} setStartDate={setStartDate}
              endDate={endDate} setEndDate={setEndDate}
              campaignType={campaignType} setCampaignType={setCampaignType}
              campaignDay={campaignDay} setCampaignDay={setCampaignDay}
              city={city} setCity={setCity}
              language={language} setLanguage={setLanguage}
              campaignTypes={campaignTypes}
              campaignDays={campaignDays}
              cities={cities}
              languages={languages}
              onReset={resetFilters}
              onRefresh={fetchMain}
            />

            {error && (
              <div className="border border-red-300 bg-red-50 rounded p-4 mb-6 flex items-center justify-between">
                <span className="text-sm text-red-700">Failed to load data: {error}</span>
                <button onClick={fetchMain} className="bg-red-600 text-white rounded px-3 py-1.5 text-sm">Retry</button>
              </div>
            )}
          </>
        )}

        {activeTab === 'overview' && <Overview metrics={metrics} loading={loading} />}
        {activeTab === 'errors' && (
          <Errors
            rows={errorRows}
            loading={errorsLoading}
            error={errorsError}
            onRetry={fetchErrors}
          />
        )}
      </main>
    </div>
  );
}
