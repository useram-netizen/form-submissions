import React from 'react';
import { Eye, ExternalLink, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { StatusDropdown, type Submission } from './StatusDropdown';

interface Props {
  submissions: Submission[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  locationId: string;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newSize: number) => void;
  onView: (sub: Submission) => void;
  onUpdateStatus: (sub: Submission, stageId: string, stageName: string) => Promise<void>;
}

export function SubmissionsTable({
  submissions,
  total,
  loading,
  page,
  pageSize,
  locationId,
  onPageChange,
  onPageSizeChange,
  onView,
  onUpdateStatus,
}: Props) {
  const isAll = pageSize >= total;
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const startIndex = isAll ? 0 : (page - 1) * pageSize;
  const pageSubmissions = isAll ? submissions : submissions.slice(startIndex, startIndex + pageSize);

  function formatDate(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });
  }

  const renderPaginationBar = (borderPosition: 'top' | 'bottom') => {
    if (loading || total === 0) return null;
    const borderClass =
      borderPosition === 'top' ? 'border-b border-slate-200' : 'border-t border-slate-200';
    return (
      <div
        className={`px-4 py-3 ${borderClass} bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600`}
      >
        <div className="flex items-center gap-3">
          <div>
            Showing <span className="font-semibold text-slate-900">{startIndex + 1}</span> to{' '}
            <span className="font-semibold text-slate-900">
              {Math.min(startIndex + pageSize, total)}
            </span>{' '}
            of <span className="font-semibold text-slate-900">{total}</span> submissions
          </div>

          <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
            <span className="text-slate-400">Rows per page:</span>
            <select
              value={pageSize >= 9999 ? 'all' : pageSize}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 9999 : Number(e.target.value);
                onPageSizeChange(val);
              }}
              className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700 font-medium cursor-pointer"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="all">Show All ({total})</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1 || isAll}
            onClick={() => onPageChange(page - 1)}
            className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {!isAll &&
            Array.from({ length: totalPages }).map((_, idx) => {
              const p = idx + 1;
              const isCurrent = p === page;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`w-7 h-7 rounded text-xs font-medium transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              );
            })}

          <button
            type="button"
            disabled={page >= totalPages || isAll}
            onClick={() => onPageChange(page + 1)}
            className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
      {renderPaginationBar('top')}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-4">Submitted</th>
              <th className="py-3.5 px-4">Contact</th>
              <th className="py-3.5 px-4">Form</th>
              <th className="py-3.5 px-4">Service</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              // Skeleton loading rows
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-3.5 px-4">
                    <div className="h-4 w-28 bg-slate-200 rounded" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-4 w-36 bg-slate-200 rounded mb-1.5" />
                    <div className="h-3 w-28 bg-slate-100 rounded" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-4 w-24 bg-slate-200 rounded" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-4 w-20 bg-slate-200 rounded" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-6 w-28 bg-slate-200 rounded-full" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="h-7 w-16 bg-slate-200 rounded ml-auto" />
                  </td>
                </tr>
              ))
            ) : pageSubmissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center">
                    <Inbox className="w-10 h-10 text-slate-300 mb-2 stroke-[1.5]" />
                    <p className="text-sm font-medium text-slate-600">No submissions found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              pageSubmissions.map((sub) => {
                const contactUrl = sub.contactId
                  ? `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${sub.contactId}`
                  : null;

                return (
                  <tr
                    key={sub.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Submitted Date */}
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap align-top">
                      {formatDate(sub.submittedAt)}
                    </td>

                    {/* Contact Info */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-900">{sub.contact.name}</span>
                        {contactUrl && (
                          <a
                            href={contactUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700 transition-colors"
                            title="Open in CRM"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      {sub.contact.email && (
                        <div className="text-xs text-slate-500 mt-0.5">{sub.contact.email}</div>
                      )}
                      {sub.contact.phone && (
                        <div className="text-xs text-slate-400">{sub.contact.phone}</div>
                      )}
                    </td>

                    {/* Form Name */}
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700 whitespace-nowrap align-top">
                      {sub.formDisplayName}
                    </td>

                    {/* Service */}
                    <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap align-top">
                      {sub.service || <span className="text-slate-300">—</span>}
                    </td>

                    {/* Status Dropdown */}
                    <td className="py-3.5 px-4 whitespace-nowrap align-top">
                      <StatusDropdown
                        submission={sub}
                        onUpdateStatus={onUpdateStatus}
                      />
                    </td>

                    {/* View Button */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap align-top">
                      <button
                        type="button"
                        onClick={() => onView(sub)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Pagination Bar */}
      {renderPaginationBar('bottom')}
    </div>
  );
}

