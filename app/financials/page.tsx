'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

// ─── Animated number ──────────────────────────────────────────────────────────

function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const prevRef = useRef<number>(0);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    startRef.current = 0;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    function ease(t: number) { return 1 - Math.pow(1 - t, 3); }
    function tick(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const t = Math.min((ts - startRef.current) / 900, 1);
      setDisplay(from + (value - from) * ease(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  return <>{prefix}{display.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface RawExpense {
  id: string;
  expense_date: string | null;
  total_amount: number | null;
  tax_amount: number | null;
  vendor_name: string | null;
  status: string | null;
  project_id: string | null;
  confidence_score: number | null;
}

interface ProjectInfo {
  name: string;
  clientId: string;
  clientName: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BarRow({
  label,
  total,
  count,
  max,
  color,
}: {
  label: string;
  total: number;
  count: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (total / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-36 flex-shrink-0 truncate" title={label}>{label}</span>
      <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
        <div
          className={`h-full ${color} rounded transition-all flex items-center pl-1`}
          style={{ width: `${pct}%`, minWidth: pct > 0 ? '2px' : '0' }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-24 text-right">${fmt(total)}</span>
      <span className="text-[11px] text-gray-400 w-12 text-right">{count}×</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancialsPage() {
  const [expenses, setExpenses] = useState<RawExpense[]>([]);
  const [projectMap, setProjectMap] = useState<Record<string, ProjectInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected year / month (null month = all months view)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/financials')
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json();
      })
      .then(data => {
        setExpenses(data.expenses || []);
        setProjectMap(data.projectMap || {});
      })
      .catch(() => setError('Failed to load financial data'))
      .finally(() => setLoading(false));
  }, []);

  // Derive available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const e of expenses) {
      if (e.expense_date) {
        const y = parseInt(e.expense_date.split('-')[0]);
        if (!isNaN(y)) years.add(y);
      }
    }
    const sorted = Array.from(years).sort((a, b) => b - a);
    return sorted.length > 0 ? sorted : [new Date().getFullYear()];
  }, [expenses]);

  // Expenses for the selected year
  const yearExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (!e.expense_date) return false;
      return parseInt(e.expense_date.split('-')[0]) === selectedYear;
    });
  }, [expenses, selectedYear]);

  // Expenses for the selected year + month (or all year if null)
  const filteredExpenses = useMemo(() => {
    if (selectedMonth === null) return yearExpenses;
    return yearExpenses.filter(e => {
      if (!e.expense_date) return false;
      return parseInt(e.expense_date.split('-')[1]) === selectedMonth;
    });
  }, [yearExpenses, selectedMonth]);

  // Monthly breakdown (for year overview)
  const monthlyBreakdown = useMemo(() => {
    const map: Record<number, { total: number; count: number }> = {};
    for (let m = 1; m <= 12; m++) map[m] = { total: 0, count: 0 };
    for (const e of yearExpenses) {
      if (!e.expense_date) continue;
      const m = parseInt(e.expense_date.split('-')[1]);
      if (m >= 1 && m <= 12) {
        map[m].total += e.total_amount || 0;
        map[m].count += 1;
      }
    }
    return map;
  }, [yearExpenses]);

  const maxMonthly = useMemo(() => {
    return Math.max(...Object.values(monthlyBreakdown).map(m => m.total), 1);
  }, [monthlyBreakdown]);

  // Vendor breakdown for filtered set
  const vendorBreakdown = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const e of filteredExpenses) {
      const v = e.vendor_name || 'Unknown';
      if (!map[v]) map[v] = { total: 0, count: 0 };
      map[v].total += e.total_amount || 0;
      map[v].count += 1;
    }
    return Object.entries(map)
      .map(([vendor, d]) => ({ vendor, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [filteredExpenses]);

  // Project breakdown for filtered set
  const projectBreakdown = useMemo(() => {
    const map: Record<string, { name: string; clientName: string; total: number; count: number }> = {};
    for (const e of filteredExpenses) {
      const pid = e.project_id || 'Unknown';
      const info = e.project_id ? projectMap[e.project_id] : null;
      const name = info?.name || pid;
      const clientName = info?.clientName || '';
      if (!map[pid]) map[pid] = { name, clientName, total: 0, count: 0 };
      map[pid].total += e.total_amount || 0;
      map[pid].count += 1;
    }
    return Object.entries(map)
      .map(([, d]) => d)
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [filteredExpenses, projectMap]);

  const maxVendor = Math.max(...vendorBreakdown.map(v => v.total), 1);
  const maxProject = Math.max(...projectBreakdown.map(p => p.total), 1);

  const totalSpend = filteredExpenses.reduce((s, e) => s + (e.total_amount || 0), 0);
  const totalTax = filteredExpenses.reduce((s, e) => s + (e.tax_amount || 0), 0);
  const approvedCount = filteredExpenses.filter(e => e.status === 'APPROVED').length;
  const pendingCount = filteredExpenses.filter(e => e.status === 'PENDING_APPROVAL' || e.status === 'DRAFT').length;

  const periodLabel = selectedMonth !== null
    ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
    : `${selectedYear} (full year)`;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-6 w-28 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-36 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-14 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-2">
              <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-7 w-28 bg-gray-200 rounded animate-pulse" />
              <div className="h-2.5 w-16 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: 13 }).map((_, i) => (
              <div key={i} className="h-7 w-12 bg-gray-100 rounded-md animate-pulse" />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-8 bg-gray-100 rounded animate-pulse" />
              <div className="flex-1 h-4 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="h-3 w-28 bg-gray-100 rounded animate-pulse" />
                  <div className="flex-1 h-5 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Financials</h1>
          <p className="text-sm text-gray-500 mt-0.5">{periodLabel}</p>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-2">
          {availableYears.map(y => (
            <button
              key={y}
              onClick={() => { setSelectedYear(y); setSelectedMonth(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedYear === y
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-hover bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Total Spend</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">
            <AnimatedNumber value={totalSpend} prefix="$" decimals={2} />
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{filteredExpenses.length} expenses</p>
        </div>
        <div className="card-hover bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Total Tax</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">
            <AnimatedNumber value={totalTax} prefix="$" decimals={2} />
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {((totalSpend > 0 ? totalTax / totalSpend : 0) * 100).toFixed(1)}% of spend
          </p>
        </div>
        <div className="card-hover bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Approved</p>
          <p className="text-2xl font-bold text-green-600 tabular-nums">
            <AnimatedNumber value={approvedCount} />
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {filteredExpenses.length > 0 ? Math.round((approvedCount / filteredExpenses.length) * 100) : 0}% approval rate
          </p>
        </div>
        {/* Clicking this card jumps to the review queue section below */}
        <a href="#review-queue" className={`card-hover rounded-xl border shadow-sm p-4 block transition-all ${
          pendingCount > 0 ? 'bg-orange-50 border-orange-200 hover:border-orange-400' : 'bg-white border-gray-200'
        }`}>
          <p className="text-xs text-gray-500 mb-1">Pending Review</p>
          <p className={`text-2xl font-bold tabular-nums ${pendingCount > 0 ? 'text-orange-500' : 'text-gray-900'}`}>
            <AnimatedNumber value={pendingCount} />
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {pendingCount > 0 ? '↓ View queue below' : 'All caught up'}
          </p>
        </a>
      </div>

      {/* ── Review Queue ── */}
      {(() => {
        // Collect all pending/draft/extracted expenses across the org
        const queueExpenses = expenses.filter(e =>
          e.status === 'PENDING_APPROVAL' || e.status === 'DRAFT' || e.status === 'EXTRACTED'
        );

        // Group by project_id
        const byProject: Record<string, { name: string; clientId: string; clientName: string; items: RawExpense[] }> = {};
        for (const e of queueExpenses) {
          const pid = e.project_id || '__none__';
          if (!byProject[pid]) {
            const info = e.project_id ? projectMap[e.project_id] : null;
            byProject[pid] = {
              name: info?.name || 'Unassigned',
              clientId: info?.clientId || '',
              clientName: info?.clientName || '',
              items: [],
            };
          }
          byProject[pid].items.push(e);
        }

        const groups = Object.entries(byProject).sort((a, b) => b[1].items.length - a[1].items.length);

        return (
          <div id="review-queue" className="scroll-mt-6">
            {/* Section header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800">Review Queue</h2>
                {queueExpenses.length > 0 && (
                  <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-orange-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse inline-block" />
                    {queueExpenses.length} pending
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">Expenses waiting for approval across all projects</p>
            </div>

            {queueExpenses.length === 0 ? (
              /* All-clear state */
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-700">All caught up!</p>
                <p className="text-xs text-gray-400 mt-1">No expenses are waiting for review.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map(([projectId, group]) => {
                  const reviewUrl = group.clientId
                    ? `/clients/${group.clientId}/projects/${projectId}/review`
                    : null;

                  // Sort by confidence ascending so lowest-confidence shows first
                  const sorted = [...group.items].sort(
                    (a, b) => (a.confidence_score ?? 1) - (b.confidence_score ?? 1)
                  );

                  const avgConf = group.items.reduce((s, e) => s + (e.confidence_score ?? 0), 0) / group.items.length;
                  const totalAmt = group.items.reduce((s, e) => s + (e.total_amount ?? 0), 0);
                  const confPct = Math.round(avgConf * 100);
                  const confColor = confPct >= 80 ? 'text-green-600' : confPct >= 60 ? 'text-yellow-600' : 'text-red-500';
                  const confBg = confPct >= 80 ? 'bg-green-50 border-green-200' : confPct >= 60 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

                  return (
                    <div key={projectId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      {/* Project header row */}
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{group.name}</p>
                            {group.clientName && (
                              <p className="text-[11px] text-gray-400 truncate">{group.clientName}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs text-gray-500 tabular-nums">${totalAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${confBg} ${confColor}`}>
                            {confPct}% avg confidence
                          </span>
                          <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                            {group.items.length} pending
                          </span>
                          {reviewUrl && (
                            <Link
                              href={reviewUrl}
                              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Review
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Expense rows */}
                      <div className="divide-y divide-gray-50">
                        {sorted.map(e => {
                          const conf = e.confidence_score ?? 0;
                          const pct = Math.round(conf * 100);
                          const rowColor = pct < 65 ? 'text-red-500' : pct < 85 ? 'text-yellow-600' : 'text-green-600';
                          const dot = pct < 65 ? 'bg-red-400' : pct < 85 ? 'bg-yellow-400' : 'bg-green-400';
                          return (
                            <div key={e.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                              <span className="text-sm text-gray-800 font-medium min-w-0 truncate flex-1">
                                {e.vendor_name || <span className="text-gray-400 italic">Unknown vendor</span>}
                              </span>
                              <span className="text-xs text-gray-400 flex-shrink-0">{e.expense_date ?? '—'}</span>
                              <span className="text-xs font-semibold text-gray-700 tabular-nums flex-shrink-0 w-20 text-right">
                                {e.total_amount != null ? `$${e.total_amount.toFixed(2)}` : '—'}
                              </span>
                              <span className={`text-[11px] font-bold w-10 text-right flex-shrink-0 ${rowColor}`}>
                                {pct}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Job Cost Snapshot ── */}
      {(() => {
        const now = new Date();
        const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

        const thisMonthExpenses = expenses.filter(e => e.expense_date?.startsWith(thisMonthStr));
        const lastMonthExpenses = expenses.filter(e => e.expense_date?.startsWith(lastMonthStr));

        const thisMonthSpend = thisMonthExpenses.reduce((s, e) => s + (e.total_amount || 0), 0);
        const lastMonthSpend = lastMonthExpenses.reduce((s, e) => s + (e.total_amount || 0), 0);
        const momChange = lastMonthSpend > 0 ? ((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100 : null;

        // Largest single expense this year
        const largestExpense = yearExpenses.reduce<RawExpense | null>(
          (max, e) => (e.total_amount ?? 0) > (max?.total_amount ?? 0) ? e : max, null
        );

        // Total tax this year
        const yearTax = yearExpenses.reduce((s, e) => s + (e.tax_amount || 0), 0);
        const taxPct = totalSpend > 0 ? (yearTax / totalSpend) * 100 : 0;

        // Unapproved spend (pending/draft)
        const unapprovedSpend = filteredExpenses
          .filter(e => e.status === 'PENDING_APPROVAL' || e.status === 'DRAFT' || e.status === 'EXTRACTED')
          .reduce((s, e) => s + (e.total_amount || 0), 0);

        return (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden card-hover">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
              <div className="w-6 h-6 bg-orange-100 rounded-md flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-gray-800">Job Cost Snapshot</h2>
              <span className="ml-auto text-[11px] text-gray-400">{periodLabel}</span>
            </div>

            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-5">

              {/* This month spend */}
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">This Month</p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">
                  <AnimatedNumber value={thisMonthSpend} prefix="$" decimals={0} />
                </p>
                {momChange !== null && (
                  <p className={`text-xs font-medium mt-0.5 ${momChange > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {momChange > 0 ? '▲' : '▼'} {Math.abs(momChange).toFixed(1)}% vs last month
                  </p>
                )}
                <p className="text-[11px] text-gray-400">{thisMonthExpenses.length} receipts</p>
              </div>

              {/* Unapproved spend */}
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Awaiting Approval</p>
                <p className={`text-2xl font-bold tabular-nums leading-none ${unapprovedSpend > 0 ? 'text-orange-500' : 'text-gray-900'}`}>
                  <AnimatedNumber value={unapprovedSpend} prefix="$" decimals={0} />
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">not yet approved</p>
                {unapprovedSpend > 0 && (
                  <a href="/review" className="text-[11px] text-blue-600 hover:underline mt-0.5">Review now →</a>
                )}
              </div>

              {/* Tax this year */}
              <div className="flex flex-col gap-1 pl-2 border-l border-gray-100">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tax Paid ({selectedYear})</p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">
                  <AnimatedNumber value={yearTax} prefix="$" decimals={0} />
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">{taxPct.toFixed(1)}% of total spend</p>
              </div>

              {/* Largest expense */}
              <div className="flex flex-col gap-1 pl-2 border-l border-gray-100">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Largest Expense</p>
                {largestExpense ? (
                  <>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">
                      <AnimatedNumber value={largestExpense.total_amount ?? 0} prefix="$" decimals={0} />
                    </p>
                    <p className="text-[11px] text-gray-600 font-medium truncate mt-0.5">{largestExpense.vendor_name || 'Unknown'}</p>
                    <p className="text-[11px] text-gray-400">{largestExpense.expense_date ?? '—'}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">No data</p>
                )}
              </div>

            </div>
          </div>
        );
      })()}

      {/* Month selector row */}
      <div className="card-hover bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Monthly Breakdown — {selectedYear}</h2>
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setSelectedMonth(null)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedMonth === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {MONTH_NAMES.map((name, i) => {
            const m = i + 1;
            const d = monthlyBreakdown[m];
            const hasData = d.count > 0;
            return (
              <button
                key={m}
                onClick={() => setSelectedMonth(selectedMonth === m ? null : m)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedMonth === m
                    ? 'bg-blue-600 text-white'
                    : hasData
                    ? 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                    : 'bg-gray-50 text-gray-300 cursor-default'
                }`}
                disabled={!hasData && selectedMonth !== m}
              >
                {name.slice(0, 3)}
                {hasData && (
                  <span className={`ml-1 ${selectedMonth === m ? 'text-blue-200' : 'text-gray-400'}`}>
                    {d.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mini bar chart for months */}
        <div className="space-y-1.5">
          {MONTH_NAMES.map((name, i) => {
            const m = i + 1;
            const d = monthlyBreakdown[m];
            if (d.count === 0) return null;
            const pct = (d.total / maxMonthly) * 100;
            const isActive = selectedMonth === m;
            return (
              <div key={m} className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedMonth(selectedMonth === m ? null : m)}>
                <span className={`text-xs w-8 flex-shrink-0 font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                  {name.slice(0, 3)}
                </span>
                <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                  <div
                    className={`h-full rounded transition-all ${isActive ? 'bg-blue-600' : 'bg-blue-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-24 text-right">${fmt(d.total)}</span>
                <span className="text-[11px] text-gray-400 w-10 text-right">{d.count}×</span>
              </div>
            );
          })}
          {Object.values(monthlyBreakdown).every(d => d.count === 0) && (
            <p className="text-sm text-gray-400 text-center py-4">No data for {selectedYear}</p>
          )}
        </div>
      </div>

      {/* Vendor + Project charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Vendor breakdown */}
        <div className="card-hover bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Top Vendors</h2>
          <p className="text-xs text-gray-400 mb-4">{periodLabel}</p>
          {vendorBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data</p>
          ) : (
            <div className="space-y-2">
              {vendorBreakdown.map(v => (
                <BarRow key={v.vendor} label={v.vendor} total={v.total} count={v.count} max={maxVendor} color="bg-indigo-500" />
              ))}
            </div>
          )}
        </div>

        {/* Project breakdown */}
        <div className="card-hover bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">By Project</h2>
          <p className="text-xs text-gray-400 mb-4">{periodLabel}</p>
          {projectBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data</p>
          ) : (
            <div className="space-y-2">
              {projectBreakdown.map(p => (
                <BarRow
                  key={p.name}
                  label={p.clientName ? `${p.clientName} – ${p.name}` : p.name}
                  total={p.total}
                  count={p.count}
                  max={maxProject}
                  color="bg-blue-500"
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Spend Heatmap ── */}
      {(() => {
        // Build day-level spend map for the selected year
        const dayMap: Record<string, number> = {};
        for (const e of yearExpenses) {
          if (!e.expense_date) continue;
          dayMap[e.expense_date] = (dayMap[e.expense_date] || 0) + (e.total_amount || 0);
        }
        const allDayValues = Object.values(dayMap);
        const maxDay = allDayValues.length > 0 ? Math.max(...allDayValues) : 1;

        function dayColor(amount: number): string {
          if (amount === 0) return 'bg-gray-100';
          const pct = amount / maxDay;
          if (pct > 0.75) return 'bg-blue-700';
          if (pct > 0.5)  return 'bg-blue-500';
          if (pct > 0.25) return 'bg-blue-300';
          return 'bg-blue-100';
        }

        const hasData = allDayValues.length > 0;

        return (
          <div className="card-hover bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-gray-700">Spend Heatmap</h2>
              <span className="text-xs text-gray-400">{selectedYear} · Each square = 1 day</span>
            </div>
            <div className="flex items-center gap-1.5 mb-4 text-[11px] text-gray-400">
              <span>Less</span>
              {['bg-gray-100', 'bg-blue-100', 'bg-blue-300', 'bg-blue-500', 'bg-blue-700'].map((c, i) => (
                <span key={i} className={`w-3 h-3 rounded-sm inline-block ${c}`} />
              ))}
              <span>More</span>
            </div>

            {!hasData ? (
              <p className="text-sm text-gray-400 text-center py-8">No data for {selectedYear}</p>
            ) : (
              <div className="grid grid-cols-12 gap-x-3 gap-y-2">
                {MONTH_NAMES.map((monthName, mi) => {
                  const month = mi + 1;
                  const daysInMonth = new Date(selectedYear, month, 0).getDate();
                  // Day-of-week of first day (0=Sun)
                  const firstDow = new Date(selectedYear, month - 1, 1).getDay();

                  const totalForMonth = monthlyBreakdown[month]?.total || 0;

                  return (
                    <div key={month} className="min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-semibold ${selectedMonth === month ? 'text-blue-600' : 'text-gray-500'}`}>
                          {monthName.slice(0, 3)}
                        </span>
                        {totalForMonth > 0 && (
                          <span className="text-[9px] text-gray-400">${Math.round(totalForMonth / 1000)}k</span>
                        )}
                      </div>
                      {/* 6-row × 7-col grid (weeks × days) */}
                      <div className="grid grid-cols-7 gap-[2px]">
                        {/* Empty cells for day-of-week offset */}
                        {Array.from({ length: firstDow }).map((_, i) => (
                          <span key={`pad-${i}`} className="w-full aspect-square" />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, di) => {
                          const day = di + 1;
                          const dateStr = `${selectedYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const amount = dayMap[dateStr] || 0;
                          const isToday = dateStr === new Date().toISOString().slice(0, 10);
                          return (
                            <span
                              key={day}
                              title={amount > 0 ? `${dateStr}: $${amount.toFixed(2)}` : dateStr}
                              className={`w-full aspect-square rounded-[2px] cursor-default transition-opacity hover:opacity-75 ${dayColor(amount)} ${
                                isToday ? 'ring-1 ring-orange-400' : ''
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}
