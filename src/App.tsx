import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Filter,
  Sparkles,
  X,
  RotateCcw,
} from 'lucide-react';
import { SubmissionsTable } from './components/SubmissionsTable';
import { SubmissionDrawer } from './components/SubmissionDrawer';
import type { Submission } from './components/StatusDropdown';

interface ApiResponse {
  submissions: Submission[];
  total: number;
  forms: string[];
  statuses: string[];
  services: string[];
  locationId: string;
  elapsedMs: number;
}

export default function App() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('Initializing...');

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedForm, setSelectedForm] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedService, setSelectedService] = useState('all');
  const [datePreset, setDatePreset] = useState('all'); // Default to All Time so all 311 submissions & 136 Free Day are visible immediately
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Drawer state
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  // Fetch data from our clean backend
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSyncStatus('Fetching form submissions & pipeline opportunities from CRM...');
    console.groupCollapsed('%c[CRM Sync] Fetching all submissions & statuses', 'color:#2563eb;font-weight:bold');
    console.log('[1/3] Triggering /api/submissions...');
    const t0 = performance.now();

    try {
      const res = await fetch('/api/submissions');
      if (!res.ok) {
        throw new Error(`Failed to fetch submissions (${res.status}): ${await res.text()}`);
      }
      const json: ApiResponse = await res.json();
      const elapsed = Math.round(performance.now() - t0);

      console.log(`[2/3] Response received in ${elapsed}ms:`, {
        submissionsCount: json.submissions.length,
        formsCount: json.forms.length,
        servicesCount: json.services.length,
        statusesCount: json.statuses.length,
      });
      console.log('[3/3] First 3 submissions sample:', json.submissions.slice(0, 3));
      console.groupEnd();

      setData(json);
      setSyncStatus(`✓ All ${json.submissions.length} submissions & pipeline statuses loaded in ${elapsed}ms`);
    } catch (err: any) {
      console.error('[CRM Error] Sync failed:', err);
      console.groupEnd();
      setError(err.message || 'Unable to connect to CRM. Please verify network and API credentials.');
      setSyncStatus('Sync failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when any filter changes
  useEffect(() => {
    setPage(1);
  }, [search, selectedForm, selectedStatus, selectedService, datePreset]);

  // Filter logic
  const filteredSubmissions = useMemo(() => {
    if (!data?.submissions) return [];
    const q = search.trim().toLowerCase();

    const now = new Date();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    if (datePreset === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      minDate = start;
    } else if (datePreset === 'yesterday') {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      minDate = start;
      maxDate = end;
    } else if (datePreset === 'last7') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      minDate = start;
    } else if (datePreset === 'last30') {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      minDate = start;
    } else if (datePreset === 'thisMonth') {
      minDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (datePreset === 'lastMonth') {
      minDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      maxDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    return data.submissions.filter((s) => {
      // Search filter (name, email, phone)
      if (q) {
        const name = (s.contact.name || '').toLowerCase();
        const email = (s.contact.email || '').toLowerCase();
        const phone = (s.contact.phone || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !phone.includes(q)) {
          return false;
        }
      }

      // Form filter
      if (selectedForm !== 'all' && s.formDisplayName !== selectedForm) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && s.status !== selectedStatus) {
        return false;
      }

      // Service filter
      if (selectedService !== 'all' && s.service !== selectedService) {
        return false;
      }

      // Date range filter
      if (minDate || maxDate) {
        const subDate = new Date(s.submittedAt);
        if (minDate && subDate < minDate) return false;
        if (maxDate && subDate > maxDate) return false;
      }

      return true;
    });
  }, [data?.submissions, search, selectedForm, selectedStatus, selectedService, datePreset]);

  // Handle status update
  async function handleUpdateStatus(sub: Submission, stageId: string, stageName: string) {
    console.log(`[Status Update] Updating submission ${sub.id} to stage ${stageName} (${stageId})`);
    
    // Optimistic UI update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        submissions: prev.submissions.map((s) =>
          s.id === sub.id ? { ...s, status: stageName, pipelineStageId: stageId } : s
        ),
      };
    });

    if (selectedSubmission && selectedSubmission.id === sub.id) {
      setSelectedSubmission((prev) =>
        prev ? { ...prev, status: stageName, pipelineStageId: stageId } : null
      );
    }

    try {
      const res = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: sub.submissionId || sub.id,
          contactId: sub.contactId,
          contactName: sub.contact.name,
          pipelineId: sub.pipelineId,
          stageId,
          opportunityId: sub.opportunityId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update status: ${await res.text()}`);
      }

      const json = await res.json();
      console.log('[Status Update Success]:', json);
      if (json.opportunityId && !sub.opportunityId) {
        // Save opportunity ID if newly created
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            submissions: prev.submissions.map((s) =>
              s.id === sub.id ? { ...s, opportunityId: json.opportunityId } : s
            ),
          };
        });
      }
    } catch (err: any) {
      console.error('[Status Update Error]:', err);
      alert(`Failed to save status to CRM: ${err.message}`);
      // Rollback by refetching
      fetchData();
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Form Submissions</h1>
              {data && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                  {filteredSubmissions.length === data.total
                    ? `Total ${data.total}`
                    : `Showing ${filteredSubmissions.length} of ${data.total}`}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">Manage and review incoming form submissions</p>
          </div>

          <div>
            <button
              type="button"
              disabled={loading}
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg shadow-2xs hover:bg-slate-50 disabled:opacity-60 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Live Sync Status Banner */}
        <div
          className={`mb-6 px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition-colors ${
            error
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : loading
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {error ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : loading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{error || syncStatus}</span>
          </div>
          {error && (
            <button
              type="button"
              onClick={fetchData}
              className="underline hover:text-rose-900 font-semibold cursor-pointer ml-3"
            >
              Try again
            </button>
          )}
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, phone..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            {/* Form Filter */}
            <div>
              <select
                value={selectedForm}
                onChange={(e) => setSelectedForm(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="all">All Forms</option>
                {data?.forms.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="all">All Statuses</option>
                {data?.statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Filter */}
            <div>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="all">All Services</option>
                {data?.services.map((svc) => (
                  <option key={svc} value={svc}>
                    {svc}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Preset Filter */}
            <div>
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer font-medium"
              >
                <option value="all">All Time</option>
                <option value="last30">Last 30 Days</option>
                <option value="last7">Last 7 Days</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
              </select>
            </div>
          </div>

          {/* Active Filter Pills & Clear All */}
          {(search.trim() || selectedForm !== 'all' || selectedStatus !== 'all' || selectedService !== 'all' || datePreset !== 'all') && (
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3 text-slate-400" /> Active filters:
              </span>

              {search.trim() && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  <span>Search: &quot;{search}&quot;</span>
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="hover:text-blue-900 cursor-pointer p-0.5 rounded-full hover:bg-blue-100"
                    title="Remove search filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedForm !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <span>Form: {selectedForm}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedForm('all')}
                    className="hover:text-indigo-900 cursor-pointer p-0.5 rounded-full hover:bg-indigo-100"
                    title="Remove form filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedStatus !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <span>Status: {selectedStatus}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedStatus('all')}
                    className="hover:text-amber-900 cursor-pointer p-0.5 rounded-full hover:bg-amber-100"
                    title="Remove status filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedService !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span>Service: {selectedService}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedService('all')}
                    className="hover:text-emerald-900 cursor-pointer p-0.5 rounded-full hover:bg-emerald-100"
                    title="Remove service filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {datePreset !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  <span>
                    Date:{' '}
                    {datePreset === 'last30'
                      ? 'Last 30 Days'
                      : datePreset === 'last7'
                      ? 'Last 7 Days'
                      : datePreset === 'today'
                      ? 'Today'
                      : datePreset === 'yesterday'
                      ? 'Yesterday'
                      : datePreset === 'thisMonth'
                      ? 'This Month'
                      : 'Last Month'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDatePreset('all')}
                    className="hover:text-purple-900 cursor-pointer p-0.5 rounded-full hover:bg-purple-100"
                    title="Reset date filter to All Time"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedForm('all');
                  setSelectedStatus('all');
                  setSelectedService('all');
                  setDatePreset('all');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 cursor-pointer font-medium transition-colors ml-auto sm:ml-2"
                title="Clear all filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear all filters</span>
              </button>
            </div>
          )}
        </div>

        {/* Table & Pagination */}
        <SubmissionsTable
          submissions={filteredSubmissions}
          total={filteredSubmissions.length}
          loading={loading}
          page={page}
          pageSize={pageSize}
          locationId={data?.locationId || 'cckHAePWlX9aGnx16fQI'}
          onPageChange={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          onView={(sub) => setSelectedSubmission(sub)}
          onUpdateStatus={handleUpdateStatus}
        />
      </div>

      {/* Details Drawer */}
      <SubmissionDrawer
        submission={selectedSubmission}
        locationId={data?.locationId || 'cckHAePWlX9aGnx16fQI'}
        onClose={() => setSelectedSubmission(null)}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
}

