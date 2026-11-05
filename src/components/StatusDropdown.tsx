import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Loader2 } from 'lucide-react';

export interface Stage {
  id: string;
  name: string;
}

export interface Submission {
  id: string;
  submissionId: string;
  contactId: string | null;
  submittedAt: string;
  formId: string;
  formName: string;
  formDisplayName: string;
  contact: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  service: string | null;
  status: string;
  pipelineId: string | null;
  pipelineStageId: string | null;
  opportunityId: string | null;
  availableStages: Stage[];
  fields: { key: string; label: string; value: string }[];
}

interface Props {
  submission: Submission;
  onUpdateStatus: (sub: Submission, stageId: string, stageName: string) => Promise<void>;
}

export function getStatusColorClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('converted') || s.includes('booked') || s.includes('confirmed') || s.includes('completed')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
  }
  if (s.includes('pending') || s.includes('evaluation') || s.includes('registration')) {
    return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100';
  }
  if (s.includes('lead') || s.includes('new') || s.includes('submission')) {
    return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
  }
  if (s.includes('awaiting') || s.includes('contacted') || s.includes('follow')) {
    return 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100';
  }
  if (s.includes('closed') || s.includes('unresponsive') || s.includes('cancel')) {
    return 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200';
  }
  return 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100';
}

export function StatusDropdown({ submission, onUpdateStatus }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const stages = submission.availableStages || [];
  const hasStages = stages.length > 0;
  const currentStatus = submission.status || '—';

  async function handleSelect(stage: Stage) {
    if (stage.name === currentStatus) {
      setIsOpen(false);
      return;
    }
    setIsUpdating(true);
    setIsOpen(false);
    try {
      await onUpdateStatus(submission, stage.id, stage.name);
    } finally {
      setIsUpdating(false);
    }
  }

  if (currentStatus === '—' && !hasStages) {
    return <span className="text-slate-400 font-medium">—</span>;
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        disabled={isUpdating || !hasStages}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
          getStatusColorClass(currentStatus)
        } ${!hasStages ? 'cursor-default opacity-85' : 'cursor-pointer shadow-xs'}`}
      >
        {isUpdating ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <span>{currentStatus}</span>
        )}
        {hasStages && !isUpdating && (
          <ChevronDown className="w-3 h-3 text-current opacity-70" />
        )}
      </button>

      {isOpen && hasStages && (
        <div className="absolute left-0 mt-1.5 w-56 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50 py-1 focus:outline-none">
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
            Change Pipeline Status
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {stages.map((stage) => {
              const isSelected = stage.name === currentStatus;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => handleSelect(stage)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                    isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{stage.name}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

