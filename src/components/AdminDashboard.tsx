import { useState, useEffect } from 'react';
import mondaySdk from 'monday-sdk-js';
import { isAxiosError } from 'axios';
import { 
  Plus, 
  CheckCircle2, 
  Clock, 
  Search,
  Shield,
  Pencil,
  Trash2,
  X,
  ListChecks,
  MailPlus,
  Copy,
  CreditCard,
  FileQuestion,
  History,
  Palette,
  Rocket
} from 'lucide-react';
import adminApi from '../services/adminApi';

const monday = mondaySdk();

interface Client {
  id: number;
  name: string;
  email: string;
  portal_count: number;
  invite_status?: 'active' | 'pending' | 'expired';
  pending_invite_expires_at?: number | null;
}

type MondayContext = {
  boardId?: number | string;
  isViewOnly?: boolean;
};

type BoardItem = {
  id: string;
  name: string;
};

type BoardResponse = {
  board?: {
    id: string;
    name: string;
    items_page?: {
      items?: BoardItem[];
    };
  } | null;
};

type PermissionsResponse = {
  itemIds: string[];
};

type InviteDetails = {
  clientName: string;
  email: string;
  inviteUrl: string;
  expiresAt: number;
};

type BillingMetric = {
  metric: string;
  label: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
};

type BillingSummary = {
  status: string;
  active: boolean;
  plan: {
    code: string;
    label: string;
  };
  usage: {
    clients: BillingMetric;
    boards: BillingMetric;
    itemPermissions: BillingMetric;
    clientUpdatesMonthly: BillingMetric;
  };
};

type PortalSettings = {
  portalName: string;
  logoUrl: string;
  primaryColor: string;
  welcomeMessage: string;
  supportEmail: string;
};

type SetupStatus = {
  complete: boolean;
  steps: Array<{
    key: string;
    label: string;
    complete: boolean;
  }>;
  counts: {
    clients: number;
    portals: number;
    itemPermissions: number;
  };
};

type ActivityEvent = {
  id: number;
  clientId?: number | null;
  boardId?: string | null;
  itemId?: string | null;
  eventType: string;
  actorType: string;
  actorName: string;
  summary: string;
  createdAt: number;
};

type FileRequest = {
  id: number;
  clientId: number;
  boardId: string;
  itemId: string;
  title: string;
  instructions: string;
  dueAt?: number | null;
  status: 'open' | 'submitted' | 'closed';
  responseLinks?: string[];
  responseNote?: string;
  createdAt: number;
  updatedAt: number;
};

type FileRequestForm = {
  boardId: string;
  itemId: string;
  title: string;
  instructions: string;
  dueAt: string;
};

const defaultPortalSettings: PortalSettings = {
  portalName: 'Client Approval Portal',
  logoUrl: '',
  primaryColor: '#0073ea',
  welcomeMessage: 'Review approvals, files, decisions, and project updates in one secure client room.',
  supportEmail: '',
};

const getApiError = (err: unknown, fallback: string) =>
  isAxiosError<{ error?: string }>(err)
    ? err.response?.data?.error || err.message || fallback
    : fallback;

