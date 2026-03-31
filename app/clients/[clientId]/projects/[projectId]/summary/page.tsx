'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Expense } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtDate(s: string) {
  const [y, m, day] = s.split('-');
  return `${m}/${day}/${y}`;
}
function monthKey(d: string) {
  return d.slice(0, 7); // "YYYY-MM"
}
function monthLabel(ym: string) {
  if (!ym || ym === 'Unknown') return ym;
  const [y, m] = ym.split('-');
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
}

// ─── Date range filter logic ──────────────────────────────────────────────────

type DatePreset = 'all' | 'this_month' | 'last_month' | 'q1' | 'q2' | 'q3' | 'q4' | 'ytd';

function getPresetRange(preset: DatePreset): [string, string] | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const pad = (n: number) => String(n).padStart(2, '0');

  if (preset === 'all') return null;
  if (preset === 'this_month') {
    const start = `${y}-${pad(m + 1)}-01`;
    const end = `${y}-${pad(m + 1)}-31`;
    return [start, end];
  }
  if (preset === 'last_month') {
    const lm = m === 0 ? 12 : m;
    const ly = m === 0 ? y - 1 : y;
    return [`${ly}-${pad(lm)}-01`, `${ly}-${pad(lm)}-31`];
  }
  const qRanges: Record<string, [string, string]> = {
    q1: [`${y}-01-01`, `${y}-03-31`],
    q2: [`${y}-04-01`, `${y}-06-30`],
    q3: [`${y}-07-01`, `${y}-09-30`],
    q4: [`${y}-10-01`, `${y}-12-31`],
    ytd: [`${y}-01-01`, `${y}-${pad(m + 1)}-31`],
  };
  return qRanges[preset] ?? null;
}

