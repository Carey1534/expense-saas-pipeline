import { ExpenseStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: ExpenseStatus;
}

const LABEL: Record<ExpenseStatus, string> = {
  PENDING_APPROVAL: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXTRACTED: 'Extracted',
  PROCESSING: 'Processing',
  DRAFT: 'Draft',
};

const STYLE: Record<ExpenseStatus, string> = {
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED:         'bg-red-50 text-red-600 border-red-200',
  EXTRACTED:        'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING:       'bg-gray-100 text-gray-600 border-gray-200',
  DRAFT:            'bg-gray-50 text-gray-500 border-gray-200',
};

const DOT: Record<ExpenseStatus, string> = {
  PENDING_APPROVAL: 'bg-amber-400 animate-pulse',
  APPROVED:         'bg-emerald-500',
  REJECTED:         'bg-red-500',
  EXTRACTED:        'bg-blue-400',
  PROCESSING:       'bg-gray-400 animate-pulse',
  DRAFT:            'bg-gray-300',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style = STYLE[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const dot   = DOT[status]   ?? 'bg-gray-300';
  const label = LABEL[status] ?? status.replace(/_/g, ' ');

  return (
    <span
      key={status}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border
        transition-all duration-200 animate-[fadeIn_0.2s_ease-out] whitespace-nowrap
        ${style}
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {label}
    </span>
  );
}
