'use client';

import { useCallback, useEffect, useState } from 'react';
import ExpenseTable from '@/components/ExpenseTable';
import DropZone from '@/components/DropZone';
import ExportButton from '@/components/ExportButton';
import { Expense } from '@/lib/types';
import { useUploadPoller } from '@/hooks/useUploadPoller';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  function fetchSignedUrls(data: Expense[]) {
    data
      .filter(e => e.document_id && e.document?.file_path && !e.document.file_path.includes('{{') && !e.document.file_path.toLowerCase().endsWith('.pdf'))
      .forEach(async (e) => {
        if (signedUrls[e.document_id]) return; // already have it
        try {
          const r = await fetch(`/api/documents/${e.document_id}/image`);
          if (r.ok) {
            const d = await r.json();
            setSignedUrls(prev => ({ ...prev, [e.document_id]: d.url }));
          }
        } catch { /* ignore */ }
      });
  }

  const handleNewData = useCallback((data: Expense[]) => {
    setExpenses(data);
    fetchSignedUrls(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { startPolling, polling } = useUploadPoller<Expense>(
    '/api/expenses',
    expenses.length,
    handleNewData,
  );

  useEffect(() => {
    async function fetchExpenses() {
      try {
        const res = await fetch('/api/expenses');
        if (!res.ok) throw new Error('Failed to fetch expenses');
        const data: Expense[] = await res.json();
        setExpenses(data);
        fetchSignedUrls(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    fetchExpenses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading expenses...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold mb-2">Error Loading Expenses</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const approvedCount = expenses.filter(e => e.status === 'APPROVED').length;

  return (
    <div className="min-h-screen bg-[#f4f5f7] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Expense Inbox</h1>
            {polling && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Waiting for OCR…
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {expenses.length} total expenses • {approvedCount} approved
          </p>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Upload New Receipt</h2>
            <DropZone mode="inline" onAllDone={startPolling} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Export Approved Expenses</h2>
            <ExportButton />
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {expenses.length > 0 ? (
            <ExpenseTable expenses={expenses} signedUrls={signedUrls} />
          ) : (
            <div className="p-8 text-center text-gray-500">
              No expenses found. Upload a receipt to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