// ─── Mini components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, subColor = 'text-gray-400', accent, alert, icon }: {
  label: string; value: string; sub?: string; subColor?: string;
  accent?: boolean; alert?: boolean; icon: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3 ${
      alert ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200'
    }`}>
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          alert ? 'bg-orange-100 text-orange-500' : accent ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
        }`}>{icon}</div>
      </div>
      <div>
        <p className={`text-2xl font-bold leading-none tracking-tight ${alert ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
        {sub && <p className={`text-xs mt-1.5 font-medium ${subColor}`}>{sub}</p>}
      </div>
    </div>
  );
}

function Section({ title, subtitle, badge, children }: {
  title: string; subtitle?: string; badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {badge}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Column chart ─────────────────────────────────────────────────────────────

function ColumnChart({ data }: {
  data: { label: string; total: number; approved: number; pending: number }[];
}) {
  const maxVal = Math.max(...data.map(d => d.total), 1);
  const H = 120;
  return (
    <div className="flex items-end gap-2 w-full" style={{ height: H + 36 }}>
      {data.map((d) => {
        const th = Math.round((d.total / maxVal) * H);
        const ah = Math.round((d.approved / maxVal) * H);
        const ph = Math.round((d.pending / maxVal) * H);
        const rh = Math.max(th - ah - ph, 0);
        return (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1 min-w-0 group">
            <div className="relative w-full">
              {/* Hover tooltip */}
              <div className="hidden group-hover:flex absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20
                bg-gray-900 text-white text-[10px] rounded-xl px-3 py-2 whitespace-nowrap flex-col gap-1 shadow-xl">
                <span className="font-bold">{d.label}</span>
                <span className="text-gray-300">Total ${fmt$(d.total, 0)}</span>
                {d.approved > 0 && <span className="text-green-400">✓ Approved ${fmt$(d.approved, 0)}</span>}
                {d.pending  > 0 && <span className="text-orange-400">⏳ Pending ${fmt$(d.pending, 0)}</span>}
              </div>
              {/* Stacked bar */}
              <div className="flex flex-col justify-end w-full rounded-t-lg overflow-hidden cursor-default" style={{ height: H }}>
                {rh > 0 && <div className="w-full bg-gray-100" style={{ height: rh }} />}
                {ph > 0 && <div className="w-full bg-orange-300" style={{ height: ph }} />}
                {ah > 0 && <div className="w-full bg-blue-500" style={{ height: ah }} />}
                {th === 0 && <div className="w-full h-0.5 bg-gray-100 mt-auto" />}
              </div>
            </div>
            <span className="text-[9px] text-gray-400 truncate w-full text-center select-none">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Donut-style pie (CSS conic-gradient) ─────────────────────────────────────

function DonutChart({ slices }: {
  slices: { label: string; value: number; color: string; textColor: string }[];
}) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return <p className="text-sm text-gray-400 text-center py-4">No data</p>;

  let cumAngle = 0;
  const gradient = slices
    .filter(sl => sl.value > 0)
    .map(sl => {
      const pct = (sl.value / total) * 100;
      const start = cumAngle;
      cumAngle += pct;
      return `${sl.color} ${start.toFixed(1)}% ${cumAngle.toFixed(1)}%`;
    })
    .join(', ');

  return (
    <div className="flex items-center gap-6">
      {/* Donut */}
      <div className="relative flex-shrink-0" style={{ width: 96, height: 96 }}>
        <div className="w-24 h-24 rounded-full" style={{
          background: `conic-gradient(${gradient})`,
        }} />
        {/* Hole */}
        <div className="absolute inset-0 m-4 rounded-full bg-white flex items-center justify-center">
          <span className="text-[10px] font-bold text-gray-600">${fmt$(total, 0)}</span>
        </div>
      </div>
      {/* Legend */}
      <div className="space-y-2 flex-1">
        {slices.map(sl => {
          const pct = total > 0 ? ((sl.value / total) * 100).toFixed(1) : '0';
          return (
            <div key={sl.label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: sl.color }} />
                <span className="text-xs text-gray-600 font-medium">{sl.label}</span>
              </div>
              <div className="text-right">
                <span className={`text-xs font-bold ${sl.textColor}`}>${fmt$(sl.value, 0)}</span>
                <span className="text-[10px] text-gray-400 ml-1">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── OCR heat indicator ───────────────────────────────────────────────────────

function OcrHeat({ expenses }: { expenses: Expense[] }) {
  const total = expenses.length;
  if (total === 0) return <p className="text-sm text-gray-400 text-center py-4">No data</p>;

  const highConf  = expenses.filter(e => (e.confidence_score || 0) >= 0.8).length;
  const midConf   = expenses.filter(e => (e.confidence_score || 0) >= 0.6 && (e.confidence_score || 0) < 0.8).length;
  const lowConf   = expenses.filter(e => (e.confidence_score || 0) < 0.6).length;
  const autoApproved = expenses.filter(e => e.status === 'APPROVED' && (e.confidence_score || 0) >= 0.8).length;

  const bands = [
    { label: 'High confidence', sub: '≥ 80% — auto-approve ready', count: highConf, color: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50' },
    { label: 'Medium confidence', sub: '60–79% — review recommended', count: midConf, color: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50' },
    { label: 'Low confidence', sub: '< 60% — manual check needed', count: lowConf, color: 'bg-red-400', text: 'text-red-700', bg: 'bg-red-50' },
  ];

  return (
    <div className="space-y-4">
      {bands.map(b => (
        <div key={b.label} className={`flex items-center gap-4 rounded-xl p-3 ${b.bg}`}>
          <div className={`w-2 self-stretch rounded-full flex-shrink-0 ${b.color}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className={`text-xs font-semibold ${b.text}`}>{b.label}</p>
              <span className={`text-sm font-bold ${b.text}`}>{b.count}</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">{b.sub}</p>
            <div className="mt-1.5 h-1.5 bg-white/70 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${b.color}`}
                style={{ width: `${(b.count / total) * 100}%` }} />
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="text-xs font-bold text-gray-600">{((b.count / total) * 100).toFixed(0)}%</span>
          </div>
        </div>
      ))}

      {/* System ROI callout */}
      <div className="mt-2 pt-4 border-t border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-700">System ROI</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Receipts approved without manual effort</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-blue-600">
            {total > 0 ? Math.round((autoApproved / total) * 100) : 0}%
          </p>
          <p className="text-[10px] text-gray-400">{autoApproved} of {total}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Approval funnel ──────────────────────────────────────────────────────────

