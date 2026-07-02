// ============================================================
// Monday.com column & status helper utilities
// Extracted from Dashboard.tsx for maintainability
// ============================================================

export type ColumnValue = {
  id: string;
  title?: string;
  text?: string;
  value?: string;
  type?: string;
  files?: FileAttachment[];
};

export type PortalSettings = {
  portalName: string;
  logoUrl: string;
  primaryColor: string;
  welcomeMessage: string;
  supportEmail: string;
};

export type ClientActivityEvent = {
  id: number;
  clientId?: number | null;
  boardId?: string | null;
  itemId?: string | null;
  eventType: string;
  actorType: string;
  actorName: string;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
};

export type ItemApproval = {
  id?: number;
  status: 'pending' | 'approved' | 'changes_requested';
  reason?: string;
  decidedAt?: number | null;
  updatedAt?: number | null;
};

export type ClientFileRequest = {
  id: number;
  clientId: number;
  boardId: string;
  itemId: string;
  title: string;
  instructions: string;
  dueAt?: number | null;
  status: 'open' | 'submitted' | 'closed';
  requestedBy?: string;
  responseNote?: string;
  responseLinks?: string[];
  respondedAt?: number | null;
  createdAt: number;
  updatedAt: number;
};

export type ClientPortalMeta = {
  approval: ItemApproval;
  fileRequests: ClientFileRequest[];
  activity: ClientActivityEvent[];
};

export type Item = {
  id: string;
  name: string;
  column_values?: ColumnValue[];
  client_portal?: ClientPortalMeta;
};

export type ItemWithStatus = Item & {
  statusLabel: string;
};

export type ItemSummary = ItemWithStatus & {
  columns: ColumnValue[];
  files: FileAttachment[];
  owner: string;
  priority: string;
  priorityWeight: number;
  dueLabel: string;
  dueDate: Date | null;
  dueSoon: boolean;
  overdue: boolean;
  attention: boolean;
  statusColumnId?: string;
  clientPortal?: ClientPortalMeta;
};

export type Board = {
  id: string;
  name: string;
  items_page?: {
    items?: Item[];
  };
};

export type FileAttachment = {
  id: string;
  name: string;
  url: string;
  public_url?: string;
  url_thumbnail?: string;
  file_size?: number | null;
  uploaded_at?: string | null;
};

export type ItemUpdate = {
  id: string;
  body: string;
  created_at?: string | null;
  creator?: {
    id?: string;
    name?: string;
  } | null;
  assets?: FileAttachment[];
};

// ── Status keyword sets ──────────────────────────────────────

const STATUS_DONE = ['done', 'completed', 'complete', 'closed'];
const STATUS_PROGRESS = ['working', 'progress', 'in progress', 'doing', 'active'];
const STATUS_BLOCKED = ['stuck', 'blocked', 'risk'];
const STATUS_REVIEW = ['review', 'qa', 'approval'];

const OWNER_KEYWORDS = ['owner', 'assignee', 'person', 'people', 'lead'];
const DUE_KEYWORDS = ['due', 'date', 'deadline', 'timeline', 'eta'];
const PRIORITY_KEYWORDS = ['priority', 'impact', 'severity'];

// ── Helpers ──────────────────────────────────────────────────

export const normalize = (value?: string) => (value || '').toLowerCase().trim();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getString = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '';

const getNamedList = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((entry) => (isRecord(entry) ? getString(entry.name) : ''))
        .filter(Boolean)
        .join(', ')
    : '';

export const getStatusColumn = (item: Item) =>
  item.column_values?.find((col) => {
    const title = normalize(col.title);
    return col.type === 'status' || col.id === 'status' || title === 'status';
  });

export const getStatusLabel = (item: Item) => {
  const statusColumn = getStatusColumn(item);
  const text = statusColumn?.text?.trim();
  return text && text.length > 0 ? text : 'No Status';
};

export const isDoneStatus = (status: string) =>
  STATUS_DONE.some((key) => normalize(status).includes(key));

export const isBlockedStatus = (status: string) =>
  STATUS_BLOCKED.some((key) => normalize(status).includes(key));

export const getStatusTone = (status: string) => {
  const value = normalize(status);
  if (STATUS_DONE.some((key) => value.includes(key)))
    return 'bg-emerald-100 text-emerald-800 ring-emerald-200';
  if (STATUS_BLOCKED.some((key) => value.includes(key)))
    return 'bg-rose-100 text-rose-800 ring-rose-200';
  if (STATUS_REVIEW.some((key) => value.includes(key)))
    return 'bg-sky-100 text-sky-800 ring-sky-200';
  if (STATUS_PROGRESS.some((key) => value.includes(key)))
    return 'bg-amber-100 text-amber-900 ring-amber-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
};

export const getColumnValue = (column: ColumnValue) => {
  const text = column.text?.trim();
  if (text) return text;
  const raw = column.value;
  if (!raw || raw === 'null') return '-';
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'string' || typeof parsed === 'number' || typeof parsed === 'boolean')
      return String(parsed);
    if (!isRecord(parsed)) return raw;

    const label = parsed.label;
    if (isRecord(label) && getString(label.text)) return getString(label.text);
    if (getString(parsed.text)) return getString(parsed.text);
    if (getString(parsed.email)) return getString(parsed.email);
    if (getString(parsed.phone)) return getString(parsed.phone);
    if (getString(parsed.url)) return getString(parsed.url);
    if (getString(parsed.date)) return getString(parsed.date);
    if (getString(parsed.from) && getString(parsed.to)) return `${getString(parsed.from)} to ${getString(parsed.to)}`;

    const personsAndTeams = getNamedList(parsed.personsAndTeams);
    if (personsAndTeams) return personsAndTeams;
    const people = getNamedList(parsed.people);
    if (people) return people;

    return JSON.stringify(parsed);
  } catch {
    return raw;
  }
};

