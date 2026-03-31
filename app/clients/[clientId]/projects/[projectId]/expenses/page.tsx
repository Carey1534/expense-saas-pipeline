'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Expense, Project } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import DropZone from '@/components/DropZone';
import ExportButton from '@/components/ExportButton';
import { inferCategory, CATEGORIES } from '@/lib/categories';
import { useUploadPoller } from '@/hooks/useUploadPoller';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidPath(p: string) { return Boolean(p) && !p.includes('{{') && !p.includes('}}'); }
function isPdf(p: string) { return p.toLowerCase().endsWith('.pdf'); }
function fmt(date: string) {
  const [y, m, d] = date.split('-');
  return `${m}/${d}/${y}`;
}

// ─── Receipt thumbnail ────────────────────────────────────────────────────────

function ReceiptThumb({ filePath, vendorName, signedUrl }: { filePath?: string; vendorName?: string; signedUrl?: string }) {
  const valid = filePath && isValidPath(filePath);
  if (valid && !isPdf(filePath!) && signedUrl) {
    return (
      <div className="w-9 h-9 rounded-lg overflow-hidden border border-gray-200 shrink-0 bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={signedUrl} alt={vendorName || 'receipt'}
          className="w-full h-full object-cover"
          onError={e => { e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div>'; }}
        />
      </div>
    );
  }
  if (valid && isPdf(filePath!)) {
    return (
      <div className="w-9 h-9 rounded-lg border border-red-200 bg-red-50 flex items-center justify-center shrink-0">
        <span className="text-[8px] font-bold text-red-500 uppercase tracking-tight">PDF</span>
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
  );
}

// ─── Confidence bar ────────────────────────────────────────────────────────────

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const barStyle = pct >= 80
    ? { background: 'linear-gradient(90deg, #10b981, #059669)' }
    : pct >= 60
    ? { background: 'linear-gradient(90deg, #f59e0b, #d97706)' }
    : { background: 'linear-gradient(90deg, #f87171, #ef4444)' };
  const textColor = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-500';
  return (
    <div className="flex items-center gap-2 min-w-20">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, ...barStyle }} />
      </div>
      <span className={`text-[11px] font-bold w-8 text-right tabular-nums ${textColor}`}>{pct}%</span>
    </div>
  );
}

// ─── Animated number ──────────────────────────────────────────────────────────

