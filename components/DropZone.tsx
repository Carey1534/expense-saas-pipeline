'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type UploadStatus = 'queued' | 'uploading' | 'processing' | 'done' | 'error';

interface UploadFile {
  id: string;
  file: File;
  preview: string | null;   // data URL for images
  isPdf: boolean;
  status: UploadStatus;
  progress: number;          // 0-100
  error?: string;
  // Populated after OCR returns
  extractedVendor?: string;
  extractedAmount?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2);
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Success Toast ────────────────────────────────────────────────────────────

interface ToastItem {
  id: string;
  vendor?: string;
  amount?: number;
  filename: string;
  visible: boolean;
}

function SuccessToast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  return (
    <div className={`flex items-start gap-3 bg-white rounded-2xl shadow-xl border border-green-100 px-4 py-3 w-80 transition-all duration-300 ${
      toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
    }`}>
      <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-900 leading-tight">
          Receipt extracted
          {toast.amount != null && (
            <span className="text-green-600 ml-1">
              — ${toast.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          )}
        </p>
        {toast.vendor ? (
          <p className="text-[11px] text-gray-500 mt-0.5 truncate">from {toast.vendor}</p>
        ) : (
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{toast.filename}</p>
        )}
      </div>
      <button onClick={() => onDismiss(toast.id)} className="text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Toast Manager ────────────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 items-end">
      {toasts.map(t => (
        <SuccessToast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ progress, status }: { progress: number; status: UploadStatus }) {
  const color =
    status === 'done'       ? 'bg-green-500' :
    status === 'error'      ? 'bg-red-400' :
    status === 'processing' ? 'bg-blue-400' :
                              'bg-blue-500';

  return (
    <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden mt-1.5">
      <div
        className={`h-full rounded-full transition-all duration-300 ${color} ${status === 'processing' ? 'animate-pulse' : ''}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ─── File row ─────────────────────────────────────────────────────────────────

function FileRow({ item, onRemove }: { item: UploadFile; onRemove: (id: string) => void }) {
  const statusLabel: Record<UploadStatus, string> = {
    queued:     'Queued',
    uploading:  `Uploading… ${item.progress}%`,
    processing: 'Extracting data…',
    done:       item.extractedVendor
      ? `✓ ${item.extractedVendor}${item.extractedAmount != null ? ` · $${item.extractedAmount.toFixed(2)}` : ''}`
      : 'Done',
    error:      item.error || 'Failed',
  };

  const statusColor: Record<UploadStatus, string> = {
    queued:     'text-gray-400',
    uploading:  'text-blue-600',
    processing: 'text-blue-500',
    done:       'text-green-600',
    error:      'text-red-500',
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-300 ${
      item.status === 'done'  ? 'bg-green-50/60 border-green-100' :
      item.status === 'error' ? 'bg-red-50/60 border-red-100' :
      'bg-gray-50 border-gray-100'
    }`}>
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 bg-gray-100 flex items-center justify-center relative">
        {item.isPdf ? (
          <div className="flex flex-col items-center gap-0.5">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-[8px] font-bold text-red-400 uppercase">PDF</span>
          </div>
        ) : item.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.preview} alt={item.file.name} className="w-full h-full object-cover" />
        ) : (
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
        {/* Processing overlay shimmer */}
        {item.status === 'processing' && (
          <div className="absolute inset-0 bg-blue-500/10 animate-pulse rounded-lg" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{item.file.name}</p>
          {(item.status === 'done' || item.status === 'error') && (
            <button onClick={() => onRemove(item.id)} className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5">{formatBytes(item.file.size)}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {(item.status === 'uploading' || item.status === 'processing') && (
            <span className="flex-shrink-0 w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          )}
          {item.status === 'done' && (
            <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {item.status === 'error' && (
            <svg className="w-3 h-3 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className={`text-[10px] font-medium ${statusColor[item.status]} truncate`}>
            {statusLabel[item.status]}
          </span>
        </div>
        <ProgressBar progress={item.progress} status={item.status} />
      </div>
    </div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

interface DropZoneProps {
  /** 'inline' = large zone embedded in page. 'button' = compact button that opens modal. 'fab' = round floating action button. */
  mode?: 'inline' | 'button' | 'fab';
  onAllDone?: () => void;
  /** When provided, the upload is tagged to a specific project and client so n8n can associate the receipt correctly. */
  projectId?: string;
  clientId?: string;
  /** Override the upload endpoint. Defaults to '/api/upload'. */
  uploadEndpoint?: string;
}

export default function DropZone({ mode = 'button', onAllDone, projectId, clientId, uploadEndpoint }: DropZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);

  // Track window-level drag for the modal
  useEffect(() => {
    if (mode !== 'button') return;
    function onDragEnter(e: DragEvent) {
      if (e.dataTransfer?.types.includes('Files')) {
        setModalOpen(true);
      }
    }
    window.addEventListener('dragenter', onDragEnter);
    return () => window.removeEventListener('dragenter', onDragEnter);
  }, [mode]);

  const processFiles = useCallback((incoming: File[]) => {
    const valid = incoming.filter(f =>
      f.type.startsWith('image/') || f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (valid.length === 0) return;

    const newItems: UploadFile[] = valid.map(file => ({
      id: uid(),
      file,
      preview: null,
      isPdf: isPdfFile(file),
      status: 'queued',
      progress: 0,
    }));

    // Generate image previews
    newItems.forEach(item => {
      if (!item.isPdf && item.file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFiles(prev => prev.map(f => f.id === item.id ? { ...f, preview: e.target?.result as string } : f));
        };
        reader.readAsDataURL(item.file);
      }
    });

    setFiles(prev => [...prev, ...newItems]);
  }, []);

  // Auto-upload when files are added
  useEffect(() => {
    const queued = files.filter(f => f.status === 'queued');
    if (queued.length === 0 || uploadingRef.current) return;

    async function runQueue() {
      uploadingRef.current = true;
      const toUpload = files.filter(f => f.status === 'queued');
      for (const item of toUpload) {
        await uploadFile(item);
      }
      uploadingRef.current = false;
    }
    runQueue();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.filter(f => f.status === 'queued').length]);

  function showSuccessToast(item: UploadFile) {
    const toastId = uid();
    const toast: ToastItem = {
      id: toastId,
      vendor: item.extractedVendor,
      amount: item.extractedAmount,
      filename: item.file.name,
      visible: false,
    };
    setToasts(prev => [...prev, toast]);
    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setToasts(prev => prev.map(t => t.id === toastId ? { ...t, visible: true } : t));
      });
    });
    // Auto-dismiss after 4s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === toastId ? { ...t, visible: false } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 400);
    }, 4000);
  }

  function dismissToast(id: string) {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 400);
  }

  async function uploadFile(item: UploadFile) {
    setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading', progress: 0 } : f));

    console.log('[DropZone] projectId:', projectId);
    console.log('[DropZone] clientId:', clientId);


    try {
      const formData = new FormData();
      formData.append('file', item.file);
      // Include project context when available so the API can tag the receipt
      if (projectId) formData.append('project_id', projectId);
      if (clientId)  formData.append('client_id', clientId);

      // Simulate progress
      let fakeProgress = 0;
      const tick = setInterval(() => {
        fakeProgress = Math.min(fakeProgress + Math.random() * 18 + 5, 85);
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, progress: Math.round(fakeProgress) } : f));
      }, 200);

      const res = await fetch(uploadEndpoint || '/api/upload', { method: 'POST', body: formData });
      clearInterval(tick);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }

      // Parse response for extracted data
      let extractedVendor: string | undefined;
      let extractedAmount: number | undefined;
      try {
        const data = await res.json();
        if (data?.vendor_name) extractedVendor = data.vendor_name;
        if (data?.total_amount != null) extractedAmount = data.total_amount;
      } catch { /* response may not have extracted data yet */ }

      // Processing phase
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing', progress: 88 } : f));

      let p = 88;
      const processTick = setInterval(() => {
        p = Math.min(p + Math.random() * 4 + 1, 99);
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, progress: Math.round(p) } : f));
      }, 300);

      await new Promise(r => setTimeout(r, 2800));
      clearInterval(processTick);

      const doneItem: Partial<UploadFile> = { status: 'done', progress: 100, extractedVendor, extractedAmount };
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, ...doneItem } : f));

      // Show success toast
      showSuccessToast({ ...item, ...doneItem });

    } catch (err) {
      setFiles(prev => prev.map(f => f.id === item.id ? {
        ...f, status: 'error', progress: 0,
        error: err instanceof Error ? err.message : 'Upload failed',
      } : f));
    }
  }

  // When all done, call onAllDone
  useEffect(() => {
    if (files.length === 0) return;
    const allDone = files.every(f => f.status === 'done' || f.status === 'error');
    const anyDone = files.some(f => f.status === 'done');
    if (allDone && anyDone) {
      setTimeout(() => onAllDone?.(), 1800);
    }
  }, [files, onAllDone]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    processFiles(Array.from(e.target.files || []));
    e.target.value = '';
  }

  function removeFile(id: string) {
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  const hasActive = files.some(f => f.status === 'uploading' || f.status === 'processing' || f.status === 'queued');
  const doneCount = files.filter(f => f.status === 'done').length;
  const totalCount = files.length;

  // ── Shared drop area ──────────────────────────────────────────────────────
  const DropArea = (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center text-center select-none ${
        isDragging
          ? 'border-blue-400 bg-blue-50 scale-[1.02]'
          : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/40'
      }`}
      style={{ minHeight: mode === 'inline' ? 180 : 160 }}
    >
      {/* Hidden file inputs */}
      <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleFileInput} />
      {/* Camera input (mobile) — capture="environment" triggers rear camera */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileInput} />

      {isDragging ? (
        <div className="pointer-events-none">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-3 animate-bounce mx-auto">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-base font-bold text-blue-600">Drop receipts here</p>
          <p className="text-xs text-blue-400 mt-1">Release to start uploading</p>
        </div>
      ) : (
        <div className="px-4 py-2">
          <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mb-3 mx-auto">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700">Drag & drop receipts here</p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF supported</p>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Browse files
            </button>
            {/* Camera button — only shown on mobile-capable devices */}
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors sm:hidden"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Take photo
            </button>
          </div>

          {totalCount > 0 && (
            <p className="text-xs text-gray-400 mt-2">{doneCount}/{totalCount} uploaded</p>
          )}
        </div>
      )}
    </div>
  );

  // ── File list ─────────────────────────────────────────────────────────────
  const FileList = files.length > 0 && (
    <div className="mt-3 space-y-2">
      {totalCount > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-500 font-medium">{totalCount} file{totalCount !== 1 ? 's' : ''}</span>
          {!hasActive && (
            <button onClick={() => setFiles([])} className="text-xs text-gray-400 hover:text-gray-600">Clear all</button>
          )}
        </div>
      )}
      {files.map(f => (
        <FileRow key={f.id} item={f} onRemove={removeFile} />
      ))}
    </div>
  );

  // ── Button mode: compact trigger + modal ──────────────────────────────────
  if (mode === 'button' || mode === 'fab') {
    return (
      <>
        <ToastStack toasts={toasts} onDismiss={dismissToast} />

        {/* FAB mode: round floating action button */}
        {mode === 'fab' ? (
          <button
            onClick={() => setModalOpen(true)}
            className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center relative"
            aria-label="Upload receipts"
          >
            {hasActive ? (
              <>
                <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-30" />
                <svg className="w-6 h-6 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white">
                  {files.filter(f => f.status !== 'done' && f.status !== 'error').length}
                </span>
              </>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>
        ) : (
          /* Compact upload button */
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-lg text-base font-semibold hover:bg-blue-700 transition-colors shadow active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">Upload</span>
            <span className="sm:hidden">Add</span>
            {hasActive && (
              <span className="flex items-center gap-1 bg-blue-500 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {files.filter(f => f.status !== 'done' && f.status !== 'error').length}
              </span>
            )}
          </button>
        )}

        {/* Modal */}
        {modalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={e => { if (e.target === e.currentTarget && !hasActive) setModalOpen(false); }}
          >
            {/* Sheet on mobile, centered modal on desktop */}
            <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-5 pb-8 sm:pb-5 animate-[fadeIn_0.2s_ease-out]">
              {/* Drag handle (mobile) */}
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden" />

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Upload Receipts</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Images and PDFs supported</p>
                </div>
                <button
                  onClick={() => { if (!hasActive) setModalOpen(false); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                  disabled={hasActive}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {DropArea}
              {FileList}

              {!hasActive && files.length > 0 && (
                <button
                  onClick={() => { setModalOpen(false); setFiles([]); onAllDone?.(); }}
                  className="mt-4 w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
                >
                  {doneCount > 0 ? `Done · ${doneCount} uploaded` : 'Close'}
                </button>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Inline mode ───────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {DropArea}
      {FileList}
    </div>
  );
}
