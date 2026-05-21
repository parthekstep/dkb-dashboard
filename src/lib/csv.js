import Papa from 'papaparse';

export const MAIN_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTmjUxCaOlaLn95EELXCLZgUwR0zeEF_eyTiNLTNNXMBUX77CENzk-wAfPck7HuS_mx_xsMw0pYEgJo/pub?gid=1612668358&single=true&output=csv';

export const ERRORS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTmjUxCaOlaLn95EELXCLZgUwR0zeEF_eyTiNLTNNXMBUX77CENzk-wAfPck7HuS_mx_xsMw0pYEgJo/pub?gid=1401411862&single=true&output=csv';

export async function fetchCsv(url) {
  const res = await fetch(url + '&t=' + Date.now());
  if (!res.ok) throw new Error('Fetch failed: ' + res.status);
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  return parsed.data;
}
