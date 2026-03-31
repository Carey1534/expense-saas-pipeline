'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Client, Project } from '@/lib/types';
import { useTheme } from '@/components/ThemeProvider';

// ─── Icons ───────────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-3 h-3 flex-shrink-0 transition-transform text-gray-500 ${open ? 'rotate-90' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

// ─── Inline rename input ──────────────────────────────────────────────────────

function InlineRename({ value, onSave, onCancel }: {
  value: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); if (text.trim()) onSave(text.trim()); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  }

  return (
    <input
      ref={ref}
      type="text"
      value={text}
      onChange={e => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => { if (text.trim() && text.trim() !== value) onSave(text.trim()); else onCancel(); }}
      onClick={e => e.stopPropagation()}
      className="flex-1 min-w-0 bg-gray-700 text-white text-xs font-semibold rounded px-1.5 py-0.5 outline-none ring-1 ring-blue-400 truncate"
    />
  );
}

// ─── Add Client Modal ─────────────────────────────────────────────────────────

function AddClientModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (client: Client) => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); return; }
      onCreated(data);
    } catch { setError('Something went wrong.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Add Job</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. City of Phoenix" autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1">
              {saving && <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />}
              {saving ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Project Modal ────────────────────────────────────────────────────────

function AddProjectModal({ client, onClose, onCreated }: {
  client: Client;
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/clients/${client.id}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); return; }
      onCreated(data);
    } catch { setError('Something went wrong.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">Add Job</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">Under: {client.name}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. 22037 – Bartlesville OK" autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1">
              {saving && <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />}
              {saving ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Project sub-links ────────────────────────────────────────────────────────

const PROJECT_SECTIONS = [
  {
    key: 'expenses',
    label: 'Expenses',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
  {
    key: 'documents',
    label: 'Documents',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
      </svg>
    ),
  },
  {
    key: 'summary',
    label: 'Summary',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    key: 'review',
    label: 'Review Queue',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Record<string, Project[]>>({});
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [showAddClient, setShowAddClient] = useState(false);
  const [addProjectFor, setAddProjectFor] = useState<Client | null>(null);

  // Rename state
  const [renamingClientId, setRenamingClientId] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);

  // Parse current URL to auto-expand the right client & project
  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch('/api/clients');
        if (!res.ok) return;
        const data: Client[] = await res.json();
        setClients(data);

        const clientMatch = pathname.match(/\/clients\/([^/]+)/);
        const projectMatch = pathname.match(/\/projects\/([^/]+)/);

        if (clientMatch) {
          setExpandedClients(new Set([clientMatch[1]]));
        } else if (data.length > 0) {
          setExpandedClients(new Set([data[0].id]));
        }

        if (projectMatch) {
          setExpandedProjects(new Set([projectMatch[1]]));
        }
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazy-load projects when a client expands
  useEffect(() => {
    expandedClients.forEach(async (clientId) => {
      if (!projects[clientId]) {
        try {
          const res = await fetch(`/api/clients/${clientId}/projects`);
          if (!res.ok) return;
          const data: Project[] = await res.json();
          setProjects(prev => ({ ...prev, [clientId]: data }));

          // Auto-expand the active project after loading
          const projectMatch = pathname.match(/\/projects\/([^/]+)/);
          if (projectMatch) {
            setExpandedProjects(prev => new Set([...prev, projectMatch[1]]));
          }
        } catch {}
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedClients]);

  function toggleClient(clientId: string) {
    setExpandedClients(prev => {
      const next = new Set(prev);
      next.has(clientId) ? next.delete(clientId) : next.add(clientId);
      return next;
    });
  }

  function toggleProject(projectId: string) {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      next.has(projectId) ? next.delete(projectId) : next.add(projectId);
      return next;
    });
  }

  function projectBase(clientId: string, projectId: string) {
    return `/clients/${clientId}/projects/${projectId}`;
  }

  function isSectionActive(clientId: string, projectId: string, section: string) {
    return pathname.startsWith(`${projectBase(clientId, projectId)}/${section}`);
  }

  async function handleRenameClient(clientId: string, newName: string) {
    setRenamingClientId(null);
    const prev = clients.find(c => c.id === clientId)?.name;
    // Optimistic update
    setClients(cs => cs.map(c => c.id === clientId ? { ...c, name: newName } : c));
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      // Rollback
      if (prev) setClients(cs => cs.map(c => c.id === clientId ? { ...c, name: prev } : c));
    }
  }

  async function handleRenameProject(projectId: string, clientId: string, newName: string) {
    setRenamingProjectId(null);
    const prev = projects[clientId]?.find(p => p.id === projectId)?.name;
    // Optimistic update
    setProjects(ps => ({
      ...ps,
      [clientId]: (ps[clientId] || []).map(p => p.id === projectId ? { ...p, name: newName } : p),
    }));
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      // Rollback
      if (prev) {
        setProjects(ps => ({
          ...ps,
          [clientId]: (ps[clientId] || []).map(p => p.id === projectId ? { ...p, name: prev } : p),
        }));
      }
    }
  }

  return (
    <>
      <aside className="hidden sm:flex w-60 h-screen sticky top-0 text-white flex-col flex-shrink-0 select-none" style={{ background: 'linear-gradient(180deg, #111827 0%, #0f172a 100%)' }}>

        {/* Branding */}
        <button
          onClick={() => router.push('/clients')}
          className="px-4 py-4 border-b border-gray-700/80 flex items-center gap-2.5 w-full text-left hover:bg-gray-800/50 transition-colors"
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
            TC
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight truncate text-white">T&C Contracting</p>
            <p className="text-[10px] text-gray-500 leading-tight tracking-wide uppercase">Financial Platform</p>
          </div>
        </button>

        {/* Tree */}
        <nav className="flex-1 overflow-y-auto py-2">

          {/* Financials top-level link */}
          <div className="px-1 mb-0.5">
            <button
              onClick={() => router.push('/financials')}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                pathname === '/financials'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-xs font-semibold">Financials</span>
            </button>
          </div>

          {/* Global Review Queue — under Financials */}
          <div className="px-1 mb-2">
            <button
              onClick={() => router.push('/review')}
              className={`w-full flex items-center gap-2 pl-5 pr-2 py-1.5 rounded text-left transition-colors ${
                pathname === '/review'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:text-white hover:bg-gray-800'
              }`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span className="text-xs font-medium">Review Queue</span>
            </button>
          </div>

          <div className="border-t border-gray-700/50 mb-2" />

          {/* Section header */}
          <div className="flex items-center justify-between px-3 py-1.5 mb-0.5">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Jobs</span>
            <button
              onClick={() => setShowAddClient(true)}
              title="Add job"
              className="text-gray-600 hover:text-gray-300 p-0.5 rounded hover:bg-gray-700 transition"
            >
              <PlusIcon />
            </button>
          </div>

          {/* Loading skeletons */}
          {loading && (
            <div className="px-3 space-y-1.5 mt-1">
              {[1, 2].map(i => (
                <div key={i} className="h-6 bg-gray-700/60 rounded animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && clients.length === 0 && (
            <button onClick={() => setShowAddClient(true)}
              className="mx-3 mt-1 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition py-1">
              <PlusIcon />
              Add your first job
            </button>
          )}

          {/* Client rows */}
          {clients.map((client) => {
            const clientExpanded = expandedClients.has(client.id);
            const clientProjects = projects[client.id] || [];
            const clientActive = pathname.includes(`/clients/${client.id}/`);
            const isRenamingClient = renamingClientId === client.id;

            return (
              <div key={client.id}>

                {/* ── Client row ── */}
                <div className={`flex items-center group rounded mx-1 ${clientActive ? 'bg-gray-800/40' : ''}`}>
                  {isRenamingClient ? (
                    <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 min-w-0">
                      <ChevronIcon open={clientExpanded} />
                      <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <InlineRename
                        value={client.name}
                        onSave={(n) => handleRenameClient(client.id, n)}
                        onCancel={() => setRenamingClientId(null)}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleClient(client.id)}
                      className="flex-1 flex items-center gap-1.5 px-2 py-1.5 text-left min-w-0 hover:text-white text-gray-300 transition-colors"
                    >
                      <ChevronIcon open={clientExpanded} />
                      <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="truncate text-xs font-semibold">{client.name}</span>
                    </button>
                  )}
                  {/* Rename pencil — visible on hover */}
                  {!isRenamingClient && (
                    <button
                      onClick={() => { setRenamingClientId(client.id); setRenamingProjectId(null); }}
                      title="Rename job"
                      className="p-1 text-gray-700 hover:text-gray-300 rounded hover:bg-gray-700 transition flex-shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <PencilIcon />
                    </button>
                  )}
                  <button
                    onClick={() => setAddProjectFor(client)}
                    title="Add job"
                    className="mr-1 p-1 text-gray-600 hover:text-gray-300 rounded hover:bg-gray-700 transition flex-shrink-0"
                  >
                    <PlusIcon />
                  </button>
                </div>

                {/* ── Project rows ── */}
                {clientExpanded && (
                  <div className="ml-3 border-l border-gray-700/50">
                    {clientProjects.length === 0 && (
                      <button onClick={() => setAddProjectFor(client)}
                        className="w-full text-left pl-4 pr-2 py-1.5 text-[11px] text-gray-600 hover:text-gray-400 italic transition">
                        + Add a job
                      </button>
                    )}

                    {clientProjects.map((project) => {
                      const projectExpanded = expandedProjects.has(project.id);
                      const projectActive = pathname.includes(`/clients/${client.id}/projects/${project.id}/`);
                      const isRenamingProject = renamingProjectId === project.id;

                      return (
                        <div key={project.id}>

                          {/* ── Project row ── */}
                          <div className={`flex items-center group rounded mr-1 ${projectActive ? 'bg-gray-800/40' : ''}`}>
                            {isRenamingProject ? (
                              <div className="flex-1 flex items-center gap-1.5 pl-3 pr-1 py-1.5 min-w-0">
                                <ChevronIcon open={projectExpanded} />
                                <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <InlineRename
                                  value={project.name}
                                  onSave={(n) => handleRenameProject(project.id, client.id, n)}
                                  onCancel={() => setRenamingProjectId(null)}
                                />
                              </div>
                            ) : (
                              <button
                                onClick={() => toggleProject(project.id)}
                                className="flex-1 flex items-center gap-1.5 pl-3 pr-1 py-1.5 text-left min-w-0 text-gray-400 hover:text-white transition-colors"
                              >
                                <ChevronIcon open={projectExpanded} />
                                <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <span className="truncate text-[11px] font-medium">{project.name}</span>
                              </button>
                            )}
                            {/* Rename pencil — visible on hover */}
                            {!isRenamingProject && (
                              <button
                                onClick={() => { setRenamingProjectId(project.id); setRenamingClientId(null); }}
                                title="Rename project"
                                className="p-1 text-gray-700 hover:text-gray-300 rounded hover:bg-gray-700 transition flex-shrink-0 opacity-0 group-hover:opacity-100"
                              >
                                <PencilIcon />
                              </button>
                            )}
                          </div>

                          {/* ── Section links: Expenses / Documents / Summary ── */}
                          {projectExpanded && (
                            <div className="ml-3 border-l border-gray-700/40">
                              {PROJECT_SECTIONS.map((section) => {
                                const href = `${projectBase(client.id, project.id)}/${section.key}`;
                                const active = isSectionActive(client.id, project.id, section.key);
                                return (
                                  <button
                                    key={section.key}
                                    onClick={() => router.push(href)}
                                    className={`w-full flex items-center gap-2 pl-3 pr-2 py-1.5 text-left transition-colors rounded mr-1 ${
                                      active
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-500 hover:text-white hover:bg-gray-800'
                                    }`}
                                  >
                                    <span className={active ? 'text-white' : 'text-gray-600'}>
                                      {section.icon}
                                    </span>
                                    <span className="text-[11px]">{section.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto px-4 py-3 border-t border-white/5 flex-shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-600 tracking-wide">Simplifi AI © 2025</p>
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
          >
            {theme === 'dark' ? (
              /* Sun icon */
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              /* Moon icon */
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </aside>

      {/* Modals */}
      {showAddClient && (
        <AddClientModal
          onClose={() => setShowAddClient(false)}
          onCreated={(client) => {
            setClients(prev => [...prev, client]);
            setExpandedClients(prev => new Set([...prev, client.id]));
            setShowAddClient(false);
          }}
        />
      )}

      {addProjectFor && (
        <AddProjectModal
          client={addProjectFor}
          onClose={() => setAddProjectFor(null)}
          onCreated={(project) => {
            setProjects(prev => ({
              ...prev,
              [addProjectFor.id]: [...(prev[addProjectFor.id] || []), project],
            }));
            setExpandedProjects(prev => new Set([...prev, project.id]));
            setAddProjectFor(null);
            router.push(`/clients/${addProjectFor.id}/projects/${project.id}/expenses`);
          }}
        />
      )}
    </>
  );
}
