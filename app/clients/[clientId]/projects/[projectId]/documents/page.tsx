'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ImageViewer from '@/components/ImageViewer';


interface DocRow {
  id: string;
  file_path: string;
  status: string;
  created_at?: string;
  vendor_name?: string;
  expense_date?: string;
}

function isValidPath(p: string) {
  return Boolean(p) && !p.includes('{{') && !p.includes('}}');
}

function isPdf(p: string) {
  return p.toLowerCase().endsWith('.pdf');
}

/** Human-readable display name: vendor + date, or fallback to filename */
function displayName(doc: DocRow): string {
  const parts: string[] = [];
  if (doc.vendor_name) parts.push(doc.vendor_name);
  if (doc.expense_date) {
    const [y, m, d] = doc.expense_date.split('-');
    parts.push(`${m}/${d}/${y}`);
  }
  if (parts.length > 0) return parts.join(' – ');
  // Fallback: last path segment
  return doc.file_path.split('/').pop() || doc.file_path;
}

export default function DocumentsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Lightbox state
  const [selected, setSelected] = useState<DocRow | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}/expenses`);
        if (!res.ok) throw new Error('Failed to fetch');
        const expenses = await res.json();

        // De-duplicate documents by id, carry vendor + date from the expense
        const seen = new Set<string>();
        const collected: DocRow[] = [];
        for (const e of expenses) {
          if (e.document && !seen.has(e.document.id)) {
            seen.add(e.document.id);
            collected.push({
              ...e.document,
              created_at: e.created_at,
              vendor_name: e.vendor_name || '',
              expense_date: e.expense_date || '',
            });
          }
        }
        setDocs(collected);

        // Fetch signed URLs progressively — update state as each one arrives
        collected
          .filter(d => isValidPath(d.file_path) && !isPdf(d.file_path))
          .forEach(async (d) => {
            try {
              const r = await fetch(`/api/documents/${d.id}/image`);
              if (r.ok) {
                const data = await r.json();
                setSignedUrls(prev => ({ ...prev, [d.id]: data.url }));
              }
            } catch { /* leave undefined */ }
          });
      } catch (err) {
        setError('Failed to load documents');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  // Close lightbox on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelected(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-5 space-y-1.5">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="h-36 bg-gray-100 animate-pulse" />
              <div className="px-2.5 py-2 border-t border-gray-100 space-y-1.5">
                <div className="h-3 w-4/5 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-14 bg-gray-100 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-500 mt-0.5">{docs.length} receipt{docs.length !== 1 ? 's' : ''} on file</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4 text-sm">{error}</div>
      )}

      {docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
          <p className="text-gray-500 font-medium">No documents yet</p>
          <p className="text-sm text-gray-400 mt-1">Upload receipts from the Expenses page</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {docs.map((doc) => {
            const valid = isValidPath(doc.file_path);
            const pdf = valid && isPdf(doc.file_path);
            const url = valid ? (pdf ? doc.file_path : (signedUrls[doc.id] ?? null)) : null;
            const name = displayName(doc);

            return (
              <button
                key={doc.id}
                onClick={() => url && setSelected(doc)}
                disabled={!url}
                className={`text-left bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden group hover:shadow-md hover:border-blue-300 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 ${!url ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
              >
                {/* Preview */}
                <div className="h-36 bg-gray-50 flex items-center justify-center overflow-hidden relative">
                  {pdf ? (
                    <div className="flex flex-col items-center gap-1">
                      <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-xs font-bold text-red-500 uppercase">PDF</span>
                    </div>
                  ) : url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-800 shadow">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                          Open
                        </div>
                      </div>
                    </>
                  ) : (
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>

                {/* Meta */}
                <div className="px-2.5 py-2 border-t border-gray-100">
                  <p className="text-[11px] font-medium text-gray-700 truncate" title={name}>{name}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      doc.status === 'processed' ? 'bg-green-100 text-green-700' :
                      doc.status === 'error' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {doc.status || 'unknown'}
                    </span>
                    {url && (
                      <svg className="w-3 h-3 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Lightbox modal */}
      {selected && (() => {
        const pdf = isPdf(selected.file_path);
        const url = pdf ? selected.file_path : (signedUrls[selected.id] ?? '');
        const name = displayName(selected);
        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <div
              className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="min-w-0 mr-3">
                  <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-block mt-0.5 ${
                    selected.status === 'processed' ? 'bg-green-100 text-green-700' :
                    selected.status === 'error' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {selected.status || 'unknown'}
                  </span>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* ImageViewer (has zoom + download built in) */}
              <div className="overflow-auto p-4 flex-1">
                <ImageViewer
                  src={url}
                  alt={name}
                  fileName={`${name}${pdf ? '.pdf' : '.jpg'}`}
                  isPdf={pdf}
                />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