export default function AdminDashboard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [portalSettings, setPortalSettings] = useState<PortalSettings>(defaultPortalSettings);
  const [brandingForm, setBrandingForm] = useState<PortalSettings>(defaultPortalSettings);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);
  const [fileRequests, setFileRequests] = useState<FileRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [context, setContext] = useState<MondayContext | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permissionClient, setPermissionClient] = useState<Client | null>(null);
  const [permissionItems, setPermissionItems] = useState<BoardItem[]>([]);
  const [permissionItemIds, setPermissionItemIds] = useState<Set<string>>(new Set());
  const [restrictItems, setRestrictItems] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [savingBranding, setSavingBranding] = useState(false);
  const [fileRequestClient, setFileRequestClient] = useState<Client | null>(null);
  const [fileRequestForm, setFileRequestForm] = useState<FileRequestForm>({
    boardId: '',
    itemId: '',
    title: '',
    instructions: '',
    dueAt: '',
  });
  const [fileRequestSubmitting, setFileRequestSubmitting] = useState(false);

  useEffect(() => {
    // Get context from Monday
    monday.get('context').then((res) => {
      const nextContext = res.data as MondayContext;
      setContext(nextContext);
      if (nextContext.isViewOnly) {
        setError('As a viewer, you are unable to use the client portal manager.');
        setLoading(false);
        return;
      }
      fetchClients();
    }).catch(() => {
      fetchClients();
    });
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await adminApi.get('/monday/clients');
      setClients(response.data.clients || []);
      setBilling(response.data.billing || null);
      const settings = response.data.portalSettings || defaultPortalSettings;
      setPortalSettings(settings);
      setBrandingForm(settings);
      setSetup(response.data.setup || null);
      setRecentActivity(response.data.recentActivity || []);
      setFileRequests(response.data.fileRequests || []);
    } catch (err: unknown) {
      console.error('Error fetching clients:', err);
      setError(getApiError(err, 'Failed to load clients. Please check if the backend is running.'));
    } finally {
      setLoading(false);
    }
  };

  const saveBranding = async () => {
    if (context?.isViewOnly) {
      monday.execute('notice', { message: 'As a viewer, you are unable to change portal branding.', type: 'warn' });
      return;
    }

    try {
      setSavingBranding(true);
      const response = await adminApi.put('/monday/admin/settings', brandingForm);
      setPortalSettings(response.data.portalSettings || brandingForm);
      setBrandingForm(response.data.portalSettings || brandingForm);
      setSetup(response.data.setup || setup);
      monday.execute('notice', { message: 'Portal branding saved.', type: 'success' });
    } catch (err: unknown) {
      monday.execute('notice', { message: getApiError(err, 'Failed to save portal branding'), type: 'error' });
    } finally {
      setSavingBranding(false);
    }
  };

  const openFileRequest = (client: Client) => {
    if (context?.isViewOnly) {
      monday.execute('notice', { message: 'As a viewer, you are unable to request files.', type: 'warn' });
      return;
    }

    setFileRequestClient(client);
    setFileRequestForm({
      boardId: context?.boardId ? String(context.boardId) : '',
      itemId: '',
      title: '',
      instructions: '',
      dueAt: '',
    });
  };

  const submitFileRequest = async () => {
    if (!fileRequestClient) return;
    if (!fileRequestForm.boardId || !fileRequestForm.title.trim()) {
      monday.execute('notice', { message: 'Board ID and request title are required.', type: 'warn' });
      return;
    }

    try {
      setFileRequestSubmitting(true);
      await adminApi.post(`/monday/clients/${fileRequestClient.id}/file-requests`, {
        boardId: fileRequestForm.boardId,
        itemId: fileRequestForm.itemId || undefined,
        title: fileRequestForm.title,
        instructions: fileRequestForm.instructions,
        dueAt: fileRequestForm.dueAt || undefined,
      });
      monday.execute('notice', { message: 'File request sent.', type: 'success' });
      setFileRequestClient(null);
      fetchClients();
    } catch (err: unknown) {
      monday.execute('notice', { message: getApiError(err, 'Failed to create file request'), type: 'error' });
    } finally {
      setFileRequestSubmitting(false);
    }
  };

  const openPermissions = async (client: Client) => {
    if (context?.isViewOnly) {
      monday.execute('notice', { message: 'As a viewer, you are unable to manage item permissions.', type: 'warn' });
      return;
    }

    const boardId = context?.boardId;
    if (!boardId) {
      monday.execute('notice', { message: 'Open this view in a board to manage item permissions.', type: 'warn' });
      return;
    }

    try {
      setPermissionsLoading(true);
      setPermissionClient(client);
      const [boardResponse, permissionsResponse] = await Promise.all([
        adminApi.get<BoardResponse>(`/monday/admin/boards/${boardId}`),
        adminApi.get<PermissionsResponse>(`/monday/clients/${client.id}/permissions`, { params: { boardId } }),
      ]);

      const items = boardResponse.data.board?.items_page?.items || [];
      const selectedIds = new Set(permissionsResponse.data.itemIds.map(String));
      setPermissionItems(items);
      setPermissionItemIds(selectedIds);
      setRestrictItems(selectedIds.size > 0);
    } catch (err: unknown) {
      monday.execute('notice', { message: getApiError(err, 'Failed to load permissions'), type: 'error' });
      console.error('Error loading permissions:', err);
      setPermissionClient(null);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const togglePermissionItem = (itemId: string) => {
    setPermissionItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const savePermissions = async () => {
    const boardId = context?.boardId;
    if (!permissionClient || !boardId) return;
    if (context?.isViewOnly) {
      monday.execute('notice', { message: 'As a viewer, you are unable to save item permissions.', type: 'warn' });
      return;
    }

    try {
      setPermissionsSaving(true);
      await adminApi.put(`/monday/clients/${permissionClient.id}/permissions`, {
        boardId,
        itemIds: restrictItems ? Array.from(permissionItemIds) : [],
      });
      monday.execute('notice', { message: 'Permissions saved successfully!', type: 'success' });
      setPermissionClient(null);
    } catch (err: unknown) {
      monday.execute('notice', { message: getApiError(err, 'Failed to save permissions'), type: 'error' });
    } finally {
      setPermissionsSaving(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteDetails) return;
    await navigator.clipboard.writeText(inviteDetails.inviteUrl);
    monday.execute('notice', { message: 'Invite link copied', type: 'success' });
  };

  const createInvite = async (client: Client) => {
    if (context?.isViewOnly) {
      monday.execute('notice', { message: 'As a viewer, you are unable to create invites.', type: 'warn' });
      return;
    }

    try {
      const response = await adminApi.post(`/monday/clients/${client.id}/invite`);
      setInviteDetails({
        clientName: client.name,
        email: client.email,
        inviteUrl: response.data.invite.inviteUrl,
        expiresAt: response.data.invite.expiresAt,
      });
      fetchClients();
    } catch (err: unknown) {
      monday.execute('notice', { message: getApiError(err, 'Failed to create invite'), type: 'error' });
      console.error('Error creating invite:', err);
    }
  };

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f5f6f8] p-6 text-[#323338]">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-[#0073ea]" />
            <h1 className="text-2xl font-bold tracking-tight">Client Portal Manager</h1>
          </div>
          <p className="text-sm text-[#676879]">Manage client access and portal assignments</p>
        </div>
        <button 
          className="flex items-center gap-2 rounded-md bg-[#0073ea] px-4 py-2 text-sm font-medium text-white hover:bg-[#005fb8] transition-colors"
          disabled={context?.isViewOnly}
          onClick={() => {
            setEditingClient(null);
            setFormData({ name: '', email: '', password: '' });
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add New Client
        </button>
      </header>

      <div className="grid gap-6">
        {context?.isViewOnly && (
          <div className="rounded-lg border border-[#ffad00]/40 bg-[#fff4d6] px-4 py-3 text-sm text-[#6b4b00]">
            As a viewer, you are unable to create clients, assign boards, or change item permissions.
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
          <div className="rounded-lg border border-[#d0d4d9] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-[#0073ea]" />
                <div>
                  <h2 className="text-lg font-bold text-[#323338]">Setup Wizard</h2>
                  <p className="text-xs text-[#676879]">Launch checklist for a client-ready portal</p>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${setup?.complete ? 'bg-[#dcf8e6] text-[#007f4e]' : 'bg-[#fff4d6] text-[#9a6700]'}`}>
                {setup?.complete ? 'READY' : 'IN PROGRESS'}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(setup?.steps || []).map((step) => (
                <div key={step.key} className="flex items-center gap-3 rounded-md border border-[#d0d4d9] bg-[#f5f6f8] px-3 py-2">
                  <CheckCircle2 className={`h-4 w-4 ${step.complete ? 'text-[#00a25b]' : 'text-[#676879]'}`} />
                  <span className="text-sm font-medium text-[#323338]">{step.label}</span>
                </div>
              ))}
              {!setup && (
                <div className="text-sm text-[#676879]">Setup status will appear after the app loads account data.</div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[#d0d4d9] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Palette className="h-5 w-5 text-[#0073ea]" />
              <div>
                <h2 className="text-lg font-bold text-[#323338]">Client Portal Brand</h2>
                <p className="text-xs text-[#676879]">{portalSettings.portalName}</p>
              </div>
            </div>
            <div className="grid gap-3">
              <input
                value={brandingForm.portalName}
                onChange={(event) => setBrandingForm({ ...brandingForm, portalName: event.target.value })}
                placeholder="Portal name"
                className="rounded-md border border-[#d0d4d9] px-3 py-2 text-sm outline-none focus:border-[#0073ea]"
              />
              <textarea
                value={brandingForm.welcomeMessage}
                onChange={(event) => setBrandingForm({ ...brandingForm, welcomeMessage: event.target.value })}
                placeholder="Welcome message"
                rows={2}
                className="rounded-md border border-[#d0d4d9] px-3 py-2 text-sm outline-none focus:border-[#0073ea]"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="color"
                  value={brandingForm.primaryColor}
                  onChange={(event) => setBrandingForm({ ...brandingForm, primaryColor: event.target.value })}
                  className="h-10 rounded-md border border-[#d0d4d9] bg-white px-2"
                />
                <input
                  value={brandingForm.supportEmail}
                  onChange={(event) => setBrandingForm({ ...brandingForm, supportEmail: event.target.value })}
                  placeholder="Support email"
                  className="rounded-md border border-[#d0d4d9] px-3 py-2 text-sm outline-none focus:border-[#0073ea]"
                />
              </div>
              <input
                value={brandingForm.logoUrl}
                onChange={(event) => setBrandingForm({ ...brandingForm, logoUrl: event.target.value })}
                placeholder="Logo URL"
                className="rounded-md border border-[#d0d4d9] px-3 py-2 text-sm outline-none focus:border-[#0073ea]"
              />
              <button
                type="button"
                disabled={savingBranding || context?.isViewOnly}
                onClick={() => void saveBranding()}
                className="inline-flex items-center justify-center rounded-md bg-[#0073ea] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005fb8] disabled:opacity-50"
              >
                {savingBranding ? 'Saving...' : 'Save Branding'}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-lg border border-[#d0d4d9] shadow-sm">
            <p className="text-xs uppercase font-bold text-[#676879] mb-1">Total Clients</p>
            <p className="text-3xl font-bold">{clients.length}</p>
          </div>
          <div className="bg-white p-5 rounded-lg border border-[#d0d4d9] shadow-sm">
            <p className="text-xs uppercase font-bold text-[#676879] mb-1">Active Portals</p>
            <p className="text-3xl font-bold text-[#00ca72]">
              {clients.reduce((acc, c) => acc + c.portal_count, 0)}
            </p>
          </div>
          <div className="bg-white p-5 rounded-lg border border-[#d0d4d9] shadow-sm">
            <p className="text-xs uppercase font-bold text-[#676879] mb-1">Plan</p>
            <p className="text-2xl font-bold text-[#323338]">{billing?.plan.label || '-'}</p>
            <p className={`text-xs font-semibold ${billing?.active === false ? 'text-red-600' : 'text-[#00a25b]'}`}>
              {billing?.status || 'active'}
            </p>
          </div>
          <div className="bg-white p-5 rounded-lg border border-[#d0d4d9] shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-[#0073ea]" />
              <p className="text-xs uppercase font-bold text-[#676879]">Monthly Comments</p>
            </div>
            <p className="text-2xl font-bold text-[#323338]">
              {billing ? formatUsage(billing.usage.clientUpdatesMonthly) : '-'}
            </p>
            <p className="text-xs text-[#676879]">Client-posted updates</p>
            <button
              type="button"
              className="mt-3 rounded-md border border-[#d0d4d9] px-3 py-1.5 text-xs font-semibold text-[#323338] hover:border-[#0073ea] hover:text-[#0073ea]"
              onClick={() => monday.execute('openPlanSelection', {})}
            >
              Manage monday plan
            </button>
          </div>
        </div>

        {billing && (
          <div className="grid gap-3 rounded-lg border border-[#d0d4d9] bg-white p-4 shadow-sm md:grid-cols-4">
            {[
              billing.usage.clients,
              billing.usage.boards,
              billing.usage.itemPermissions,
              billing.usage.clientUpdatesMonthly,
            ].map((metric) => (
              <div key={metric.metric}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase text-[#676879]">{metric.label}</p>
                  <p className="text-xs font-semibold text-[#323338]">{formatUsage(metric)}</p>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[#f5f6f8]">
                  <div
                    className="h-2 rounded-full bg-[#0073ea]"
                    style={{ width: `${getUsagePercent(metric)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[#d0d4d9] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-[#0073ea]" />
              <h2 className="text-base font-bold text-[#323338]">Recent Activity</h2>
            </div>
            <div className="space-y-2">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-[#676879]">No client-room activity yet.</p>
              ) : (
                recentActivity.slice(0, 6).map((event) => (
                  <div key={event.id} className="rounded-md border border-[#d0d4d9] bg-[#f5f6f8] px-3 py-2">
                    <p className="text-sm font-semibold text-[#323338]">{event.summary}</p>
                    <p className="text-xs text-[#676879]">{formatTimestamp(event.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[#d0d4d9] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <FileQuestion className="h-4 w-4 text-[#0073ea]" />
              <h2 className="text-base font-bold text-[#323338]">File Requests</h2>
            </div>
            <div className="space-y-2">
              {fileRequests.length === 0 ? (
                <p className="text-sm text-[#676879]">No file requests yet.</p>
              ) : (
                fileRequests.slice(0, 6).map((request) => (
                  <div key={request.id} className="rounded-md border border-[#d0d4d9] bg-[#f5f6f8] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#323338]">{request.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${request.status === 'open' ? 'bg-[#fff4d6] text-[#9a6700]' : 'bg-[#dcf8e6] text-[#007f4e]'}`}>
                        {request.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-[#676879]">Board {request.boardId}{request.itemId ? `, item ${request.itemId}` : ''}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-[#d0d4d9] shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#676879]" />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              className="w-full pl-10 pr-4 py-2 bg-[#f5f6f8] border-none rounded-md text-sm focus:ring-2 focus:ring-[#0073ea] outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Client Table */}
        <div className="bg-white rounded-lg border border-[#d0d4d9] shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f5f6f8] text-[#676879] text-xs uppercase font-bold border-b border-[#d0d4d9]">
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Portals</th>
                <th className="px-6 py-3">Permissions</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d0d4d9]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-[#676879]">
                    <Clock className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading clients...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-red-500 text-sm">
                    {error}
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-[#676879] text-sm">
                    No clients found.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-[#f5f6f8]/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-[#0073ea]/10 flex items-center justify-center text-[#0073ea] font-bold">
                          {client.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{client.name}</p>
                          <p className="text-xs text-[#676879]">{client.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {client.invite_status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#fff4d6] text-[#9a6700] text-[10px] font-bold border border-[#ffad00]/30">
                          <Clock className="h-3 w-3" />
                          INVITED
                        </span>
                      ) : client.invite_status === 'expired' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-bold border border-red-200">
                          <Clock className="h-3 w-3" />
                          EXPIRED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#cce5ff] text-[#0073ea] text-[10px] font-bold border border-[#0073ea]/20">
                          <CheckCircle2 className="h-3 w-3" />
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium">{client.portal_count}</span>
                        <span className="text-xs text-[#676879]">boards</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        <span className="text-[10px] bg-[#f5f6f8] px-1.5 py-0.5 rounded border border-[#d0d4d9]">VIEW</span>
                        <span className="text-[10px] bg-[#f5f6f8] px-1.5 py-0.5 rounded border border-[#d0d4d9]">AUTH</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            if (context?.isViewOnly) return;
                            setEditingClient(client);
                            setFormData({ name: client.name, email: client.email, password: '' });
                            setIsModalOpen(true);
                          }}
                          disabled={context?.isViewOnly}
                          className="p-1.5 text-[#676879] hover:text-[#0073ea] transition-colors"
                          title="Edit Client"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={async () => {
                            if (context?.isViewOnly) return;
                            if (!window.confirm('Are you sure you want to delete this client? All standard portal assignments will be removed.')) return;
                            try {
                              await adminApi.delete(`/monday/clients/${client.id}`);
                              monday.execute('notice', { message: 'Client deleted successfully!', type: 'success' });
                              fetchClients();
                            } catch (err: unknown) {
                              monday.execute('notice', { message: getApiError(err, 'Failed to delete client'), type: 'error' });
                              console.error('Error deleting client:', err);
                            }
                          }}
                          disabled={context?.isViewOnly}
                          className="p-1.5 text-[#676879] hover:text-red-500 transition-colors"
                          title="Delete Client"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button 
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#d0d4d9] rounded hover:border-[#0073ea] hover:text-[#0073ea] transition-all text-xs font-medium"
                          disabled={context?.isViewOnly}
                          onClick={() => {
                            if (context?.isViewOnly) return;
                            if (context?.boardId) {
                               adminApi.post('/monday/admin/assign', { clientId: client.id, boardId: context.boardId })
                                .then(() => {
                                  monday.execute('notice', { message: `Board successfully assigned to ${client.name}!`, type: 'success' });
                                  fetchClients();
                                })
                                .catch((err: unknown) => {
                                  monday.execute('notice', { message: getApiError(err, 'Failed to assign board'), type: 'error' });
                                  console.error('Error assigning board:', err);
                                });
                            } else {
                              monday.execute('notice', { message: 'Open this view in a board to assign it!', type: 'warn' });
                            }
                          }}
                        >
                          <Plus className="h-3 w-3" />
                          Assign Board
                        </button>
                        <button
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#d0d4d9] rounded hover:border-[#0073ea] hover:text-[#0073ea] transition-all text-xs font-medium"
                          disabled={context?.isViewOnly}
                          onClick={() => void openPermissions(client)}
                        >
                          <ListChecks className="h-3 w-3" />
                          Items
                        </button>
                        <button
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#d0d4d9] rounded hover:border-[#0073ea] hover:text-[#0073ea] transition-all text-xs font-medium"
                          disabled={context?.isViewOnly}
                          onClick={() => void createInvite(client)}
                        >
                          <MailPlus className="h-3 w-3" />
                          Invite
                        </button>
                        <button
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#d0d4d9] rounded hover:border-[#0073ea] hover:text-[#0073ea] transition-all text-xs font-medium"
                          disabled={context?.isViewOnly}
                          onClick={() => openFileRequest(client)}
                        >
                          <FileQuestion className="h-3 w-3" />
                          Request Files
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-[#d0d4d9]">
              <h2 className="text-xl font-bold text-[#323338]">
                {editingClient ? 'Edit Client' : 'Create New Client'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[#676879] hover:text-[#323338]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setIsSubmitting(true);
                if (editingClient) {
                  await adminApi.put(`/monday/clients/${editingClient.id}`, formData);
                  monday.execute('notice', { message: 'Client updated successfully!', type: 'success' });
                } else {
                  const response = await adminApi.post('/monday/clients', {
                    ...formData,
                    password: formData.password || undefined,
                  });
                  if (response.data.invite?.inviteUrl) {
                    setInviteDetails({
                      clientName: formData.name,
                      email: formData.email,
                      inviteUrl: response.data.invite.inviteUrl,
                      expiresAt: response.data.invite.expiresAt,
                    });
                  }
                  monday.execute('notice', { message: 'Client created successfully!', type: 'success' });
                }
                setIsModalOpen(false);
                fetchClients();
              } catch (err: unknown) {
                const msg = getApiError(err, 'Failed to save client');
                monday.execute('notice', { message: msg, type: 'error' });
              } finally {
                setIsSubmitting(false);
              }
            }} className="p-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#323338] mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-[#d0d4d9] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#0073ea] focus:border-[#0073ea]"
                    placeholder="e.g. Acme Corp"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#323338] mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-[#d0d4d9] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#0073ea] focus:border-[#0073ea]"
                    placeholder="e.g. contact@acme.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#323338] mb-1">
                    Password {editingClient ? <span className="text-[#676879]">(Leave blank to keep current)</span> : <span className="text-[#676879]">(Optional)</span>}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-[#d0d4d9] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#0073ea] focus:border-[#0073ea]"
                    placeholder={editingClient ? "Leave blank to ignore" : "Leave blank to generate invite"}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium border border-[#d0d4d9] rounded-md text-[#323338] hover:bg-[#f5f6f8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-[#0073ea] text-white hover:bg-[#005fb8] disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {inviteDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-[#d0d4d9]">
              <div>
                <h2 className="text-xl font-bold text-[#323338]">Client Invite</h2>
                <p className="text-sm text-[#676879]">{inviteDetails.clientName} - {inviteDetails.email}</p>
              </div>
              <button onClick={() => setInviteDetails(null)} className="text-[#676879] hover:text-[#323338]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <div className="rounded-md border border-[#d0d4d9] bg-[#f5f6f8] p-3 text-sm break-all text-[#323338]">
                {inviteDetails.inviteUrl}
              </div>
              <p className="mt-2 text-xs text-[#676879]">
                Expires {new Date(inviteDetails.expiresAt).toLocaleString()}
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setInviteDetails(null)}
                  className="px-4 py-2 text-sm font-medium border border-[#d0d4d9] rounded-md text-[#323338] hover:bg-[#f5f6f8]"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void copyInviteLink()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-[#0073ea] text-white hover:bg-[#005fb8]"
                >
                  <Copy className="h-4 w-4" />
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {fileRequestClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-[#d0d4d9]">
              <div>
                <h2 className="text-xl font-bold text-[#323338]">Request Files</h2>
                <p className="text-sm text-[#676879]">{fileRequestClient.name}</p>
              </div>
              <button onClick={() => setFileRequestClient(null)} className="text-[#676879] hover:text-[#323338]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#323338]">Board ID</label>
                <input
                  value={fileRequestForm.boardId}
                  onChange={(event) => setFileRequestForm({ ...fileRequestForm, boardId: event.target.value })}
                  className="w-full rounded-md border border-[#d0d4d9] px-3 py-2 text-sm outline-none focus:border-[#0073ea]"
                  placeholder="Open this app from a board to auto-fill"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#323338]">Item ID <span className="text-[#676879]">(optional)</span></label>
                <input
                  value={fileRequestForm.itemId}
                  onChange={(event) => setFileRequestForm({ ...fileRequestForm, itemId: event.target.value })}
                  className="w-full rounded-md border border-[#d0d4d9] px-3 py-2 text-sm outline-none focus:border-[#0073ea]"
                  placeholder="Attach request to a specific item"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#323338]">Request Title</label>
                <input
                  value={fileRequestForm.title}
                  onChange={(event) => setFileRequestForm({ ...fileRequestForm, title: event.target.value })}
                  className="w-full rounded-md border border-[#d0d4d9] px-3 py-2 text-sm outline-none focus:border-[#0073ea]"
                  placeholder="e.g. Upload signed agreement"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#323338]">Due Date</label>
                <input
                  type="date"
                  value={fileRequestForm.dueAt}
                  onChange={(event) => setFileRequestForm({ ...fileRequestForm, dueAt: event.target.value })}
                  className="w-full rounded-md border border-[#d0d4d9] px-3 py-2 text-sm outline-none focus:border-[#0073ea]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#323338]">Instructions</label>
                <textarea
                  value={fileRequestForm.instructions}
                  onChange={(event) => setFileRequestForm({ ...fileRequestForm, instructions: event.target.value })}
                  rows={4}
                  className="w-full rounded-md border border-[#d0d4d9] px-3 py-2 text-sm outline-none focus:border-[#0073ea]"
                  placeholder="Tell the client what to provide and where links should point."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFileRequestClient(null)}
                  className="px-4 py-2 text-sm font-medium border border-[#d0d4d9] rounded-md text-[#323338] hover:bg-[#f5f6f8]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={fileRequestSubmitting}
                  onClick={() => void submitFileRequest()}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-[#0073ea] text-white hover:bg-[#005fb8] disabled:opacity-50"
                >
                  {fileRequestSubmitting ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {permissionClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-[#d0d4d9]">
              <div>
                <h2 className="text-xl font-bold text-[#323338]">Item Permissions</h2>
                <p className="text-sm text-[#676879]">{permissionClient.name}</p>
              </div>
              <button onClick={() => setPermissionClient(null)} className="text-[#676879] hover:text-[#323338]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              {permissionsLoading ? (
                <div className="py-10 text-center text-[#676879]">
                  <Clock className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading board items...
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="flex items-start gap-3 rounded-md border border-[#d0d4d9] p-3">
                    <input
                      type="checkbox"
                      checked={restrictItems}
                      onChange={(event) => setRestrictItems(event.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-[#323338]">Restrict this client to selected items</span>
                      <span className="block text-xs text-[#676879]">Leave off to share every item on the assigned board.</span>
                    </span>
                  </label>

                  <div className="max-h-80 overflow-auto rounded-md border border-[#d0d4d9]">
                    {permissionItems.length === 0 ? (
                      <div className="p-5 text-sm text-[#676879]">No items found on this board.</div>
                    ) : (
                      permissionItems.map((item) => (
                        <label key={item.id} className="flex items-center gap-3 border-b border-[#d0d4d9] px-4 py-3 last:border-b-0">
                          <input
                            type="checkbox"
                            checked={permissionItemIds.has(String(item.id))}
                            disabled={!restrictItems}
                            onChange={() => togglePermissionItem(String(item.id))}
                          />
                          <span>
                            <span className="block text-sm font-medium text-[#323338]">{item.name}</span>
                            <span className="block text-xs text-[#676879]">Item #{item.id}</span>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPermissionClient(null)}
                  className="px-4 py-2 text-sm font-medium border border-[#d0d4d9] rounded-md text-[#323338] hover:bg-[#f5f6f8]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={permissionsSaving || permissionsLoading}
                  onClick={() => void savePermissions()}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-[#0073ea] text-white hover:bg-[#005fb8] disabled:opacity-50"
                >
                  {permissionsSaving ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatUsage(metric: BillingMetric) {
  return metric.unlimited || metric.limit === null ? `${metric.used}/unlimited` : `${metric.used}/${metric.limit}`;
}

function getUsagePercent(metric: BillingMetric) {
  if (metric.unlimited || metric.limit === null || metric.limit <= 0) return 0;
  return Math.min(Math.round((metric.used / metric.limit) * 100), 100);
}

function formatTimestamp(value: number) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
