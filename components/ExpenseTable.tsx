'use client';

import { Expense } from '@/lib/types';
import StatusBadge from './StatusBadge';
import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';

interface ExpenseTableProps {
  expenses: Expense[];
  signedUrls?: Record<string, string>;
}

function isValidFilePath(path: string): boolean {
  return Boolean(path) && !path.includes('{{') && !path.includes('}}');
}

function isPdf(path: string): boolean {
  return path.toLowerCase().endsWith('.pdf');
}

function ReceiptThumbnail({ filePath, vendorName, signedUrl }: { filePath?: string; vendorName?: string; signedUrl?: string }) {
  const validPath = filePath && isValidFilePath(filePath);

  if (validPath && !isPdf(filePath) && signedUrl) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={signedUrl}
          alt={`Receipt from ${vendorName || 'vendor'}`}
          className="w-12 h-12 object-cover rounded border border-gray-200"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove('hidden');
          }}
        />
        <div className="hidden w-12 h-12 rounded border border-gray-200 bg-gray-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      </>
    );
  }

  if (validPath && isPdf(filePath)) {
    return (
      <div className="w-12 h-12 rounded border border-red-200 bg-red-50 flex items-center justify-center">
        <span className="text-[10px] font-bold text-red-500 uppercase">PDF</span>
      </div>
    );
  }

  return (
    <div className="w-12 h-12 rounded border border-gray-200 bg-gray-100 flex items-center justify-center">
      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
  );
}

function VendorCell({ expense }: { expense: Expense }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(expense.vendor_name || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function save() {
    const trimmed = value.trim();
    if (trimmed === (expense.vendor_name || '')) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await fetch(`/api/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_name: trimmed }),
      });
      expense.vendor_name = trimmed;
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') { setValue(expense.vendor_name || ''); setEditing(false); }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={onKeyDown}
          disabled={saving}
          className="border border-blue-400 rounded px-2 py-0.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-300"
          autoFocus
        />
        {saving && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500" />}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 group cursor-pointer"
      onClick={startEdit}
      title="Click to edit vendor"
    >
      <span>{value || 'Unknown'}</span>
      <svg className="w-3 h-3 text-gray-300 group-hover:text-blue-400 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
      </svg>
    </div>
  );
}

export default function ExpenseTable({ expenses, signedUrls = {} }: ExpenseTableProps) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Receipt
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Vendor
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Total
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Confidence
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {expenses.map((expense) => (
            <tr
              key={expense.id}
              onClick={() => router.push(`/expenses/${expense.id}`)}
              className="hover:bg-blue-50 cursor-pointer transition-colors"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <ReceiptThumbnail filePath={expense.document?.file_path} vendorName={expense.vendor_name} signedUrl={expense.document_id ? signedUrls[expense.document_id] : undefined} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <VendorCell expense={expense} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(expense.expense_date).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap font-medium">
                ${expense.total_amount.toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={expense.status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`font-semibold ${
                  expense.confidence_score >= 0.8 ? 'text-green-600' :
                  expense.confidence_score >= 0.6 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {Math.round(expense.confidence_score * 100)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}