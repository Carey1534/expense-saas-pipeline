'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Expense } from '@/lib/types';
import ImageViewer from '@/components/ImageViewer';
import { inferCategory } from '@/lib/categories';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewField {
  vendor_name: string;
  expense_date: string;
  total_amount: string;   // string for editing
  tax_amount: string;     // string for editing
}

interface ReviewItem {
  expense: Expense;
  draft: ReviewField;
  dirty: boolean;
  saving: boolean;
  deciding: 'APPROVED' | 'REJECTED' | null;
  done: boolean;
  error: string | null;
}

// ─── Confidence helpers ───────────────────────────────────────────────────────

function confColor(score: number): { border: string; bg: string; text: string; label: string } {
  if (score >= 0.85) return { border: 'border-green-300', bg: 'bg-green-50', text: 'text-green-700', label: 'High' };
  if (score >= 0.65) return { border: 'border-yellow-300', bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Med' };
  return { border: 'border-red-300', bg: 'bg-red-50', text: 'text-red-700', label: 'Low' };
}

// Per-field confidence from a flat confidence_score — in real world each field
// would have its own score. We simulate field-level confidence using the overall
// score plus small deterministic offsets so the UX is meaningful.
function fieldConf(score: number, offset: number): number {
  return Math.max(0, Math.min(1, score + offset));
}

function FieldConf({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const c = confColor(score);
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.bg} ${c.text} border ${c.border} ml-1.5 leading-none`}>
      {pct}%
    </span>
  );
}

// ─── Editable field ───────────────────────────────────────────────────────────

interface EditableFieldProps {
  label: string;
  value: string;
  fieldScore: number;
  onChange: (v: string) => void;
  type?: 'text' | 'number' | 'date';
  prefix?: string;
  disabled?: boolean;
}

function EditableField({ label, value, fieldScore, onChange, type = 'text', prefix, disabled }: EditableFieldProps) {
  const c = confColor(fieldScore);
  const isLow = fieldScore < 0.65;
  const isMed = fieldScore >= 0.65 && fieldScore < 0.85;

  return (
    <div>
      <div className="flex items-center mb-1">
        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
        <FieldConf score={fieldScore} />
      </div>
      <div className={`flex items-center rounded-lg border-2 transition-colors ${
        disabled ? 'bg-gray-50 border-gray-200' :
        isLow ? 'border-red-300 bg-red-50 focus-within:border-red-400 focus-within:bg-white' :
        isMed ? 'border-yellow-300 bg-yellow-50 focus-within:border-yellow-400 focus-within:bg-white' :
        'border-green-300 bg-green-50 focus-within:border-green-400 focus-within:bg-white'
      }`}>
        {prefix && (
          <span className={`pl-2.5 text-sm font-medium ${
            disabled ? 'text-gray-400' :
            isLow ? 'text-red-500' : isMed ? 'text-yellow-600' : 'text-green-600'
          }`}>{prefix}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          step={type === 'number' ? '0.01' : undefined}
          className={`flex-1 px-2.5 py-2 text-sm bg-transparent outline-none rounded-lg font-medium ${
            disabled ? 'text-gray-400 cursor-not-allowed' :
            isLow ? 'text-red-800 placeholder-red-300' :
            isMed ? 'text-yellow-800 placeholder-yellow-300' :
            'text-green-800 placeholder-green-300'
          }`}
        />
      </div>
    </div>
  );
}

// ─── Vendor field with autocomplete ──────────────────────────────────────────

function VendorField({ value, fieldScore, onChange, disabled, suggestions }: {
  value: string;
  fieldScore: number;
  onChange: (v: string) => void;
  disabled?: boolean;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const c = confColor(fieldScore);
  const isLow = fieldScore < 0.65;
  const isMed = fieldScore >= 0.65 && fieldScore < 0.85;

  // Filter suggestions by current input
  const matches = suggestions.filter(s =>
    s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()
  ).slice(0, 6);

  // Inferred category for live display
  const cat = inferCategory(value);
  const showCat = cat.key !== 'other' && value.trim().length > 2;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={wrapRef}>
      <div className="flex items-center mb-1">
        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Vendor</label>
        <FieldConf score={fieldScore} />
        {showCat && (
          <span className={`ml-2 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${cat.color} ${cat.textColor} ${cat.borderColor} leading-none`}>
            <span className="text-[9px]">{cat.emoji}</span>{cat.label}
          </span>
        )}
      </div>
      <div className="relative">
        <div className={`flex items-center rounded-lg border-2 transition-colors ${
          disabled ? 'bg-gray-50 border-gray-200' :
          isLow ? 'border-red-300 bg-red-50 focus-within:border-red-400 focus-within:bg-white' :
          isMed ? 'border-yellow-300 bg-yellow-50 focus-within:border-yellow-400 focus-within:bg-white' :
          'border-green-300 bg-green-50 focus-within:border-green-400 focus-within:bg-white'
        }`}>
          <input
            type="text"
            value={value}
            disabled={disabled}
            onFocus={() => { setFocused(true); setOpen(true); }}
            onBlur={() => setFocused(false)}
            onChange={e => { onChange(e.target.value); setOpen(true); }}
            className={`flex-1 px-2.5 py-2 text-sm bg-transparent outline-none rounded-lg font-medium ${
              disabled ? 'text-gray-400 cursor-not-allowed' :
              isLow ? 'text-red-800' : isMed ? 'text-yellow-800' : 'text-green-800'
            }`}
          />
          {value && !disabled && (
            <button type="button" onClick={() => onChange('')}
              className="pr-2 text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {open && !disabled && matches.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
            {matches.map(s => {
              const sCat = inferCategory(s);
              return (
                <button
                  key={s}
                  type="button"
                  onMouseDown={e => e.preventDefault()} // prevent blur
                  onClick={() => { onChange(s); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 transition-colors"
                >
                  {sCat.key !== 'other' && (
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${sCat.color} ${sCat.textColor} ${sCat.borderColor} flex-shrink-0`}>
                      <span className="text-[9px]">{sCat.emoji}</span>{sCat.label}
                    </span>
                  )}
                  <span className="font-medium text-gray-800">{s}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Confidence bar (overall) ─────────────────────────────────────────────────

function ConfBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const c = confColor(score);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            score >= 0.85 ? 'bg-green-500' : score >= 0.65 ? 'bg-yellow-400' : 'bg-red-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-bold w-9 text-right ${c.text}`}>{pct}%</span>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${c.bg} ${c.text} border ${c.border}`}>
        {c.label}
      </span>
    </div>
  );
}

// ─── Receipt thumbnail / viewer ───────────────────────────────────────────────

function ReceiptPreview({ expense, expanded, onToggle, signedSrc }: {
  expense: Expense;
  expanded: boolean;
  onToggle: () => void;
  signedSrc?: string;
}) {
  const filePath = expense.document?.file_path;
  const hasValidPath = filePath && !filePath.includes('{{');
  const src = hasValidPath ? (signedSrc ?? null) : null;
  const isPdf = filePath?.toLowerCase().endsWith('.pdf') ?? false;

  if (!src) {
    return (
      <div className="h-16 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400 border border-dashed border-gray-300">
        No receipt
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full text-left"
      >
        {isPdf ? (
          <div className="h-16 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center gap-2 text-xs text-blue-600 font-medium hover:bg-blue-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {expanded ? 'Hide PDF' : 'View PDF'}
          </div>
        ) : (
          <div className="relative h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors group">
            <img src={src} alt="Receipt thumbnail" className="w-full h-full object-cover object-top" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-black/60 px-2 py-0.5 rounded transition-opacity">
                {expanded ? 'Collapse' : 'Expand'}
              </span>
            </div>
          </div>
        )}
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
          <ImageViewer
            src={src}
            alt={`Receipt from ${expense.vendor_name || 'vendor'}`}
            fileName={filePath!.split('/').pop() || 'receipt'}
            isPdf={isPdf}
          />
        </div>
      )}
    </div>
  );
}

