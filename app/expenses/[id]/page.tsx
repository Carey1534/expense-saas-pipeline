'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Expense } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import ImageViewer from '@/components/ImageViewer';

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, visible }: { message: string; type: 'success' | 'error'; visible: boolean }) {
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border transition-all duration-300 ${
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

// ─── Inline editable field ────────────────────────────────────────────────────

interface EditableFieldProps {
  label: string;
  display: React.ReactNode;
  rawValue: string;
  inputType?: 'text' | 'number' | 'date';
  prefix?: string;
  inputClass?: string;
  saving?: boolean;
  onSave: (raw: string) => Promise<void>;
}

function EditableField({
  label, display, rawValue, inputType = 'text', prefix, inputClass = '', saving = false, onSave,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(rawValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setValue(rawValue); }, [rawValue, editing]);

  async function commit() {
    const trimmed = value.trim();
    setEditing(false);
    if (trimmed === rawValue) return;
    if (trimmed === '' && inputType !== 'text') { setValue(rawValue); return; }
    await onSave(trimmed);
  }

  function startEdit() {
    setValue(rawValue);
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      {editing ? (
        <div className="flex items-center gap-1.5">
          {prefix && <span className="text-base font-semibold text-gray-500">{prefix}</span>}
          <input
            ref={inputRef}
            type={inputType}
            value={value}
            step={inputType === 'number' ? '0.01' : undefined}
            onChange={e => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur(); }
              if (e.key === 'Escape') { setValue(rawValue); setEditing(false); }
            }}
            className={`border border-blue-400 rounded-lg px-2 py-1 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 ${inputClass}`}
            autoFocus
          />
          {saving && <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-500 flex-shrink-0" />}
        </div>
      ) : (
        <div onClick={startEdit} className="flex items-center gap-1.5 group cursor-pointer w-fit" title={`Click to edit ${label.toLowerCase()}`}>
          <span>{display}</span>
          <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [flashDecision, setFlashDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }

  useEffect(() => {
    async function fetchExpense() {
      try {
        const res = await fetch(`/api/expenses/${params.id}`);
        if (!res.ok) throw new Error('Failed to fetch expense');
        const data = await res.json();
        setExpense(data);
        if (data.document_id && data.document?.file_path && !data.document.file_path.includes('{{')) {
          const imgRes = await fetch(`/api/documents/${data.document_id}/image`);
          if (imgRes.ok) {
            const imgData = await imgRes.json();
            setReceiptUrl(imgData.url);
          }
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchExpense();
  }, [params.id]);

  async function patchField(field: string, raw: string) {
    if (!expense) return;
    setSavingField(field);

    let value: string | number = raw;
    if (field === 'total_amount' || field === 'tax_amount') {
      const n = parseFloat(raw);
      if (isNaN(n)) { setSavingField(null); return; }
      value = n;
    }

    const snapshot = { ...expense };
    setExpense(e => e ? { ...e, [field]: value } : e);

    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error('Save failed');
      showToast('Saved', 'success');
    } catch {
      setExpense(snapshot as Expense);
      showToast('Failed to save', 'error');
    } finally {
      setSavingField(null);
    }
  }

  async function handleDecision(decision: 'APPROVED' | 'REJECTED') {
    if (!expense) return;
    setDeciding(decision);
    const previousStatus = expense.status;
    setExpense(prev => prev ? { ...prev, status: decision } : prev);
    setFlashDecision(decision);
    setTimeout(() => setFlashDecision(null), 1200);
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: expense.org_id,
          expense_id: expense.id,
          decision: decision === 'APPROVED' ? 'approve' : 'reject',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(decision === 'APPROVED' ? 'Expense approved!' : 'Expense rejected', decision === 'APPROVED' ? 'success' : 'error');
        setTimeout(() => router.push('/expenses'), 1400);
      } else {
        setExpense(prev => prev ? { ...prev, status: previousStatus } : prev);
        showToast(data.error || 'Something went wrong', 'error');
        setDeciding(null);
      }
    } catch {
      setExpense(prev => prev ? { ...prev, status: previousStatus } : prev);
      showToast('Unknown error', 'error');
      setDeciding(null);
    }
  }

  // ── Skeleton ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 max-w-5xl">
        <div className="mb-6 space-y-2">
          <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
          <div className="h-7 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="space-y-5">
              {[0,1,2,3].map(i => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-12 bg-gray-100 rounded animate-pulse" />
                  <div className="h-7 w-40 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
              <div className="mt-8 space-y-3">
                <div className="h-11 w-full bg-gray-200 rounded-lg animate-pulse" />
                <div className="h-11 w-full bg-gray-100 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Expense not found</h2>
          <button onClick={() => router.push('/expenses')} className="mt-4 text-blue-600 hover:text-blue-800">
            ← Back to expenses
          </button>
        </div>
      </div>
    );
  }

  const canDecide = expense.status === 'DRAFT' || expense.status === 'PENDING_APPROVAL' || expense.status === 'EXTRACTED';

  const fmtAmount = (n: number | null | undefined) => n != null ? `$${n.toFixed(2)}` : '—';
  const fmtDate = (d: string | null | undefined) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${m}/${day}/${y}`;
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} visible={toastVisible} />}

      <div className="p-6 max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => router.push('/expenses')}
            className="text-blue-600 hover:text-blue-800 text-sm mb-3 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to expenses
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Expense Review</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Receipt */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Receipt</h2>
            {receiptUrl ? (
              <ImageViewer
                src={receiptUrl}
                alt={`Receipt from ${expense.vendor_name || 'vendor'}`}
                fileName={expense.document?.file_path.split('/').pop() || 'receipt'}
                isPdf={expense.document?.file_path.toLowerCase().endsWith('.pdf')}
              />
            ) : expense.document?.file_path && !expense.document.file_path.includes('{{') ? (
              <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
              </div>
            ) : (
              <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center">
                <p className="text-gray-400 text-sm">No receipt available</p>
              </div>
            )}
          </div>

          {/* Details + Actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Details</h2>
            <p className="text-[11px] text-gray-400 mb-4">Click any value to edit</p>

            <div className="space-y-4">
              {/* Vendor */}
              <EditableField
                label="Vendor"
                display={<span className="text-lg font-semibold text-gray-900">{expense.vendor_name || 'Unknown'}</span>}
                rawValue={expense.vendor_name || ''}
                inputType="text"
                inputClass="text-base w-52"
                saving={savingField === 'vendor_name'}
                onSave={v => patchField('vendor_name', v)}
              />

              {/* Amounts */}
              <div className="grid grid-cols-2 gap-4">
                <EditableField
                  label="Total Amount"
                  display={<span className="text-2xl font-bold text-gray-900">{fmtAmount(expense.total_amount)}</span>}
                  rawValue={expense.total_amount != null ? String(expense.total_amount) : ''}
                  inputType="number"
                  prefix="$"
                  inputClass="text-xl font-bold w-28"
                  saving={savingField === 'total_amount'}
                  onSave={v => patchField('total_amount', v)}
                />
                <EditableField
                  label="Tax Amount"
                  display={<span className="text-lg font-semibold text-gray-700">{fmtAmount(expense.tax_amount)}</span>}
                  rawValue={expense.tax_amount != null ? String(expense.tax_amount) : '0'}
                  inputType="number"
                  prefix="$"
                  inputClass="text-base w-24"
                  saving={savingField === 'tax_amount'}
                  onSave={v => patchField('tax_amount', v)}
                />
              </div>

              {/* Date */}
              <EditableField
                label="Date"
                display={<span className="text-base text-gray-900">{fmtDate(expense.expense_date)}</span>}
                rawValue={expense.expense_date || ''}
                inputType="date"
                inputClass="text-sm w-36"
                saving={savingField === 'expense_date'}
                onSave={v => patchField('expense_date', v)}
              />

              {/* Status + Confidence (read-only) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Status</p>
                  <StatusBadge status={expense.status} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Confidence</p>
                  <p className={`text-lg font-bold ${
                    expense.confidence_score >= 0.8 ? 'text-green-600' :
                    expense.confidence_score >= 0.6 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {expense.confidence_score != null ? `${Math.round(expense.confidence_score * 100)}%` : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Decision buttons */}
            {canDecide && (
              <div className="mt-8 space-y-3">
                <button onClick={() => handleDecision('APPROVED')} disabled={deciding !== null}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-all font-semibold flex items-center justify-center gap-2 active:scale-[0.98]">
                  {deciding === 'APPROVED'
                    ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                  Approve Expense
                </button>
                <button onClick={() => handleDecision('REJECTED')} disabled={deciding !== null}
                  className="w-full bg-white border border-red-300 text-red-600 py-3 px-4 rounded-lg hover:bg-red-50 disabled:opacity-60 transition-all font-semibold flex items-center justify-center gap-2 active:scale-[0.98]">
                  {deciding === 'REJECTED'
                    ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500" />
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>}
                  Reject Expense
                </button>
              </div>
            )}

            {/* Status panels */}
            {!canDecide && expense.status === 'APPROVED' && (
              <div className={`mt-8 p-4 rounded-lg flex items-center gap-3 transition-all duration-500 ${
                flashDecision === 'APPROVED' ? 'bg-green-100 border border-green-300 scale-[1.02]' : 'bg-green-50 border border-green-200'
              }`}>
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-green-800 font-medium">Approved</p>
              </div>
            )}
            {!canDecide && expense.status === 'REJECTED' && (
              <div className={`mt-8 p-4 rounded-lg flex items-center gap-3 transition-all duration-500 ${
                flashDecision === 'REJECTED' ? 'bg-red-100 border border-red-300 scale-[1.02]' : 'bg-red-50 border border-red-200'
              }`}>
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-800 font-medium">Rejected</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
