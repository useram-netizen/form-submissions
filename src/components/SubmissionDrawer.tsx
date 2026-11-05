import React, { useEffect } from 'react';
import { X, ExternalLink, Calendar, Mail, Phone, User, FileText, CheckCircle2 } from 'lucide-react';
import { StatusDropdown, type Submission } from './StatusDropdown';

interface Props {
  submission: Submission | null;
  locationId: string;
  onClose: () => void;
  onUpdateStatus: (sub: Submission, stageId: string, stageName: string) => Promise<void>;
}

export function SubmissionDrawer({ submission, locationId, onClose, onUpdateStatus }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (submission) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submission, onClose]);

  if (!submission) return null;

  const contactUrl = submission.contactId
    ? `https://app.dabr.ai/v2/location/${locationId}/contacts/detail/${submission.contactId}`
    : null;

  const dateStr = new Date(submission.submittedAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Submission Details</h2>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <span>{submission.formDisplayName}</span>
                <span>•</span>
                <span>{dateStr}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Status Section */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                  Current Status
                </span>
                <StatusDropdown submission={submission} onUpdateStatus={onUpdateStatus} />
              </div>
              {submission.service && (
                <div className="text-right">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                    Service
                  </span>
                  <span className="text-xs font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                    {submission.service}
                  </span>
                </div>
              )}
            </div>

            {/* Contact Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Contact Information
              </h3>
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500 flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Name
                  </span>
                  <div className="text-xs font-medium text-slate-900 flex items-center gap-1.5">
                    {submission.contact.name}
                    {contactUrl && (
                      <a
                        href={contactUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                        title="Open contact in CRM"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {submission.contact.email && (
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-slate-500 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> Email
                    </span>
                    <a
                      href={`mailto:${submission.contact.email}`}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      {submission.contact.email}
                    </a>
                  </div>
                )}

                {submission.contact.phone && (
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-slate-500 flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone
                    </span>
                    <a
                      href={`tel:${submission.contact.phone}`}
                      className="text-xs font-medium text-slate-800"
                    >
                      {submission.contact.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Submitted Form Fields */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Submitted Form Fields ({submission.fields.length})
              </h3>
              {submission.fields.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No additional field entries found.</p>
              ) : (
                <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
                  {submission.fields.map((field) => (
                    <div key={field.key} className="px-4 py-3">
                      <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">
                        {field.label}
                      </div>
                      <div className="text-xs text-slate-800 break-words whitespace-pre-wrap font-mono bg-slate-50/50 p-1.5 rounded mt-1 border border-slate-100">
                        {field.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

