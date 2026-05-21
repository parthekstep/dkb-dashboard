export function FilterBar({
  startDate, setStartDate,
  endDate, setEndDate,
  campaignType, setCampaignType,
  campaignDay, setCampaignDay,
  city, setCity,
  language, setLanguage,
  campaignTypes, campaignDays, cities, languages,
  onReset, onRefresh,
}) {
  const Select = ({ label, value, onChange, options }) => (
    <div className="flex flex-col">
      <label className="text-xs text-gray-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );

  const contextParts = [
    !startDate && !endDate ? 'All dates' : `${startDate || '…'} → ${endDate || '…'}`,
    campaignType || 'All campaigns',
    city || 'All cities',
    language || 'All languages',
  ];

  return (
    <div className="bg-[#F8F9FA] rounded-lg p-4 mb-6 flex flex-wrap items-end gap-3">
      <div className="flex flex-col">
        <label className="text-xs text-gray-600 mb-1">From</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-gray-600 mb-1">To</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
        />
      </div>
      <Select label="Campaign Type" value={campaignType} onChange={setCampaignType} options={campaignTypes} />
      <Select label="Campaign Day" value={campaignDay} onChange={setCampaignDay} options={campaignDays} />
      <Select label="City" value={city} onChange={setCity} options={cities} />
      <Select label="Language" value={language} onChange={setLanguage} options={languages} />

      <button
        onClick={onReset}
        className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white hover:bg-gray-50"
      >
        Reset
      </button>
      <button
        onClick={onRefresh}
        className="ml-auto bg-[#1F3864] text-white rounded px-3 py-1.5 text-sm hover:opacity-90"
      >
        Refresh
      </button>

      <div className="w-full text-xs text-gray-600">
        Showing: {contextParts.join(' | ')}
      </div>
    </div>
  );
}
