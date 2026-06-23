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
  ListChecks
} from 'lucide-react';
import adminApi from '../services/adminApi';

const monday = mondaySdk();

interface Client {
  id: number;
  name: string;
  email: string;
  portal_count: number;
}

type MondayContext = {
  boardId?: number | string;
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

const getApiError = (err: unknown, fallback: string) =>
  isAxiosError<{ error?: string }>(err) ? err.response?.data?.error || fallback : fallback;

export default function AdminDashboard() {
  const [clients, setClients] = useState<Client[]>([]);
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

  useEffect(() => {
    // Get context from Monday
    monday.get('context').then((res) => {
      setContext(res.data as MondayContext);
    });

    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await adminApi.get('/monday/clients');
      setClients(response.data.clients || []);
    } catch (err: unknown) {
      console.error('Error fetching clients:', err);
      setError(getApiError(err, 'Failed to load clients. Please check if the backend is running.'));
    } finally {
      setLoading(false);
    }
  };

  const openPermissions = async (client: Client) => {
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
        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <p className="text-xs uppercase font-bold text-[#676879] mb-1">Pending Syncs</p>
            <p className="text-3xl font-bold text-[#ffad00]">0</p>
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
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#cce5ff] text-[#0073ea] text-[10px] font-bold border border-[#0073ea]/20">
                        <CheckCircle2 className="h-3 w-3" />
                        ACTIVE
                      </span>
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
                            setEditingClient(client);
                            setFormData({ name: client.name, email: client.email, password: '' });
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-[#676879] hover:text-[#0073ea] transition-colors"
                          title="Edit Client"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={async () => {
                            if (!window.confirm('Are you sure you want to delete this client? All standard portal assignments will be removed.')) return;
                            try {
                              await adminApi.delete(`/monday/clients/${client.id}`);
                              monday.execute('notice', { message: 'Client deleted successfully!', type: 'success' });
                              fetchClients();
                            } catch (err: unknown) {
                              monday.execute('notice', { message: getApiError(err, 'Failed to delete client'), type: 'error' });
                            }
                          }}
                          className="p-1.5 text-[#676879] hover:text-red-500 transition-colors"
                          title="Delete Client"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button 
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#d0d4d9] rounded hover:border-[#0073ea] hover:text-[#0073ea] transition-all text-xs font-medium"
                          onClick={() => {
                            if (context?.boardId) {
                               adminApi.post('/monday/admin/assign', { clientId: client.id, boardId: context.boardId })
                                .then(() => {
                                  monday.execute('notice', { message: `Board successfully assigned to ${client.name}!`, type: 'success' });
                                  fetchClients();
                                })
                                .catch((err: unknown) => {
                                  monday.execute('notice', { message: getApiError(err, 'Failed to assign board'), type: 'error' });
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
                          onClick={() => void openPermissions(client)}
                        >
                          <ListChecks className="h-3 w-3" />
                          Items
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
                  await adminApi.post('/monday/clients', formData);
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
                    Password {editingClient && <span className="text-[#676879]">(Leave blank to keep current)</span>}
                  </label>
                  <input
                    type="password"
                    required={!editingClient}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-[#d0d4d9] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#0073ea] focus:border-[#0073ea]"
                    placeholder={editingClient ? "Leave blank to ignore" : "Enter password"}
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