function ApprovalFunnel({ approved, pending, rejected, total }: {
  approved: number; pending: number; rejected: number; total: number;
}) {
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
  const stages = [
    { label: 'Total Submitted', count: total,    barPct: 100,           bar: 'bg-gray-300',   pill: 'bg-gray-100 text-gray-700' },
    { label: 'Approved',        count: approved, barPct: pct(approved), bar: 'bg-green-500',  pill: 'bg-green-100 text-green-700' },
    { label: 'Pending',         count: pending,  barPct: pct(pending),  bar: 'bg-orange-400', pill: 'bg-orange-100 text-orange-700' },
    { label: 'Rejected',        count: rejected, barPct: pct(rejected), bar: 'bg-red-400',    pill: 'bg-red-100 text-red-700' },
  ];
  return (
    <div className="space-y-3">
      {stages.map(s => (
        <div key={s.label} className="flex items-center gap-3">
          <div className={`flex items-center justify-between rounded-lg px-3 py-1.5 w-40 flex-shrink-0 ${s.pill}`}>
            <span className="text-xs font-semibold truncate">{s.label}</span>
            <span className="text-sm font-bold ml-2 flex-shrink-0">{s.count}</span>
          </div>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${s.bar}`} style={{ width: `${s.barPct}%` }} />
          </div>
          <span className="text-xs font-bold text-gray-500 w-9 text-right">{s.barPct}%</span>
        </div>
      ))}
      {/* Segmented bar */}
      {total > 0 && (
        <div className="mt-1 h-2.5 rounded-full overflow-hidden flex">
          <div className="bg-green-500 h-full" style={{ width: `${pct(approved)}%` }} />
          <div className="bg-orange-400 h-full" style={{ width: `${pct(pending)}%` }} />
          <div className="bg-red-400 h-full"   style={{ width: `${pct(rejected)}%` }} />
        </div>
      )}
    </div>
  );
}

// ─── Vendor table ─────────────────────────────────────────────────────────────

function VendorTable({ rows, totalAmount }: {
  rows: { vendor: string; total: number; tax: number; count: number; avg: number }[];
  totalAmount: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {['#', 'Vendor', 'Spend', '% of Total', 'Receipts', 'Avg/Receipt', 'Tax'].map(h => (
              <th key={h} className={`pb-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest ${
                ['#', 'Receipts'].includes(h) ? 'text-center w-8' :
                h === 'Vendor' ? 'text-left' : 'text-right'
              }`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((v, i) => {
            const pct = totalAmount > 0 ? (v.total / totalAmount) * 100 : 0;
            return (
              <tr key={v.vendor} className={`${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                <td className="py-2.5 text-center text-[11px] font-bold text-gray-300">{i + 1}</td>
                <td className="py-2.5 pr-3">
                  <span className="text-sm font-semibold text-gray-800 truncate block max-w-[160px]">{v.vendor}</span>
                </td>
                <td className="py-2.5 text-right font-bold text-sm text-gray-900">${fmt$(v.total)}</td>
                <td className="py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-500 w-9 text-right">{pct.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="py-2.5 text-center text-sm text-gray-500">{v.count}</td>
                <td className="py-2.5 text-right text-sm text-gray-500">${fmt$(v.avg)}</td>
                <td className="py-2.5 text-right text-sm text-gray-500">${fmt$(v.tax)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200">
            <td />
            <td className="pt-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Total</td>
            <td className="pt-3 text-right text-sm font-bold text-gray-900">${fmt$(totalAmount)}</td>
            <td className="pt-3 text-right text-xs font-bold text-gray-500">100%</td>
            <td className="pt-3 text-center text-sm font-bold text-gray-700">
              {rows.reduce((s, v) => s + v.count, 0)}
            </td>
            <td className="pt-3 text-right text-sm text-gray-500">
              {rows.length > 0 ? `$${fmt$(totalAmount / rows.reduce((s, v) => s + v.count, 0))}` : '—'}
            </td>
            <td className="pt-3 text-right text-sm font-bold text-gray-900">
              ${fmt$(rows.reduce((s, v) => s + v.tax, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'all',        label: 'All Time'    },
  { key: 'this_month', label: 'This Month'  },
  { key: 'last_month', label: 'Last Month'  },
  { key: 'ytd',        label: 'YTD'         },
  { key: 'q1',         label: 'Q1'          },
  { key: 'q2',         label: 'Q2'          },
  { key: 'q3',         label: 'Q3'          },
  { key: 'q4',         label: 'Q4'          },
];

const STATUS_FILTERS = [
  { key: 'all',      label: 'All Statuses'    },
  { key: 'approved', label: 'Approved'        },
  { key: 'pending',  label: 'Pending'         },
  { key: 'rejected', label: 'Rejected'        },
];

export default function SummaryPage() {
  const params = useParams();
  const router = useRouter();
  const clientId  = params.clientId  as string;
  const projectId = params.projectId as string;

  const [expenses,    setExpenses]    = useState<Expense[]>([]);
  const [projectName, setProjectName] = useState('');
  const [loading,     setLoading]     = useState(true);

  // Filters
  const [datePreset,   setDatePreset]   = useState<DatePreset>('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    async function load() {
      const [expRes, projRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/expenses`),
        fetch(`/api/clients/${clientId}/projects`),
      ]);
      if (expRes.ok) setExpenses(await expRes.json());
      if (projRes.ok) {
        const projects = await projRes.json();
        const proj = projects.find((p: { id: string; name: string }) => p.id === projectId);
        if (proj) setProjectName(proj.name);
      }
      setLoading(false);
    }
    load();
  }, [projectId, clientId]);

  // ── Filtered expenses ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...expenses];

    // Date filter
    const range = getPresetRange(datePreset);
    if (range) {
      list = list.filter(e => {
        if (!e.expense_date) return false;
        return e.expense_date >= range[0] && e.expense_date <= range[1];
      });
    }

    // Status filter
    if (statusFilter === 'approved') list = list.filter(e => e.status === 'APPROVED');
    if (statusFilter === 'pending')  list = list.filter(e => e.status === 'PENDING_APPROVAL' || e.status === 'DRAFT');
    if (statusFilter === 'rejected') list = list.filter(e => e.status === 'REJECTED');

    return list;
  }, [expenses, datePreset, statusFilter]);

  // ── Derived metrics from filtered set ────────────────────────────────────
  const approved  = useMemo(() => filtered.filter(e => e.status === 'APPROVED'),                            [filtered]);
  const pending   = useMemo(() => filtered.filter(e => e.status === 'PENDING_APPROVAL' || e.status === 'DRAFT'), [filtered]);
  const rejected  = useMemo(() => filtered.filter(e => e.status === 'REJECTED'),                            [filtered]);

  const totalAmount    = useMemo(() => filtered.reduce((s, e) => s + (e.total_amount || 0), 0), [filtered]);
  const approvedAmount = useMemo(() => approved.reduce((s, e) => s + (e.total_amount || 0), 0), [approved]);
  const pendingAmount  = useMemo(() => pending.reduce((s,  e) => s + (e.total_amount || 0), 0), [pending]);
  const totalTax       = useMemo(() => filtered.reduce((s, e) => s + (e.tax_amount   || 0), 0), [filtered]);
  const avgConf        = filtered.length > 0
    ? filtered.reduce((s, e) => s + (e.confidence_score || 0), 0) / filtered.length : 0;

  // Date range display
  const dates = filtered.filter(e => e.expense_date).map(e => e.expense_date!).sort();
  const dateRange = dates.length > 0 ? `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}` : null;

  // Monthly data for chart
  const monthlyData = useMemo(() => {
    const map: Record<string, { total: number; approved: number; pending: number }> = {};
    for (const e of filtered) {
      if (!e.expense_date) continue;
      const k = monthKey(e.expense_date);
      if (!map[k]) map[k] = { total: 0, approved: 0, pending: 0 };
      map[k].total    += e.total_amount || 0;
      if (e.status === 'APPROVED') map[k].approved += e.total_amount || 0;
      if (e.status === 'PENDING_APPROVAL' || e.status === 'DRAFT') map[k].pending += e.total_amount || 0;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ label: monthLabel(k), ...v }));
  }, [filtered]);

  // Vendor rows
  const vendorRows = useMemo(() => {
    const map: Record<string, { total: number; tax: number; count: number }> = {};
    for (const e of filtered) {
      const v = e.vendor_name || 'Unknown';
      if (!map[v]) map[v] = { total: 0, tax: 0, count: 0 };
      map[v].total += e.total_amount || 0;
      map[v].tax   += e.tax_amount   || 0;
      map[v].count += 1;
    }
    return Object.entries(map)
      .map(([vendor, d]) => ({ vendor, ...d, avg: d.total / d.count }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Risk items
  const riskItems = useMemo(() =>
    filtered
      .filter(e => (e.confidence_score || 0) < 0.75 && e.status !== 'APPROVED' && e.status !== 'REJECTED')
      .sort((a, b) => (a.confidence_score || 0) - (b.confidence_score || 0))
      .slice(0, 6),
  [filtered]);

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-7 w-20 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <div className="flex justify-between">
                <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="w-8 h-8 bg-gray-100 rounded-lg animate-pulse" />
              </div>
              <div className="h-8 w-28 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        {[200, 160, 180].map((h, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="h-4 w-36 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="p-6">
              <div className={`bg-gray-100 rounded-xl animate-pulse`} style={{ height: h }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-600 font-semibold">No data yet</p>
          <p className="text-sm text-gray-400 mt-1">Upload receipts to see the project summary</p>
        </div>
      </div>
    );
  }

  const autoApproved = filtered.filter(e => e.status === 'APPROVED' && (e.confidence_score || 0) >= 0.8).length;

  return (
    <div>

      {/* ── Page header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Project Summary</p>
            <h1 className="text-xl font-bold text-gray-900">{projectName || 'Summary'}</h1>
            {dateRange && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {dateRange}
              </p>
            )}
          </div>
          <button
            onClick={() => router.push(`/clients/${clientId}/projects/${projectId}/expenses`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            View All Expenses
          </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="flex flex-wrap gap-4">
            {/* Date preset pills */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Period</p>
              <div className="flex flex-wrap gap-1.5">
                {DATE_PRESETS.map(p => (
                  <button key={p.key} onClick={() => setDatePreset(p.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      datePreset === p.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Divider */}
            <div className="w-px bg-gray-100 self-stretch" />
            {/* Status pills */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map(s => (
                  <button key={s.key} onClick={() => setStatusFilter(s.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      statusFilter === s.key
                        ? s.key === 'approved' ? 'bg-green-600 text-white'
                        : s.key === 'pending'  ? 'bg-orange-500 text-white'
                        : s.key === 'rejected' ? 'bg-red-500 text-white'
                        :                        'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Result count badge */}
            <div className="ml-auto self-center">
              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {filtered.length} of {expenses.length} expenses
              </span>
            </div>
          </div>
        </div>

        {/* ── KPI row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard label="Total Spend" accent
            value={`$${fmt$(totalAmount)}`}
            sub={`${filtered.length} expense${filtered.length !== 1 ? 's' : ''}`}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <KpiCard label="Approved"
            value={`$${fmt$(approvedAmount)}`}
            sub={`${approved.length} receipts`}
            subColor="text-green-600"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <KpiCard label="Pending Review"
            alert={pending.length > 0}
            value={`$${fmt$(pendingAmount)}`}
            sub={pending.length > 0 ? `${pending.length} awaiting` : 'All clear'}
            subColor={pending.length > 0 ? 'text-orange-500' : 'text-gray-400'}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <KpiCard label="Tax Collected"
            value={`$${fmt$(totalTax)}`}
            sub={totalAmount > 0 ? `${((totalTax / totalAmount) * 100).toFixed(1)}% rate` : ''}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>}
          />
          <KpiCard label="OCR Accuracy"
            value={`${Math.round(avgConf * 100)}%`}
            sub={avgConf >= 0.8 ? 'High quality' : avgConf >= 0.6 ? 'Review needed' : 'Manual check'}
            subColor={avgConf >= 0.8 ? 'text-green-600' : avgConf >= 0.6 ? 'text-yellow-600' : 'text-red-500'}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
          />
        </div>

        {/* ── Row: Approval pipeline + Tax pie ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Approval Pipeline"
            subtitle="Receipt flow from submission to approval">
            <ApprovalFunnel
              total={filtered.length}
              approved={approved.length}
              pending={pending.length}
              rejected={rejected.length}
            />
          </Section>

          <Section title="Tax vs. Non-Tax Spend"
            subtitle="For accounting & GST/HST reconciliation">
            <DonutChart slices={[
              { label: 'Net Spend',      value: totalAmount - totalTax, color: '#3b82f6', textColor: 'text-blue-600' },
              { label: 'Tax Collected',  value: totalTax,               color: '#f97316', textColor: 'text-orange-600' },
            ]} />
            {totalAmount > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-400">Net (pre-tax)</p>
                  <p className="text-lg font-bold text-gray-900">${fmt$(totalAmount - totalTax)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Tax reclaimable</p>
                  <p className="text-lg font-bold text-orange-600">${fmt$(totalTax)}</p>
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* ── Monthly spend chart ── */}
        {monthlyData.length > 0 && (
          <Section title="Monthly Spend"
            subtitle="Blue = approved · Orange = pending · Hover bars for details">
            {monthlyData.length === 1 ? (
              <div className="flex items-center gap-8 py-2">
                <div><p className="text-xs text-gray-400">Month</p><p className="text-lg font-bold">{monthlyData[0].label}</p></div>
                <div><p className="text-xs text-gray-400">Total</p><p className="text-lg font-bold">${fmt$(monthlyData[0].total)}</p></div>
                <div><p className="text-xs text-gray-400">Approved</p><p className="text-lg font-bold text-green-600">${fmt$(monthlyData[0].approved)}</p></div>
              </div>
            ) : (
              <ColumnChart data={monthlyData} />
            )}
          </Section>
        )}

        {/* ── OCR confidence heat ── */}
        <Section title="OCR Confidence Heat"
          subtitle="System accuracy breakdown"
          badge={
            <div className="text-right">
              <p className="text-[10px] text-gray-400 font-medium">System ROI</p>
              <p className="text-lg font-bold text-blue-600">
                {filtered.length > 0 ? Math.round((autoApproved / filtered.length) * 100) : 0}%
              </p>
            </div>
          }>
          <OcrHeat expenses={filtered} />
        </Section>

        {/* ── Vendor table ── */}
        <Section title="Vendor Breakdown"
          subtitle={`${vendorRows.length} vendor${vendorRows.length !== 1 ? 's' : ''} · sorted by spend`}>
          <VendorTable rows={vendorRows} totalAmount={totalAmount} />
        </Section>

        {/* ── Risk flags ── */}
        {riskItems.length > 0 && (
          <Section
            title="⚠ Needs Attention"
            subtitle={`${riskItems.length} pending receipt${riskItems.length !== 1 ? 's' : ''} with low OCR confidence`}
            badge={<span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">{riskItems.length} flagged</span>}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Vendor', 'Date', 'Amount', 'Confidence', ''].map(h => (
                      <th key={h} className={`pb-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 ${
                        h === 'Amount' ? 'text-right' : h === '' ? 'text-right' : 'text-left'
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {riskItems.map(e => {
                    const pct = Math.round((e.confidence_score || 0) * 100);
                    return (
                      <tr key={e.id}
                        onClick={() => router.push(`/clients/${clientId}/projects/${projectId}/expenses/${e.id}`)}
                        className="cursor-pointer hover:bg-amber-50/60 transition-colors group">
                        <td className="px-3 py-3 text-sm font-semibold text-gray-800 group-hover:text-amber-700">
                          {e.vendor_name || <span className="italic text-gray-400">Unknown</span>}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-500">
                          {e.expense_date ? fmtDate(e.expense_date) : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">
                          ${fmt$(e.total_amount || 0)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct < 60 ? 'bg-red-400' : 'bg-yellow-400'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-xs font-bold ${pct < 60 ? 'text-red-600' : 'text-yellow-600'}`}>{pct}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-500 ml-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        )}

      </div>
    </div>
  );
}