export const findColumn = (columns: ColumnValue[], keywords: string[], types: string[] = []) =>
  columns.find((col) => {
    const title = normalize(col.title);
    const id = normalize(col.id);
    const keywordMatch = keywords.some((kw) => title.includes(kw) || id.includes(kw));
    const typeMatch = col.type ? types.includes(col.type) : false;
    return keywordMatch || typeMatch;
  });

export const getFilesFromColumn = (column: ColumnValue): FileAttachment[] => {
  if (column.type !== 'file') return [];

  if (Array.isArray(column.files) && column.files.length > 0) {
    return column.files
      .map((file) => ({
        ...file,
        url: file.public_url || file.url,
        name: file.name || 'Untitled File',
      }))
      .filter((file) => Boolean(file.url));
  }

  if (!column.value) return [];

  try {
    const parsed: unknown = JSON.parse(column.value);
    if (isRecord(parsed) && Array.isArray(parsed.files)) {
      return parsed.files
        .filter(isRecord)
        .map((file) => ({
          name: getString(file.name) || 'Untitled File',
          url: getString(file.url) || getString(file.public_url) || '#',
          public_url: getString(file.public_url),
          url_thumbnail: getString(file.url_thumbnail),
          file_size: Number(file.file_size) || null,
          uploaded_at: getString(file.uploaded_at) || null,
          id: getString(file.id) || getString(file.assetId) || getString(file.name) || 'file',
        }));
    }
  } catch (e) {
    console.warn('Failed to parse file column', e);
  }
  return [];
};

export const getItemFiles = (item: Item) =>
  (item.column_values || []).flatMap((column) => getFilesFromColumn(column));

const getDateValue = (column?: ColumnValue) => {
  if (!column?.value) return null;
  try {
    const parsed: unknown = JSON.parse(column.value);
    if (!isRecord(parsed)) return null;
    if (getString(parsed.date)) return getString(parsed.date);
    if (getString(parsed.from) || getString(parsed.to)) return getString(parsed.to) || getString(parsed.from);
  } catch {
    return null;
  }
  return null;
};

const parseDateValue = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateLabel = (date: Date) => {
  const now = new Date();
  const includeYear = date.getFullYear() !== now.getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: includeYear ? 'numeric' : undefined,
  });
};

const getDueMeta = (column?: ColumnValue) => {
  if (!column)
    return { date: null, label: '-', isOverdue: false, isDueSoon: false, daysUntil: null as number | null };
  const rawDate = getDateValue(column) || column.text || null;
  const date = parseDateValue(rawDate);
  const label = date ? formatDateLabel(date) : getColumnValue(column);
  if (!date)
    return { date: null, label, isOverdue: false, isDueSoon: false, daysUntil: null as number | null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / 86400000);
  return { date, label, daysUntil: diffDays, isOverdue: diffDays < 0, isDueSoon: diffDays >= 0 && diffDays <= 7 };
};

const getPriorityWeight = (value: string) => {
  const n = normalize(value);
  if (n.includes('critical') || n.includes('urgent')) return 4;
  if (n.includes('high')) return 3;
  if (n.includes('medium')) return 2;
  if (n.includes('low')) return 1;
  return 0;
};

const withFallback = (value: string, fallback: string) => (value === '-' ? fallback : value);

// ── Item summary builder ─────────────────────────────────────

export const buildItemSummary = (item: ItemWithStatus): ItemSummary => {
  const columns = item.column_values || [];
  const files = getItemFiles(item);
  const ownerColumn = findColumn(columns, OWNER_KEYWORDS, ['people', 'person', 'team']);
  const dueColumn = findColumn(columns, DUE_KEYWORDS, ['date', 'timeline']);
  const priorityColumn = findColumn(columns, PRIORITY_KEYWORDS);
  const ownerRaw = ownerColumn ? getColumnValue(ownerColumn) : '-';
  const priorityRaw = priorityColumn ? getColumnValue(priorityColumn) : '-';
  const owner = withFallback(ownerRaw, 'Unassigned');
  const priority = withFallback(priorityRaw, 'Not set');
  const priorityWeight = getPriorityWeight(priorityRaw);
  const dueMeta = getDueMeta(dueColumn);
  const dueLabel = withFallback(dueMeta.label, 'No due date');
  const attention = isBlockedStatus(item.statusLabel) || dueMeta.isOverdue;
  const statusColumn = getStatusColumn(item);

  return {
    ...item,
    columns,
    files,
    owner,
    priority,
    priorityWeight,
    dueLabel,
    dueDate: dueMeta.date,
    dueSoon: dueMeta.isDueSoon,
    overdue: dueMeta.isOverdue,
    attention,
    statusColumnId: statusColumn?.id,
    clientPortal: item.client_portal,
  };
};

// ── Sort comparator ──────────────────────────────────────────

export const compareItemsByFocus = (a: ItemSummary, b: ItemSummary) => {
  if (a.attention !== b.attention) return a.attention ? -1 : 1;
  if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  if (a.priorityWeight !== b.priorityWeight) return b.priorityWeight - a.priorityWeight;
  return a.name.localeCompare(b.name);
};