// ─── Review Card ─────────────────────────────────────────────────────────────

function ReviewCard({
  item,
  index,
  onFieldChange,
  onDecision,
  onSaveAndApprove,
  vendorSuggestions,
  signedSrc,
}: {
  item: ReviewItem;
  index: number;
  onFieldChange: (id: string, field: keyof ReviewField, value: string) => void;
  onDecision: (id: string, decision: 'APPROVED' | 'REJECTED') => void;
  onSaveAndApprove: (id: string) => void;
  vendorSuggestions: string[];
  signedSrc?: string;
}) {
  const { expense, draft, dirty, saving, deciding, done, error } = item;
  const [receiptExpanded, setReceiptExpanded] = useState(false);
  const score = expense.confidence_score ?? 0;
  const c = confColor(score);
  const disabled = done || saving || deciding !== null;

  // Field-level simulated confidence
  const vendorConf = fieldConf(score, -0.05);
  const dateConf = fieldConf(score, +0.04);
  const totalConf = fieldConf(score, +0.02);
  const taxConf = fieldConf(score, -0.08);

  if (done) {
    return (
      <div className={`rounded-xl border-2 border-green-300 bg-green-50 p-4 flex items-center gap-3 animate-[fadeIn_0.3s_ease-out]`}>
        <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-green-800">
            {expense.vendor_name || 'Expense'} — {deciding === 'REJECTED' ? 'Rejected' : 'Approved'}
          </p>
          <p className="text-xs text-green-600">Removed from review queue</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm transition-all ${
      score < 0.65 ? 'border-red-200' : score < 0.85 ? 'border-yellow-200' : 'border-green-200'
    }`}>
      {/* Card header */}
      <div className={`px-4 py-3 rounded-t-xl border-b ${
        score < 0.65 ? 'bg-red-50 border-red-100' : score < 0.85 ? 'bg-yellow-50 border-yellow-100' : 'bg-green-50 border-green-100'
      } flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-bold text-gray-400 w-5 text-right flex-shrink-0">#{index + 1}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{expense.vendor_name || 'Unknown Vendor'}</p>
            <p className="text-[11px] text-gray-500">
              ${expense.total_amount?.toFixed(2)} · {expense.expense_date ?? '—'}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 w-48">
          <ConfBar score={score} />
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left: receipt */}
          <div className="lg:col-span-1">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Receipt</p>
            <ReceiptPreview
              expense={expense}
              expanded={receiptExpanded}
              onToggle={() => setReceiptExpanded(v => !v)}
              signedSrc={signedSrc}
            />
            {signedSrc && (
              <a
                href={signedSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open full size
              </a>
            )}
          </div>

          {/* Right: fields */}
          <div className="lg:col-span-2 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <VendorField
                value={draft.vendor_name}
                fieldScore={vendorConf}
                onChange={v => onFieldChange(expense.id, 'vendor_name', v)}
                disabled={disabled}
                suggestions={vendorSuggestions}
              />
              <EditableField
                label="Date"
                value={draft.expense_date}
                fieldScore={dateConf}
                type="date"
                onChange={v => onFieldChange(expense.id, 'expense_date', v)}
                disabled={disabled}
              />
              <EditableField
                label="Total Amount"
                value={draft.total_amount}
                fieldScore={totalConf}
                type="number"
                prefix="$"
                onChange={v => onFieldChange(expense.id, 'total_amount', v)}
                disabled={disabled}
              />
              <EditableField
                label="Tax Amount"
                value={draft.tax_amount}
                fieldScore={taxConf}
                type="number"
                prefix="$"
                onChange={v => onFieldChange(expense.id, 'tax_amount', v)}
                disabled={disabled}
              />
            </div>

            {/* Confidence legend */}
            <div className="flex items-center gap-3 pt-1">
              <span className="text-[10px] text-gray-400 font-medium">Field confidence:</span>
              <span className="flex items-center gap-1 text-[10px] text-red-600"><span className="w-2.5 h-2.5 rounded-sm bg-red-200 border border-red-300 inline-block" /> Low (&lt;65%)</span>
              <span className="flex items-center gap-1 text-[10px] text-yellow-600"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-200 border border-yellow-300 inline-block" /> Med (65–84%)</span>
              <span className="flex items-center gap-1 text-[10px] text-green-600"><span className="w-2.5 h-2.5 rounded-sm bg-green-200 border border-green-300 inline-block" /> High (≥85%)</span>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              {dirty ? (
                <button
                  onClick={() => onSaveAndApprove(expense.id)}
                  disabled={disabled}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 active:scale-[0.98]"
                >
                  {saving ? (
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                  )}
                  Save & Approve
                </button>
              ) : (
                <button
                  onClick={() => onDecision(expense.id, 'APPROVED')}
                  disabled={disabled}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 active:scale-[0.98]"
                >
                  {deciding === 'APPROVED' ? (
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Approve
                </button>
              )}

              <button
                onClick={() => onDecision(expense.id, 'REJECTED')}
                disabled={disabled}
                className="flex items-center justify-center gap-1.5 bg-white border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 active:scale-[0.98]"
              >
                {deciding === 'REJECTED' ? (
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-red-500" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                Reject
              </button>

              <a
                href={`../expenses/${expense.id}`}
                className="ml-auto text-xs text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                Full detail
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, visible }: { message: string; type: 'success' | 'error'; visible: boolean }) {
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border transition-all duration-300 max-w-sm ${
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
    } ${type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {type === 'success' ? (
        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReviewQueuePage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const projectId = params.projectId as string;

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3500);
  }

  // Fetch pending/draft expenses + project name
  useEffect(() => {
    async function load() {
      try {
        const [expRes, projRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/expenses`),
          fetch(`/api/clients/${clientId}/projects`),
        ]);

        if (!expRes.ok) throw new Error('Failed to load expenses');
        const allExpenses: Expense[] = await expRes.json();

        // Only keep pending/draft
        const reviewable = allExpenses.filter(e =>
          e.status === 'PENDING_APPROVAL' || e.status === 'DRAFT' || e.status === 'EXTRACTED'
        );

        // Sort by confidence ascending (lowest first = most important to review)
        reviewable.sort((a, b) => (a.confidence_score ?? 1) - (b.confidence_score ?? 1));

        setItems(reviewable.map(e => ({
          expense: e,
          draft: {
            vendor_name: e.vendor_name ?? '',
            expense_date: e.expense_date ?? '',
            total_amount: e.total_amount != null ? String(e.total_amount) : '',
            tax_amount: e.tax_amount != null ? String(e.tax_amount) : '',
          },
          dirty: false,
          saving: false,
          deciding: null,
          done: false,
          error: null,
        })));

        if (projRes.ok) {
          const projects = await projRes.json();
          const proj = projects.find((p: { id: string; name: string }) => p.id === projectId);
          if (proj) setProjectName(proj.name);
        }

        // Fetch signed URLs progressively — update state as each one arrives
        reviewable
          .filter(e => e.document_id && e.document?.file_path && !e.document.file_path.includes('{{'))
          .forEach(async (e) => {
            try {
              const r = await fetch(`/api/documents/${e.document_id}/image`);
              if (r.ok) {
                const d = await r.json();
                setSignedUrls(prev => ({ ...prev, [e.document_id]: d.url }));
              }
            } catch { /* leave undefined */ }
          });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, clientId]);

  const handleFieldChange = useCallback((id: string, field: keyof ReviewField, value: string) => {
    setItems(prev => prev.map(item => {
      if (item.expense.id !== id) return item;
      const newDraft = { ...item.draft, [field]: value };
      // Check if any field differs from original
      const orig = item.expense;
      const dirty =
        newDraft.vendor_name !== (orig.vendor_name ?? '') ||
        newDraft.expense_date !== (orig.expense_date ?? '') ||
        newDraft.total_amount !== (orig.total_amount != null ? String(orig.total_amount) : '') ||
        newDraft.tax_amount !== (orig.tax_amount != null ? String(orig.tax_amount) : '');
      return { ...item, draft: newDraft, dirty };
    }));
  }, []);

  const handleDecision = useCallback(async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    const item = items.find(i => i.expense.id === id);
    if (!item) return;

    setItems(prev => prev.map(i => i.expense.id === id ? { ...i, deciding: decision, error: null } : i));

    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: item.expense.org_id,
          expense_id: id,
          decision,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }

      setItems(prev => prev.map(i => i.expense.id === id ? { ...i, deciding: decision, done: true } : i));
      showToast(
        decision === 'APPROVED' ? `Approved: ${item.expense.vendor_name || 'expense'}` : `Rejected: ${item.expense.vendor_name || 'expense'}`,
        decision === 'APPROVED' ? 'success' : 'error'
      );
    } catch (e) {
      setItems(prev => prev.map(i => i.expense.id === id ? {
        ...i,
        deciding: null,
        error: e instanceof Error ? e.message : 'Action failed',
      } : i));
    }
  }, [items]);

  const handleSaveAndApprove = useCallback(async (id: string) => {
    const item = items.find(i => i.expense.id === id);
    if (!item) return;

    setItems(prev => prev.map(i => i.expense.id === id ? { ...i, saving: true, error: null } : i));

    try {
      // 1. Save field corrections
      const patchRes = await fetch(`/api/expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_name: item.draft.vendor_name,
          expense_date: item.draft.expense_date || undefined,
          total_amount: item.draft.total_amount ? parseFloat(item.draft.total_amount) : undefined,
          tax_amount: item.draft.tax_amount ? parseFloat(item.draft.tax_amount) : undefined,
        }),
      });

      if (!patchRes.ok) {
        const d = await patchRes.json();
        throw new Error(d.error || 'Save failed');
      }

      // 2. Approve
      const approveRes = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: item.expense.org_id,
          expense_id: id,
          decision: 'APPROVED',
        }),
      });

      if (!approveRes.ok) {
        const d = await approveRes.json();
        throw new Error(d.error || 'Approve failed');
      }

      setItems(prev => prev.map(i => i.expense.id === id ? { ...i, saving: false, deciding: 'APPROVED', done: true } : i));
      showToast(`Saved & approved: ${item.draft.vendor_name || 'expense'}`, 'success');
    } catch (e) {
      setItems(prev => prev.map(i => i.expense.id === id ? {
        ...i,
        saving: false,
        error: e instanceof Error ? e.message : 'Something went wrong',
      } : i));
    }
  }, [items]);

  // Approve all remaining undone with a single click
  async function handleApproveAll() {
    const pending = visibleItems.filter(i => !i.done);
    if (pending.length === 0) return;

    let ok = 0;
    let fail = 0;
    for (const item of pending) {
      try {
        const res = await fetch('/api/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: item.expense.org_id, expense_id: item.expense.id, decision: 'APPROVED' }),
        });
        if (!res.ok) throw new Error();
        setItems(prev => prev.map(i => i.expense.id === item.expense.id ? { ...i, deciding: 'APPROVED', done: true } : i));
        ok++;
      } catch {
        fail++;
      }
    }
    showToast(
      fail === 0 ? `Approved ${ok} expense${ok !== 1 ? 's' : ''}` : `${ok} approved, ${fail} failed`,
      fail === 0 ? 'success' : 'error'
    );
  }

  // Filtered view
  const visibleItems = items.filter(item => {
    if (filter === 'all') return true;
    const s = item.expense.confidence_score ?? 0;
    if (filter === 'low') return s < 0.65;
    if (filter === 'medium') return s >= 0.65 && s < 0.85;
    if (filter === 'high') return s >= 0.85;
    return true;
  });

  const doneCount = items.filter(i => i.done).length;

  // Collect unique vendor names from all loaded expenses for suggestions
  const vendorSuggestions = Array.from(
    new Set(items.map(i => i.expense.vendor_name).filter(Boolean) as string[])
  ).sort();
  const totalCount = items.length;
  const lowCount = items.filter(i => (i.expense.confidence_score ?? 0) < 0.65).length;
  const medCount = items.filter(i => { const s = i.expense.confidence_score ?? 0; return s >= 0.65 && s < 0.85; }).length;
  const highCount = items.filter(i => (i.expense.confidence_score ?? 0) >= 0.85).length;
  const backUrl = `/clients/${clientId}/projects/${projectId}/expenses`;

  // ─── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 max-w-4xl">
        <div className="mb-6 space-y-2">
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-56 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3.5 w-28 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map(j => (
                  <div key={j} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="p-6 max-w-4xl">
        <button onClick={() => router.push(backUrl)} className="text-blue-600 hover:text-blue-800 text-sm mb-5 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to expenses
        </button>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Review queue is clear!</h2>
          <p className="text-sm text-gray-500 mb-6">No pending expenses need review for this project.</p>
          <button onClick={() => router.push(backUrl)} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
            Back to Expenses
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} visible={toastVisible} />}

      <div className="p-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => router.push(backUrl)} className="text-blue-600 hover:text-blue-800 text-sm mb-3 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to expenses
          </button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
              {projectName && <p className="text-sm text-gray-500 mt-0.5">{projectName}</p>}
            </div>
            <div className="flex items-center gap-2">
              {doneCount > 0 && (
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  {doneCount}/{totalCount} reviewed
                </span>
              )}
              {visibleItems.filter(i => !i.done).length > 1 && (
                <button
                  onClick={handleApproveAll}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve All ({visibleItems.filter(i => !i.done).length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar (if any done) */}
        {doneCount > 0 && (
          <div className="mb-5 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Queue progress</span>
              <span className="text-sm font-bold text-green-600">{Math.round((doneCount / totalCount) * 100)}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${(doneCount / totalCount) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">{doneCount} of {totalCount} expenses reviewed</p>
          </div>
        )}

        {/* Confidence filter pills */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-xs font-semibold text-gray-500">Filter:</span>
          {([
            { key: 'all', label: `All (${totalCount})`, active: 'bg-gray-800 text-white', inactive: 'bg-white text-gray-600 border-gray-300' },
            { key: 'low', label: `🔴 Low (${lowCount})`, active: 'bg-red-600 text-white', inactive: 'bg-white text-red-600 border-red-200' },
            { key: 'medium', label: `🟡 Med (${medCount})`, active: 'bg-yellow-500 text-white', inactive: 'bg-white text-yellow-600 border-yellow-200' },
            { key: 'high', label: `🟢 High (${highCount})`, active: 'bg-green-600 text-white', inactive: 'bg-white text-green-600 border-green-200' },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filter === f.key ? f.active + ' border-transparent' : f.inactive
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Hint banner */}
        <div className="mb-5 flex items-start gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Fields are <strong>color-coded by AI confidence</strong> — red fields have low confidence and need your attention.
            Edit any field to correct OCR errors, then click <strong>Save &amp; Approve</strong>.
          </span>
        </div>

        {/* Cards */}
        <div className="space-y-4">
          {visibleItems.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">No expenses match this filter.</p>
          ) : (
            visibleItems.map((item, index) => (
              <ReviewCard
                key={item.expense.id}
                item={item}
                index={index}
                onFieldChange={handleFieldChange}
                onDecision={handleDecision}
                onSaveAndApprove={handleSaveAndApprove}
                vendorSuggestions={vendorSuggestions}
                signedSrc={item.expense.document_id ? signedUrls[item.expense.document_id] : undefined}
              />
            ))
          )}
        </div>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </>
  );
}
