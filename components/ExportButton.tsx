'use client';

import { useEffect, useRef, useState } from 'react';

interface Project {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
}

export default function ExportButton() {
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | null>(null);
  const [message, setMessage] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.ok ? r.json() : [])
      .then(async (clientList: Client[]) => {
        setClients(clientList);
        const allProjects = await Promise.all(
          clientList.map(c =>
            fetch(`/api/clients/${c.id}/projects`).then(r => r.ok ? r.json() : [])
          )
        );
        setProjects(allProjects.flat());
      })
      .catch(() => {});
  }, []);

  // Close panel on outside click
  useEffect(() => {
    if (!showFilters) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showFilters]);

  async function handleExport(format: 'xlsx' | 'csv') {
    setExporting(format);
    setMessage('');

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProjectId || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          format,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Export failed' }));
        setMessage(`❌ ${data.error}`);
        return;
      }

      // Trigger browser download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage('✅ Download started!');
    } catch {
      setMessage('❌ Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  }

  const hasFilters = selectedProjectId || dateFrom || dateTo;

  return (
    <div className="relative flex-shrink-0" ref={panelRef}>
      {/* Two stacked export buttons + filter toggle */}
      <div className="flex items-stretch gap-1.5">
        {/* Stacked Excel / CSV buttons */}
        <div className="flex flex-col gap-1">
          {/* Excel button */}
          <button
            onClick={() => handleExport('xlsx')}
            disabled={exporting !== null}
            title="Download as Excel spreadsheet"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors shadow active:scale-[0.98] whitespace-nowrap"
          >
            {exporting === 'xlsx' ? (
              <><span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />Exporting…</>
            ) : (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export to Excel
              </>
            )}
          </button>

          {/* CSV button */}
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
            title="Download as CSV file"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-600 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-60 transition-colors shadow active:scale-[0.98] whitespace-nowrap"
          >
            {exporting === 'csv' ? (
              <><span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />Exporting…</>
            ) : (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export to CSV
              </>
            )}
          </button>
        </div>

        {/* Filter toggle — small icon button aligned to top of stack */}
        <button
          onClick={() => { setShowFilters(v => !v); setMessage(''); }}
          title="Filter export (project, date range)"
          className={`self-stretch px-2 rounded-lg border transition-colors flex items-center justify-center ${
            showFilters || hasFilters
              ? 'bg-blue-50 border-blue-300 text-blue-600 hover:bg-blue-100'
              : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'
          }`}
        >
          {hasFilters ? (
            /* Solid funnel = active filter */
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M3.792 2.938A49.069 49.069 0 0112 2.25c2.797 0 5.54.236 8.209.688a1.857 1.857 0 011.541 1.836v1.044a3 3 0 01-.879 2.121l-6.182 6.182a1.5 1.5 0 00-.439 1.061v2.927a3 3 0 01-1.658 2.684l-1.757.878A.75.75 0 019.75 21v-5.818a1.5 1.5 0 00-.44-1.06L3.13 7.938a3 3 0 01-.879-2.121V4.774c0-.897.64-1.683 1.542-1.836z" clipRule="evenodd" />
            </svg>
          ) : (
            /* Outline funnel = no filter */
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
          )}
        </button>
      </div>

      {/* Status message below buttons */}
      {message && (
        <p className={`mt-1.5 text-xs text-center font-medium ${message.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>
          {message}
        </p>
      )}

      {/* Filter panel */}
      {showFilters && (
        <div className="absolute right-0 top-full mt-2 z-20 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">Export Filters</p>
            {hasFilters && (
              <button
                onClick={() => { setSelectedProjectId(''); setDateFrom(''); setDateTo(''); }}
                className="text-[11px] text-blue-500 hover:text-blue-700 font-medium"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Project filter */}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Job / Project</label>
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Jobs</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <p className="text-[11px] text-gray-400 text-center">Click Export to Excel or Export to CSV above</p>
        </div>
      )}
    </div>
  );
}
