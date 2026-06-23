import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/toastContextValue';
import type { FileAttachment, ItemSummary } from '../utils/mondayHelpers';
import { getStatusTone, getColumnValue, getFilesFromColumn } from '../utils/mondayHelpers';

export default function ItemRow({
  item,
  boardId,
  onStatusUpdate,
  showDetails = true,
}: {
  item: ItemSummary;
  boardId: string;
  onStatusUpdate: () => void;
  showDetails?: boolean;
}) {
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      setUpdating(true);
      await api.post('/monday/status-update', {
        boardId,
        itemId: item.id,
        status: newStatus,
        columnId: item.statusColumnId,
      });
      toast(`Status updated to "${newStatus}"`, 'success');
      onStatusUpdate();
    } catch (err) {
      console.error('Failed to update status', err);
      toast('Failed to update status. Please try again.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const isOwnerMissing = item.owner === 'Unassigned';
  const isPriorityMissing = item.priority === 'Not set';
  const isDueMissing = item.dueLabel === 'No due date';
  const ownerClass = isOwnerMissing ? 'text-[color:var(--muted)]' : 'text-[color:var(--ink)]';
  const priorityClass = isPriorityMissing ? 'text-[color:var(--muted)]' : 'text-[color:var(--ink)]';
  const dueClass = isDueMissing
    ? 'text-[color:var(--muted)]'
    : item.overdue
    ? 'text-rose-700'
    : item.dueSoon
    ? 'text-amber-700'
    : 'text-[color:var(--ink)]';

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-white/85 p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[color:var(--ink)]">{item.name}</p>
            {item.attention && (
              <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                Attention
              </span>
            )}
          </div>
          <p className="text-xs text-[color:var(--muted)]">Item #{item.id}</p>
        </div>
        <div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusTone(item.statusLabel)}`}
          >
            {item.statusLabel}
          </span>
        </div>
        <div className={`text-sm ${ownerClass}`}>{item.owner}</div>
        <div className="text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className={dueClass}>{item.dueLabel}</span>
            {item.overdue ? (
              <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                Overdue
              </span>
            ) : item.dueSoon ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                Due soon
              </span>
            ) : null}
          </div>
        </div>
        <div className={`text-sm ${priorityClass}`}>{item.priority}</div>
        <div className="flex gap-2">
          {item.statusLabel.toLowerCase() === 'working on it' || item.statusLabel.toLowerCase() === 'stuck' ? (
            <>
              <button
                disabled={updating}
                onClick={() => handleUpdateStatus('Done')}
                className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-md hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {updating ? '...' : 'Approve'}
              </button>
              <button
                disabled={updating}
                onClick={() => handleUpdateStatus('Stuck')}
                className="px-3 py-1 bg-rose-600 text-white text-xs font-bold rounded-md hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {updating ? '...' : 'Request Changes'}
              </button>
            </>
          ) : null}
        </div>
      </div>
      {showDetails && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-[color:var(--muted)]">
            Full details
          </summary>
          {item.columns.length === 0 ? (
            <div className="mt-3 text-sm text-[color:var(--muted)]">No fields available for this item.</div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {item.columns.map((col) => (
                <div
                  key={`${item.id}-${col.id}-detail`}
                  className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3"
                >
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                    {col.title || col.id}
                  </div>
                  <div className="mt-1 text-sm text-[color:var(--ink)] break-words">
                    {col.type === 'file' ? (
                      <div className="space-y-1">
                        {getFilesFromColumn(col).map((file: FileAttachment) => (
                          <a
                            key={file.id}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {file.name}
                          </a>
                        ))}
                        {getFilesFromColumn(col).length === 0 && '-'}
                      </div>
                    ) : (
                      getColumnValue(col)
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </details>
      )}
    </div>
  );
}