function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const prevRef = useRef<number>(0);
  const DURATION = 800;

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    startRef.current = 0;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    function ease(t: number) { return 1 - Math.pow(1 - t, 3); }
    function tick(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const t = Math.min((ts - startRef.current) / DURATION, 1);
      setDisplay(from + (value - from) * ease(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  return <>{prefix}{display.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}

// ─── Budget bar ───────────────────────────────────────────────────────────────

function BudgetBar({ budget, spend }: { budget: number; spend: number }) {
  const pct = Math.min((spend / budget) * 100, 100);
  const remaining = budget - spend;
  const over = spend > budget;
  // Gradient bars for premium feel
  const barStyle = pct >= 90
    ? { background: 'linear-gradient(90deg, #ef4444, #dc2626)' }
    : pct >= 70
    ? { background: 'linear-gradient(90deg, #f59e0b, #d97706)' }
    : { background: 'linear-gradient(90deg, #10b981, #059669)' };
  const textAccent = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-yellow-600' : 'text-green-600';

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 font-medium">Budget</span>
          <span className="text-sm font-bold text-gray-800">
            ${budget.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <span className="text-[11px] text-gray-400 block leading-none mb-0.5">Spent</span>
            <span className="text-sm font-bold text-gray-800">
              ${spend.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-gray-400 block leading-none mb-0.5">{over ? 'Over' : 'Remaining'}</span>
            <span className={`text-sm font-bold ${over ? 'text-red-600' : textAccent}`}>
              {over ? '+' : ''}${Math.abs(remaining).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-gray-400 block leading-none mb-0.5">Used</span>
            <span className={`text-sm font-bold ${textAccent}`}>{pct.toFixed(1)}%</span>
          </div>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, ...barStyle }}
        />
      </div>
      {over && (
        <p className="text-[11px] text-red-500 font-semibold mt-1">
          ⚠️ Over budget by ${Math.abs(remaining).toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </p>
      )}
    </div>
  );
}

// ─── Set Budget Modal ─────────────────────────────────────────────────────────

function SetBudgetModal({ current, onSave, onClose }: {
  current?: number | null;
  onSave: (budget: number | null) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(current != null ? String(current) : '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const parsed = value.trim() === '' ? null : parseFloat(value.replace(/,/g, ''));
    onSave(parsed);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.15s_ease-out]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Set Project Budget</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Total Budget ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="e.g. 50000"
                autoFocus
                className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Leave blank to remove the budget</p>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1.5 transition-colors">
              {saving && <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />}
              Save Budget
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accent = false, alert = false,
}: {
  label: string; value: React.ReactNode; sub?: string; icon: React.ReactNode; accent?: boolean; alert?: boolean;
}) {
  return (
    <div className={`stat-card-accent card-hover relative bg-white rounded-2xl border shadow-sm overflow-hidden p-4 sm:p-5 flex items-start gap-3 sm:gap-4 ${
      alert ? 'border-orange-200 bg-linear-to-br from-orange-50/60 to-white' : 'border-gray-200'
    }`}>
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
        alert ? 'bg-orange-100 text-orange-500'
          : accent ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
          : 'bg-gray-100 text-gray-500'
      }`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-1">{label}</p>
        <p className={`text-2xl sm:text-3xl font-bold leading-none tabular-nums tracking-tight ${alert ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-1.5 leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Category tag ─────────────────────────────────────────────────────────────

function CategoryTag({ vendorName, amount }: { vendorName?: string | null; amount?: number | null }) {
  const cat = inferCategory(vendorName, amount);
  if (cat.key === 'other') return null; // Don't show tag for unrecognized
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${cat.color} ${cat.textColor} ${cat.borderColor} leading-none`}>
      <span className="text-[9px]">{cat.emoji}</span>
      {cat.label}
    </span>
  );
}

// ─── Duplicate warning ────────────────────────────────────────────────────────

function DuplicateWarning({ tooltip }: { tooltip: string }) {
  return (
    <span title={tooltip}
      className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200 leading-none cursor-help">
      ⚠️ Duplicate?
    </span>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, visible }: { message: string; type: 'success' | 'error'; visible: boolean }) {
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border transition-all duration-300 ${
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
    } ${type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {type === 'success'
        ? <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        : <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterStatus = 'all' | 'needs_review' | 'approved' | 'rejected';

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectExpensesPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [showSetBudget, setShowSetBudget] = useState(false);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'expense_date' | 'total_amount'>('expense_date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Inline action loading state
  const [actioning, setActioning] = useState<Record<string, 'APPROVED' | 'REJECTED'>>({});
  const [bulkActioning, setBulkActioning] = useState<'APPROVED' | 'REJECTED' | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }

  // When the poller finds a new expense, update the list and fetch its signed URL
  const handleNewExpenses = useCallback((data: Expense[]) => {
    setExpenses(data);
    data
      .filter(e => e.document_id && e.document?.file_path && isValidPath(e.document.file_path) && !isPdf(e.document.file_path))
      .forEach(async (e) => {
        try {
          const r = await fetch(`/api/documents/${e.document_id}/image`);
          if (r.ok) {
            const d = await r.json();
            setSignedUrls(prev => ({ ...prev, [e.document_id]: d.url }));
          }
        } catch { /* ignore */ }
      });
  }, []);

  const { startPolling, polling } = useUploadPoller<Expense>(
    `/api/projects/${projectId}/expenses`,
    expenses.length,
    handleNewExpenses,
  );

  useEffect(() => {
    async function load() {
      try {
        const [expRes, projRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/expenses`),
          fetch(`/api/projects/${projectId}`),
        ]);
        if (!expRes.ok) throw new Error('Failed to fetch expenses');
        const [exps, proj] = await Promise.all([expRes.json(), projRes.ok ? projRes.json() : null]);
        setExpenses(exps);
        if (proj) setProject(proj);

        // Fetch signed URLs progressively — update state as each one arrives
        (exps as Expense[])
          .filter(e => e.document_id && e.document?.file_path && isValidPath(e.document.file_path) && !isPdf(e.document.file_path))
          .forEach(async (e) => {
            try {
              const r = await fetch(`/api/documents/${e.document_id}/image`);
              if (r.ok) {
                const d = await r.json();
                setSignedUrls(prev => ({ ...prev, [e.document_id]: d.url }));
              }
            } catch { /* leave undefined */ }
          });
      } catch {
        setError('Failed to load expenses');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  async function handleSaveBudget(budget: number | null) {
    setShowSetBudget(false);
    const prevBudget = project?.budget;
    // Optimistic
    setProject(p => p ? { ...p, budget } : p);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json();
      setProject(updated);
    } catch {
      setProject(p => p ? { ...p, budget: prevBudget } : p);
      showToast('Failed to save budget', 'error');
    }
  }

  // ── Metrics ──────────────────────────────────────────────────────────────
  const totalAmount    = expenses.reduce((s, e) => s + (e.total_amount || 0), 0);
  const totalTax       = expenses.reduce((s, e) => s + (e.tax_amount || 0), 0);
  const receiptCount   = expenses.filter(e => e.document_id).length;
  const needsReview    = expenses.filter(e => e.status === 'PENDING_APPROVAL' || e.status === 'DRAFT').length;
  const approvedCount  = expenses.filter(e => e.status === 'APPROVED').length;
  const pendingSpend   = expenses
    .filter(e => e.status === 'PENDING_APPROVAL' || e.status === 'DRAFT' || e.status === 'EXTRACTED')
    .reduce((s, e) => s + (e.total_amount || 0), 0);

  // ── Duplicate detection ───────────────────────────────────────────────────
  // Flag expenses that share the same vendor + date + amount within ±5% tolerance
  const duplicateSet = useMemo(() => {
    const dupes = new Set<string>();
    // Build a key → [ids] map
    const keyMap: Record<string, string[]> = {};
    for (const e of expenses) {
      const vendor = (e.vendor_name || '').toLowerCase().trim();
      const date = e.expense_date || '';
      const amount = Math.round((e.total_amount ?? 0) * 100); // cents
      // Bucket by vendor + date + rounded-to-nearest-5% amount
      const bucket = Math.round(amount / 50) * 50;
      const key = `${vendor}|${date}|${bucket}`;
      if (!keyMap[key]) keyMap[key] = [];
      keyMap[key].push(e.id);
    }
    for (const ids of Object.values(keyMap)) {
      if (ids.length > 1) {
        ids.forEach(id => dupes.add(id));
      }
    }
    return dupes;
  }, [expenses]);

  // ── Duplicate metadata for tooltip ───────────────────────────────────────
  const duplicateInfo = useMemo(() => {
    const info: Record<string, string> = {};
    for (const e of expenses) {
      if (!duplicateSet.has(e.id)) continue;
      const similar = expenses.filter(o =>
        o.id !== e.id &&
        (o.vendor_name || '').toLowerCase() === (e.vendor_name || '').toLowerCase() &&
        o.expense_date === e.expense_date
      );
      if (similar.length > 0) {
        const dates = similar.map(o => o.expense_date || '—').join(', ');
        info[e.id] = `Possible duplicate — same vendor & date as ${similar.length} other receipt(s) (${dates})`;
      } else {
        info[e.id] = 'Possible duplicate — similar vendor, date, and amount found';
      }
    }
    return info;
  }, [expenses, duplicateSet]);

  // ── Category breakdown (for filter) ──────────────────────────────────────
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      const cat = inferCategory(e.vendor_name, e.total_amount);
      map[cat.key] = (map[cat.key] || 0) + 1;
    }
    return map;
  }, [expenses]);

  // ── Vendor YTD totals (for tooltip) ──────────────────────────────────────
  const vendorTotals = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const e of expenses) {
      const v = e.vendor_name || 'Unknown';
      if (!map[v]) map[v] = { total: 0, count: 0 };
      map[v].total += e.total_amount || 0;
      map[v].count += 1;
    }
    return map;
  }, [expenses]);

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...expenses];
    if (statusFilter === 'needs_review') list = list.filter(e => e.status === 'PENDING_APPROVAL' || e.status === 'DRAFT');
    else if (statusFilter === 'approved') list = list.filter(e => e.status === 'APPROVED');
    else if (statusFilter === 'rejected') list = list.filter(e => e.status === 'REJECTED');
    if (categoryFilter !== 'all') {
      list = list.filter(e => inferCategory(e.vendor_name, e.total_amount).key === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => (e.vendor_name || '').toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [expenses, statusFilter, categoryFilter, search, sortField, sortDir]);

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  }

  function SortIcon({ field }: { field: typeof sortField }) {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allFilteredSelected = filtered.length > 0 && filtered.every(e => selected.has(e.id));
  const someSelected = selected.size > 0;

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(e => next.delete(e.id));
        return next;
      });
    } else {
      setSelected(prev => new Set([...prev, ...filtered.map(e => e.id)]));
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Single approve/reject (inline) ────────────────────────────────────────
  const handleDecision = useCallback(async (expense: Expense, decision: 'APPROVED' | 'REJECTED', e: React.MouseEvent) => {
    e.stopPropagation();
    if (actioning[expense.id]) return;

    // Optimistic update
    setActioning(prev => ({ ...prev, [expense.id]: decision }));
    const previousStatus = expense.status;
    setExpenses(prev => prev.map(x => x.id === expense.id ? { ...x, status: decision } : x));

    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: expense.org_id, expense_id: expense.id, decision }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Rollback
        setExpenses(prev => prev.map(x => x.id === expense.id ? { ...x, status: previousStatus } : x));
        showToast(data.error || 'Failed to update expense', 'error');
      } else {
        showToast(decision === 'APPROVED' ? 'Approved ✓' : 'Rejected', decision === 'APPROVED' ? 'success' : 'error');
      }
    } catch {
      setExpenses(prev => prev.map(x => x.id === expense.id ? { ...x, status: previousStatus } : x));
      showToast('Network error', 'error');
    } finally {
      setActioning(prev => { const n = { ...prev }; delete n[expense.id]; return n; });
    }
  }, [actioning]);

  // ── Bulk approve/reject ───────────────────────────────────────────────────
  async function handleBulkDecision(decision: 'APPROVED' | 'REJECTED') {
    const ids = Array.from(selected);
    const toProcess = expenses.filter(e => ids.includes(e.id) && (e.status === 'PENDING_APPROVAL' || e.status === 'DRAFT'));
    if (toProcess.length === 0) {
      showToast('No pending expenses selected', 'error');
      return;
    }
    setBulkActioning(decision);

    // Optimistic
    const previousStatuses: Record<string, string> = {};
    toProcess.forEach(e => { previousStatuses[e.id] = e.status || ''; });
    setExpenses(prev => prev.map(x => toProcess.find(t => t.id === x.id) ? { ...x, status: decision } : x));

    let successCount = 0;
    let failCount = 0;

    await Promise.all(toProcess.map(async (expense) => {
      try {
        const res = await fetch('/api/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: expense.org_id, expense_id: expense.id, decision }),
        });
        if (res.ok) { successCount++; }
        else {
          failCount++;
          setExpenses(prev => prev.map(x => x.id === expense.id ? { ...x, status: previousStatuses[expense.id] as any } : x));
        }
      } catch {
        failCount++;
        setExpenses(prev => prev.map(x => x.id === expense.id ? { ...x, status: previousStatuses[expense.id] as any } : x));
      }
    }));

    setBulkActioning(null);
    setSelected(new Set());

    if (failCount === 0) {
      showToast(`${successCount} expense${successCount !== 1 ? 's' : ''} ${decision === 'APPROVED' ? 'approved' : 'rejected'}`, 'success');
    } else {
      showToast(`${successCount} succeeded, ${failCount} failed`, 'error');
    }
  }

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-24 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-9 w-24 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
        <div className="px-6 py-6 space-y-6">
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-200 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                  <div className="h-7 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-2.5 w-16 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <div className="h-9 w-56 bg-white border border-gray-200 rounded-lg animate-pulse" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 w-24 bg-white border border-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3 flex gap-4">
              {[20, 48, 160, 80, 80, 80, 100, 80].map((w, i) => (
                <div key={i} className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: w }} />
              ))}
            </div>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="px-4 py-3.5 border-b border-gray-50 flex items-center gap-4">
                <div className="w-4 h-4 rounded bg-gray-100 animate-pulse flex-shrink-0" />
                <div className="w-9 h-9 rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
                <div className="h-4 w-36 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                <div className="ml-auto h-4 w-16 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-14 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                <div className="h-5 w-24 bg-gray-100 rounded-full animate-pulse" />
                <div className="h-6 w-16 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const selectedPendingCount = Array.from(selected).filter(id => {
    const e = expenses.find(x => x.id === id);
    return e && (e.status === 'PENDING_APPROVAL' || e.status === 'DRAFT');
  }).length;

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} visible={toastVisible} />}
      {showSetBudget && (
        <SetBudgetModal
          current={project?.budget}
          onSave={handleSaveBudget}
          onClose={() => setShowSetBudget(false)}
        />
      )}

      <div className="min-h-screen bg-[#f4f5f7]">

        {/* ── Page header ── */}
        <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 sm:py-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Project</p>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">{project?.name || 'Expenses'}</h1>
                {polling && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    Waiting for OCR…
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ExportButton />
              {/* Upload button — hidden on mobile (FAB is used instead) */}
              <div className="hidden sm:block">
                <DropZone mode="button" projectId={projectId} clientId={clientId} onAllDone={startPolling} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Job Cost Dashboard ── */}
        <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-6">
            {/* Left: label */}
            <div className="flex-shrink-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Job Cost</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {expenses.filter(e => e.status === 'APPROVED').length} approved receipts
              </p>
            </div>

            {/* Divider */}
            <div className="w-px h-10 bg-gray-100 flex-shrink-0" />

            {/* Budget bar — only if budget set */}
            {project?.budget != null && project.budget > 0 ? (
              <BudgetBar budget={project.budget} spend={totalAmount} />
            ) : (
              /* No budget set — show compact spend + prompt */
              <div className="flex-1 flex items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[11px] text-gray-400 font-medium mb-0.5">Current Spend</p>
                    <p className="text-xl font-bold text-gray-900">
                      ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 font-medium mb-0.5">Tax</p>
                    <p className="text-xl font-bold text-gray-900">
                      ${totalTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 font-medium mb-0.5">Receipts</p>
                    <p className="text-xl font-bold text-gray-900">{receiptCount}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSetBudget(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Set Budget
                </button>
              </div>
            )}

            {/* Edit budget button (when budget exists) */}
            {project?.budget != null && project.budget > 0 && (
              <button
                onClick={() => setShowSetBudget(true)}
                title="Edit budget"
                className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Sticky filter bar ── */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm px-3 sm:px-6 py-3 space-y-2.5">
          {/* Search + status pills */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 min-w-0 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search vendor…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {([
                { key: 'all', label: 'All', count: expenses.length },
                { key: 'needs_review', label: 'Needs Review', count: needsReview },
                { key: 'approved', label: 'Approved', count: approvedCount },
                { key: 'rejected', label: 'Rejected', count: expenses.filter(e => e.status === 'REJECTED').length },
              ] as { key: FilterStatus; label: string; count: number }[]).map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    statusFilter === f.key
                      ? f.key === 'needs_review' ? 'bg-orange-500 text-white'
                      : f.key === 'approved' ? 'bg-green-600 text-white'
                      : f.key === 'rejected' ? 'bg-red-500 text-white'
                      : 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
                  }`}>
                  {f.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusFilter === f.key ? 'bg-white/25' : 'bg-gray-100 text-gray-500'}`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            <p className="text-xs text-gray-400 ml-auto whitespace-nowrap">{filtered.length} of {expenses.length}</p>
          </div>

          {/* Category filter */}
          {expenses.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0">Category:</span>
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  categoryFilter === 'all'
                    ? 'bg-gray-800 text-white border-transparent'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                All
              </button>
              {CATEGORIES.filter(c => c.key !== 'other' && (categoryBreakdown[c.key] || 0) > 0).map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setCategoryFilter(categoryFilter === cat.key ? 'all' : cat.key)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                    categoryFilter === cat.key
                      ? `${cat.color} ${cat.textColor} ${cat.borderColor} opacity-100`
                      : `bg-white ${cat.textColor} ${cat.borderColor} hover:${cat.color}`
                  }`}
                >
                  <span className="text-[10px]">{cat.emoji}</span>
                  {cat.label}
                  <span className={`text-[10px] font-bold ml-0.5 opacity-70`}>{categoryBreakdown[cat.key]}</span>
                </button>
              ))}
              {(categoryBreakdown['other'] || 0) > 0 && (
                <button
                  onClick={() => setCategoryFilter(categoryFilter === 'other' ? 'all' : 'other')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                    categoryFilter === 'other'
                      ? 'bg-gray-200 text-gray-700 border-gray-300'
                      : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  📦 Other ({categoryBreakdown['other']})
                </button>
              )}
            </div>
          )}
        </div>

        <div className="px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-24 sm:pb-6">

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
            <StatCard label="Total Expenses"
              value={<AnimatedNumber value={totalAmount} prefix="$" decimals={2} />}
              sub={`${expenses.length} line item${expenses.length !== 1 ? 's' : ''}`} accent
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            <StatCard label="Tax Total"
              value={<AnimatedNumber value={totalTax} prefix="$" decimals={2} />}
              sub={totalAmount > 0 ? `${((totalTax / totalAmount) * 100).toFixed(1)}% of spend` : undefined}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>} />
            <StatCard label="# of Receipts"
              value={<AnimatedNumber value={receiptCount} />}
              sub={`${approvedCount} approved`}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>} />
            <StatCard label="Pending Spend"
              value={<AnimatedNumber value={pendingSpend} prefix="$" decimals={2} />}
              sub={pendingSpend > 0 ? `${needsReview} awaiting approval` : 'All approved'}
              alert={pendingSpend > 0}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            <StatCard label="Needs Review"
              value={<AnimatedNumber value={needsReview} />}
              sub={needsReview > 0 ? 'Awaiting approval' : 'All clear'} alert={needsReview > 0}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>} />
          </div>

          {/* ── Review Queue CTA ── */}
          {needsReview > 0 && (
            <div className="flex items-center justify-between gap-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 animate-[fadeIn_0.3s_ease-out]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-orange-800">
                    {needsReview} expense{needsReview !== 1 ? 's' : ''} need{needsReview === 1 ? 's' : ''} review
                  </p>
                  <p className="text-xs text-orange-600">Review AI-extracted fields and approve after correction</p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/clients/${clientId}/projects/${projectId}/review`)}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Open Review Queue
              </button>
            </div>
          )}

          {/* ── Bulk action bar ── */}
          {someSelected && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 animate-[fadeIn_0.15s_ease-out]">
              <span className="text-sm font-semibold text-blue-700">
                {selected.size} selected
                {selectedPendingCount > 0 && selectedPendingCount < selected.size && (
                  <span className="text-blue-500 font-normal ml-1">({selectedPendingCount} pending)</span>
                )}
              </span>
              <div className="flex items-center gap-2 ml-auto">
                {selectedPendingCount > 0 && (
                  <>
                    <button
                      onClick={() => handleBulkDecision('APPROVED')}
                      disabled={bulkActioning !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors"
                    >
                      {bulkActioning === 'APPROVED'
                        ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                        : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                      Approve {selectedPendingCount}
                    </button>
                    <button
                      onClick={() => handleBulkDecision('REJECTED')}
                      disabled={bulkActioning !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 disabled:opacity-60 transition-colors"
                    >
                      {bulkActioning === 'REJECTED'
                        ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-500" />
                        : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>}
                      Reject {selectedPendingCount}
                    </button>
                  </>
                )}
                <button onClick={() => setSelected(new Set())}
                  className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors">
                  Clear
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
          )}

          {/* ── Table (always shown) ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden card-hover">
            <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {/* Select all checkbox */}
                  <th className="pl-4 pr-2 py-3 w-8">
                    <input type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      disabled={expenses.length === 0}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600 disabled:opacity-30"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest w-10">Receipt</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Vendor</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest cursor-pointer hover:text-gray-700 select-none"
                    onClick={() => toggleSort('expense_date')}>
                    Date <SortIcon field="expense_date" />
                  </th>
                  <th className="px-3 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest cursor-pointer hover:text-gray-700 select-none"
                    onClick={() => toggleSort('total_amount')}>
                    Total <SortIcon field="total_amount" />
                  </th>
                  <th className="px-3 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tax</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                  <th className="px-3 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">

                {/* ── Empty state inside table ── */}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12">
                      <div className="max-w-sm mx-auto text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="text-gray-700 font-semibold mb-1">No expenses yet</p>
                        <p className="text-sm text-gray-400 mb-5">Upload receipts to start tracking job costs</p>
                        <DropZone mode="inline" projectId={projectId} clientId={clientId} onAllDone={startPolling} />
                      </div>
                    </td>
                  </tr>
                )}

                {/* ── Filter empty state ── */}
                {expenses.length > 0 && filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <p className="text-gray-500 font-medium mb-2">No expenses match your filters</p>
                      <button onClick={() => { setSearch(''); setStatusFilter('all'); setCategoryFilter('all'); }}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                        Clear all filters
                      </button>
                    </td>
                  </tr>
                )}
                  {filtered.map((expense) => {
                    const isSelected = selected.has(expense.id);
                    const isActioning = !!actioning[expense.id];
                    const canDecide = expense.status === 'PENDING_APPROVAL' || expense.status === 'DRAFT';
                    const docPath = expense.document?.file_path;
                    const hasDoc = docPath && isValidPath(docPath);
                    const docUrl = hasDoc && expense.document_id ? (signedUrls[expense.document_id] ?? null) : null;

                    return (
                      <tr
                        key={expense.id}
                        onClick={() => router.push(`/clients/${clientId}/projects/${projectId}/expenses/${expense.id}`)}
                        className={`cursor-pointer transition-colors group ${
                          isSelected ? 'bg-blue-50/80' : 'hover:bg-gray-50'
                        } ${isActioning ? 'opacity-70' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="pl-4 pr-2 py-3" onClick={e => { e.stopPropagation(); toggleSelect(expense.id); }}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(expense.id)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600" />
                        </td>

                        {/* Receipt thumb */}
                        <td className="px-3 py-3">
                          <ReceiptThumb filePath={docPath} vendorName={expense.vendor_name ?? undefined} signedUrl={expense.document_id ? signedUrls[expense.document_id] : undefined} />
                        </td>

                        {/* Vendor + category tag + duplicate warning */}
                        <td className="px-3 py-3">
                          {(() => {
                            const vName = expense.vendor_name || 'Unknown';
                            const vData = vendorTotals[vName];
                            const tooltipText = vData
                              ? `${vName}: $${vData.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total · ${vData.count} receipt${vData.count !== 1 ? 's' : ''} on this job`
                              : undefined;
                            return (
                              <>
                                <p
                                  className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition-colors leading-tight cursor-help"
                                  title={tooltipText}
                                >
                                  {expense.vendor_name || <span className="text-gray-400 font-normal italic">Unknown vendor</span>}
                                </p>
                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                  <CategoryTag vendorName={expense.vendor_name} amount={expense.total_amount} />
                                  {duplicateSet.has(expense.id) && (
                                    <DuplicateWarning tooltip={duplicateInfo[expense.id] || 'Possible duplicate'} />
                                  )}
                                  {vData && vData.count > 1 && (
                                    <span className="text-[10px] text-gray-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                      ${vData.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
                                    </span>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </td>

                        {/* Date */}
                        <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {expense.expense_date ? fmt(expense.expense_date) : '—'}
                        </td>

                        {/* Total */}
                        <td className="px-3 py-3 text-right">
                          <span className="text-sm font-bold text-gray-900 tabular-nums">
                            ${(expense.total_amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Tax */}
                        <td className="px-3 py-3 text-right text-sm text-gray-500">
                          ${(expense.tax_amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3">
                          <StatusBadge status={expense.status} />
                        </td>

                        {/* Quick actions */}
                        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">

                            {/* View receipt */}
                            {docUrl && (
                              <a href={docUrl} target="_blank" rel="noopener noreferrer"
                                className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="View receipt">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            )}

                            {/* Approve (inline) */}
                            {canDecide && (
                              <button
                                onClick={(e) => handleDecision(expense, 'APPROVED', e)}
                                disabled={isActioning}
                                title="Approve"
                                className="p-1.5 rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40"
                              >
                                {isActioning && actioning[expense.id] === 'APPROVED'
                                  ? <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-green-500 block" />
                                  : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                              </button>
                            )}

                            {/* Reject (inline) */}
                            {canDecide && (
                              <button
                                onClick={(e) => handleDecision(expense, 'REJECTED', e)}
                                disabled={isActioning}
                                title="Reject"
                                className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                              >
                                {isActioning && actioning[expense.id] === 'REJECTED'
                                  ? <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-red-500 block" />
                                  : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>}
                              </button>
                            )}

                            {/* Edit (pencil) — opens review queue */}
                            <button
                              onClick={() => router.push(`/clients/${clientId}/projects/${projectId}/review`)}
                              title="Edit in Review Queue"
                              className="p-1.5 rounded-md text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>

                            {/* Open detail */}
                            <button
                              onClick={() => router.push(`/clients/${clientId}/projects/${projectId}/expenses/${expense.id}`)}
                              title="Open detail"
                              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>{/* end overflow-x-auto */}

              {/* Table footer */}
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {filtered.length} expense{filtered.length !== 1 ? 's' : ''}
                  {someSelected && <span className="ml-2 text-blue-600 font-medium">· {selected.size} selected</span>}
                </p>
                <p className="text-xs font-semibold text-gray-700">
                  Total: ${filtered.reduce((s, e) => s + (e.total_amount || 0), 0)
                    .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
        </div>
      </div>

      {/* ── Mobile floating upload FAB ── */}
      {/* Mobile floating upload button — passes project context same as desktop */}
      <div className="fixed bottom-6 right-4 z-40 sm:hidden drop-shadow-xl">
        <DropZone mode="fab" projectId={projectId} clientId={clientId} onAllDone={startPolling} />
      </div>
    </>
  );
}
