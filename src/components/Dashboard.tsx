import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react';
import {
  LayoutDashboard,
  LogOut,
  Layers,
  BadgeCheck,
  Sparkles,
  AlertTriangle,
  FileQuestion,
  History,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import api from '../services/api';
import { useAuth } from '../contexts/authContextValue';
import ItemRow from './ItemRow';
import type { Board, ClientActivityEvent, ClientFileRequest, ItemWithStatus, PortalSettings } from '../utils/mondayHelpers';
import {
  getStatusLabel,
  isDoneStatus,
  buildItemSummary,
  compareItemsByFocus,
} from '../utils/mondayHelpers';

type ClientRoomSummary = {
  pendingApprovals: number;
  approved: number;
  changesRequested: number;
  openFileRequests: number;
};

type DashboardResponse = {
  boards?: Board[];
  portalSettings?: PortalSettings;
  clientRoom?: {
    summary?: ClientRoomSummary;
    fileRequests?: ClientFileRequest[];
    recentActivity?: ClientActivityEvent[];
  };
};

const defaultPortalSettings: PortalSettings = {
  portalName: 'Client Approval Portal',
  logoUrl: '',
  primaryColor: '#0073ea',
  welcomeMessage: 'Review approvals, files, decisions, and project updates in one secure client room.',
  supportEmail: '',
};

export default function Dashboard() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [portalSettings, setPortalSettings] = useState<PortalSettings>(defaultPortalSettings);
  const [clientRoomSummary, setClientRoomSummary] = useState<ClientRoomSummary>({
    pendingApprovals: 0,
    approved: 0,
    changesRequested: 0,
    openFileRequests: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ClientActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { client, logout } = useAuth();

  const clientName = client?.name || client?.email || 'Client';
  const clientMeta = client?.email || 'Workspace';

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<DashboardResponse>('/monday/dashboard');
      setBoards(response.data.boards || []);
      setPortalSettings(response.data.portalSettings || defaultPortalSettings);
      setClientRoomSummary({
        pendingApprovals: response.data.clientRoom?.summary?.pendingApprovals || 0,
        approved: response.data.clientRoom?.summary?.approved || 0,
        changesRequested: response.data.clientRoom?.summary?.changesRequested || 0,
        openFileRequests: response.data.clientRoom?.summary?.openFileRequests || 0,
      });
      setRecentActivity(response.data.clientRoom?.recentActivity || []);
    } catch (err: unknown) {
      console.error('Error fetching dashboard', err);
      const message = isAxiosError<{ error?: string }>(err) ? err.response?.data?.error : undefined;
      setError(message || 'Unable to load dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const refreshData = () => void fetchDashboard();

  const summary = useMemo(() => {
    const allItems = boards.flatMap((board) => board.items_page?.items || []);
    const itemsWithStatus: ItemWithStatus[] = allItems.map((item) => ({
      ...item,
      statusLabel: getStatusLabel(item),
    }));
    const summaries = itemsWithStatus.map(buildItemSummary);
    const completed = summaries.filter((i) => isDoneStatus(i.statusLabel)).length;
    const attention = summaries.filter((i) => i.attention).length;
    const dueSoon = summaries.filter((i) => i.dueSoon).length;
    return { totalBoards: boards.length, totalItems: allItems.length, completed, attention, dueSoon };
  }, [boards]);

  const summaryCards = [
    { label: 'Boards', value: loading ? '-' : summary.totalBoards, note: `Total items: ${loading ? '-' : summary.totalItems}`, icon: Layers },
    { label: 'Pending Approval', value: loading ? '-' : clientRoomSummary.pendingApprovals, note: 'Waiting on decisions', icon: BadgeCheck },
    { label: 'File Requests', value: loading ? '-' : clientRoomSummary.openFileRequests, note: 'Open requests', icon: FileQuestion },
    { label: 'Attention', value: loading ? '-' : summary.attention, note: 'Blocked or overdue', icon: AlertTriangle },
  ];

  return (
    <div
      className="min-h-screen app-shell"
      style={{ '--brand': portalSettings.primaryColor } as CSSProperties}
    >
      {/* ── Navbar ────────────────────────────────── */}
      <nav className="border-b border-[color:var(--border)] bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--bg-soft)] text-[color:var(--brand)] shadow-sm">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-semibold text-[color:var(--ink)]">{portalSettings.portalName}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--bg-soft)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Live Boards</span>
                </div>
                <p className="text-xs text-[color:var(--muted)]">Approvals, files, decisions, and updates in one place</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 py-2 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--bg-soft)] text-[color:var(--brand)]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Signed in</p>
                  <p className="text-sm font-semibold text-[color:var(--ink)]">{clientName}</p>
                  <p className="text-xs text-[color:var(--muted)]">{clientMeta}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white/80 px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand-strong)]"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main content ──────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Summary section */}
        <section className="mb-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-[color:var(--muted)]">Client Room</p>
              <h1 className="font-display text-3xl font-semibold text-[color:var(--ink)] sm:text-4xl">{portalSettings.portalName}</h1>
              <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted)]">{portalSettings.welcomeMessage}</p>
              {portalSettings.supportEmail ? (
                <p className="mt-2 text-xs text-[color:var(--muted)]">Support: {portalSettings.supportEmail}</p>
              ) : null}
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/80 px-5 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">Decision Signals</p>
              <div className="mt-3 grid gap-2 text-xs">
                <span className="inline-flex items-center justify-between gap-4 rounded-full px-3 py-1 font-semibold ring-1 ring-inset bg-emerald-100 text-emerald-800 ring-emerald-200">
                  Approved <b>{clientRoomSummary.approved}</b>
                </span>
                <span className="inline-flex items-center justify-between gap-4 rounded-full px-3 py-1 font-semibold ring-1 ring-inset bg-rose-100 text-rose-800 ring-rose-200">
                  Changes requested <b>{clientRoomSummary.changesRequested}</b>
                </span>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-3xl border border-[color:var(--border)] bg-white/85 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">{card.label}</p>
                      <p className="font-display text-2xl font-semibold text-[color:var(--ink)]">{card.value}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--bg-soft)] text-[color:var(--brand)]">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--muted)]">{card.note}</p>
                </div>
              );
            })}
          </div>
        </section>

        {recentActivity.length > 0 && (
          <section className="mb-8 rounded-3xl border border-[color:var(--border)] bg-white/85 p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-[color:var(--brand)]" />
              <h2 className="font-display text-lg font-semibold text-[color:var(--ink)]">Recent decisions and requests</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recentActivity.slice(0, 6).map((event) => (
                <div key={event.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2">
                  <p className="text-sm font-semibold text-[color:var(--ink)]">{event.summary}</p>
                  <p className="text-xs text-[color:var(--muted)]">{formatActivityTime(event.createdAt)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Board data */}
        {loading ? (
          <div className="space-y-6">
            {[...Array(2)].map((_, index) => (
              <div key={index} className="rounded-3xl border border-[color:var(--border)] bg-white/80 p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="h-4 w-40 rounded-full bg-[color:var(--bg-soft)] animate-pulse" />
                  <div className="h-3 w-24 rounded-full bg-[color:var(--bg-soft)] animate-pulse" />
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="h-20 rounded-2xl bg-[color:var(--bg-soft)] animate-pulse" />
                  <div className="h-20 rounded-2xl bg-[color:var(--bg-soft)] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="text-lg font-semibold text-rose-700">{error}</p>
            <p className="mt-2 text-sm text-rose-600">Check your backend terminal for more details.</p>
          </div>
        ) : boards.length === 0 ? (
          <div className="rounded-3xl border border-[color:var(--border)] bg-white/80 p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--bg-soft)] text-[color:var(--brand)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-lg font-semibold text-[color:var(--ink)]">No projects assigned yet.</p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">Once boards are shared with you, they will appear here in this organized view.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {boards.map((board) => {
              const items = board.items_page?.items || [];
              const itemsWithStatus: ItemWithStatus[] = items.map((item) => ({ ...item, statusLabel: getStatusLabel(item) }));
              const itemSummaries = itemsWithStatus.map(buildItemSummary);
              const completed = itemSummaries.filter((i) => isDoneStatus(i.statusLabel)).length;
              const progress = itemSummaries.length ? Math.round((completed / itemSummaries.length) * 100) : 0;
              const activeCount = itemSummaries.length - completed;
              const attentionCount = itemSummaries.filter((i) => i.attention).length;
              const dueSoonCount = itemSummaries.filter((i) => i.dueSoon).length;
              const sortedItems = [...itemSummaries].sort(compareItemsByFocus);
              const keyItems = sortedItems.filter((i) => !isDoneStatus(i.statusLabel)).slice(0, 5);

              return (
                <section key={board.id} className="rounded-3xl border border-[color:var(--border)] bg-white/85 shadow-sm">
                  {/* Board header */}
                  <div className="border-b border-[color:var(--border)] px-6 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--bg-soft)] text-[color:var(--brand)]">
                          <Layers className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="font-display text-xl font-semibold text-[color:var(--ink)]">{board.name}</h2>
                          <p className="text-sm text-[color:var(--muted)]">{itemsWithStatus.length} items, {completed} completed</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                        <div className="text-sm text-[color:var(--muted)]">
                          <p className="text-xs uppercase tracking-[0.2em]">Progress</p>
                          <p className="font-semibold text-[color:var(--ink)]">{progress}% complete</p>
                        </div>
                        <div className="h-2 w-40 rounded-full bg-[color:var(--bg-soft)]">
                          <div className="h-2 rounded-full bg-[color:var(--brand)] transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--muted)]">
                      <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">Attention: {attentionCount}</span>
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">Due soon: {dueSoonCount}</span>
                      <span className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-white px-3 py-1">Active: {activeCount}</span>
                      <span className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-white px-3 py-1">Completed: {completed}</span>
                    </div>
                  </div>

                  {/* Board body */}
                  <div className="space-y-6 p-6">
                    {itemSummaries.length === 0 ? (
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-soft)] p-6 text-center text-sm text-[color:var(--muted)]">No tasks found in this project.</div>
                    ) : (
                      <>
                        {/* Board stats */}
                        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
                          <div className="grid gap-3 sm:grid-cols-4">
                            {[
                              { label: 'Attention', value: attentionCount, color: 'text-rose-700', note: 'Blocked or overdue' },
                              { label: 'Due Soon', value: dueSoonCount, color: 'text-amber-800', note: 'Next 7 days' },
                              { label: 'Active', value: activeCount, color: 'text-[color:var(--ink)]', note: 'In progress' },
                              { label: 'Completed', value: completed, color: 'text-[color:var(--ink)]', note: 'Done items' },
                            ].map((stat) => (
                              <div key={stat.label} className="rounded-2xl bg-white/85 p-3">
                                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">{stat.label}</p>
                                <p className={`font-display text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
                                <p className="text-xs text-[color:var(--muted)]">{stat.note}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Key items */}
                        <div className="rounded-2xl border border-[color:var(--border)] bg-white/85">
                          <div className="border-b border-[color:var(--border)] px-4 py-3">
                            <h3 className="font-display text-lg font-semibold text-[color:var(--ink)]">Key Items</h3>
                            <p className="text-xs text-[color:var(--muted)]">Active items sorted by attention, due date, and priority.</p>
                          </div>
                          <div className="space-y-3 p-4">
                            <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                              <span>Item</span><span>Status</span><span>Owner</span><span>Due</span><span>Priority</span>
                            </div>
                            {keyItems.length === 0 ? (
                              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-soft)] p-4 text-sm text-[color:var(--muted)]">No key items found yet.</div>
                            ) : (
                              keyItems.map((item) => (
                                <ItemRow key={item.id} item={item} boardId={board.id} onStatusUpdate={refreshData} showDetails={false} />
                              ))
                            )}
                          </div>
                        </div>

                        {/* Full board list */}
                        <details className="rounded-2xl border border-[color:var(--border)] bg-white/70">
                          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[color:var(--ink)]">Full board list ({itemSummaries.length} items)</summary>
                          <div className="space-y-3 p-4">
                            <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                              <span>Item</span><span>Status</span><span>Owner</span><span>Due</span><span>Priority</span><span>Approval</span>
                            </div>
                            {sortedItems.map((item) => (
                              <ItemRow key={`all-${item.id}`} item={item} boardId={board.id} onStatusUpdate={refreshData} />
                            ))}
                          </div>
                        </details>
                      </>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function formatActivityTime(value: number) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
