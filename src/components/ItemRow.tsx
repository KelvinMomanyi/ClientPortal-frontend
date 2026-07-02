import { useState, type FormEvent } from 'react';
import { ExternalLink, MessageSquare, Paperclip, RefreshCw, Send } from 'lucide-react';
import { isAxiosError } from 'axios';
import api from '../services/api';
import { useToast } from '../contexts/toastContextValue';
import type { FileAttachment, ItemSummary, ItemUpdate } from '../utils/mondayHelpers';
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
  const [updates, setUpdates] = useState<ItemUpdate[]>([]);
  const [updatesLoaded, setUpdatesLoaded] = useState(false);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const { toast } = useToast();
  const itemFiles = item.files || [];

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

  const loadUpdates = async (force = false) => {
    if (loadingUpdates || (updatesLoaded && !force)) return;

    try {
      setLoadingUpdates(true);
      setCommentsError(null);
      const response = await api.get(`/monday/items/${item.id}/updates`, {
        params: { boardId },
      });
      setUpdates(response.data.updates || []);
      setUpdatesLoaded(true);
    } catch (err) {
      console.error('Failed to load item updates', err);
      const message = getApiError(err, 'Failed to load comments. Please try again.');
      setUpdatesLoaded(true);
      setCommentsError(message);
      toast(message, 'error');
    } finally {
      setLoadingUpdates(false);
    }
  };

  const refreshUpdates = () => {
    void loadUpdates(true);
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = comment.trim();
    if (!trimmed) return;

    try {
      setPostingComment(true);
      const response = await api.post(`/monday/items/${item.id}/updates`, {
        boardId,
        body: trimmed,
      });
      const createdUpdate = response.data.update as ItemUpdate | undefined;
      setComment('');
      setUpdatesLoaded(true);
      setCommentsError(null);
      if (createdUpdate) {
        setUpdates((current) => [createdUpdate, ...current]);
      } else {
        await loadUpdates(true);
      }
      toast('Comment posted to Monday.', 'success');
    } catch (err) {
      console.error('Failed to post item update', err);
      const message = getApiError(err, 'Failed to post comment. Please try again.');
      setCommentsError(message);
      toast(message, 'error');
    } finally {
      setPostingComment(false);
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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
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

      {itemFiles.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {itemFiles.map((file) => (
            <a
              key={file.id}
              href={file.public_url || file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 transition hover:border-sky-300 hover:bg-sky-100"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{file.name}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ))}
        </div>
      )}

      <details
        className="mt-3"
        onToggle={(event) => {
          if (event.currentTarget.open) void loadUpdates();
        }}
      >
        <summary className="cursor-pointer text-xs font-semibold text-[color:var(--muted)]">
          {showDetails ? 'Details, files, and comments' : 'Files and comments'}
        </summary>

        <div className="mt-3 space-y-4">
          {showDetails && (
            <>
              {item.columns.length === 0 ? (
                <div className="text-sm text-[color:var(--muted)]">No fields available for this item.</div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {item.columns.map((col) => {
                    const files = getFilesFromColumn(col);
                    return (
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
                              {files.map((file: FileAttachment) => (
                                <a
                                  key={file.id}
                                  href={file.public_url || file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-blue-600 hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span>{file.name}</span>
                                  {file.file_size ? (
                                    <span className="text-xs text-[color:var(--muted)]">
                                      {formatFileSize(file.file_size)}
                                    </span>
                                  ) : null}
                                </a>
                              ))}
                              {files.length === 0 && '-'}
                            </div>
                          ) : (
                            getColumnValue(col)
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[color:var(--brand)]" />
                <div>
                  <p className="text-sm font-semibold text-[color:var(--ink)]">Client updates</p>
                  <p className="text-xs text-[color:var(--muted)]">
                    Comments are posted back to the Monday item.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={refreshUpdates}
                disabled={loadingUpdates}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--ink)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand-strong)] disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingUpdates ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {commentsError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {commentsError}
                </div>
              ) : loadingUpdates && !updatesLoaded ? (
                <div className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--muted)]">
                  Loading comments...
                </div>
              ) : updatesLoaded && updates.length === 0 ? (
                <div className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--muted)]">
                  No comments yet.
                </div>
              ) : (
                updates.map((update) => (
                  <div key={update.id} className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs font-semibold text-[color:var(--ink)]">
                        {update.creator?.name || 'Monday update'}
                      </span>
                      <span className="text-[11px] text-[color:var(--muted)]">
                        {formatUpdateTimestamp(update.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[color:var(--ink)]">
                      {formatUpdateText(update.body) || 'Update with attachments'}
                    </p>
                    {(update.assets || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(update.assets || []).map((asset) => (
                          <a
                            key={asset.id}
                            href={asset.public_url || asset.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--bg-soft)] px-2.5 py-1 text-xs font-semibold text-[color:var(--ink)] hover:border-[color:var(--brand)]"
                          >
                            <Paperclip className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{asset.name}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={submitComment} className="mt-3 space-y-2">
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="Add a comment for the project team"
                className="w-full rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--ink)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/15"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-[color:var(--muted)]">{comment.trim().length}/5000</span>
                <button
                  type="submit"
                  disabled={postingComment || comment.trim().length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--brand)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[color:var(--brand-strong)] disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  {postingComment ? 'Posting...' : 'Post comment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </details>
    </div>
  );
}

function getApiError(err: unknown, fallback: string) {
  return isAxiosError<{ error?: string }>(err)
    ? err.response?.data?.error || err.message || fallback
    : fallback;
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUpdateTimestamp(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatUpdateText(body: string) {
  return body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
