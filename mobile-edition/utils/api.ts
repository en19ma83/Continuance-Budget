import { storage } from './storage';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const [baseUrl, token] = await Promise.all([
    storage.getBackendUrl(),
    storage.getToken(),
  ]);

  if (!baseUrl) throw new ApiError(0, 'No backend URL configured');

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    let detail = body?.detail ?? `HTTP ${res.status}`;
    
    // Handle FastAPI validation error arrays or complex objects
    if (typeof detail !== 'string') {
      try {
        detail = JSON.stringify(detail, (key, value) => 
          typeof value === 'object' && value !== null && !Array.isArray(value) 
            ? Object.assign({}, value) // help with non-serializable objects if any
            : value
        , 2);
      } catch {
        detail = String(detail);
      }
    }
    
    throw new ApiError(res.status, detail);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: <T>(path: string, body: Record<string, string>) => {
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      formData.append(key, value);
    }
    return request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
  },
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    api.postForm<{ access_token: string }>('/api/auth/login', { username, password }),
  register: (username: string, password: string) =>
    api.post<{ id: string; username: string }>('/api/auth/register', { username, password }),
  me: () => api.get<{ id: string; username: string }>('/api/auth/me'),
};

// Stats
export const statsApi = {
  v2: (entities?: string) => {
    const query = entities || 'entities=PERSONAL&entities=BUSINESS';
    return api.get<{
      on_budget_balance: number;
      off_budget_balance: number;
      total_assets: number;
      total_liabilities: number;
      net_worth: number;
      base_currency: string;
    }>(`/api/v2/stats?${query}`);
  },
};

// Ledger
export interface LedgerEntry {
  id: string;
  date: string;
  name: string;
  amount: number;
  status: 'PROJECTED' | 'ACTUAL' | 'PENDING';
  running_balance: number;
  liquid_balance: number;
  cc_balance: number;
  currency: string;
  category_id: string | null;
  account_id: string | null;
  rule_id: string | null;
}

export const ledgerApi = {
  list: (entities?: string) => {
    const query = entities || 'entities=PERSONAL&entities=BUSINESS';
    return api.get<LedgerEntry[]>(`/api/ledger?${query}`);
  },
  createTransaction: (data: {
    date: string;
    name: string;
    amount: number;
    account_id: string;
    category_id?: string;
  }) => api.post<LedgerEntry>('/api/transactions', data),
};

// Accounts
export interface Account {
  id: string;
  name: string;
  type: string;
  entity: 'PERSONAL' | 'BUSINESS';
  is_on_budget: boolean;
  starting_balance: number;
  currency: string;
  is_charge_card: boolean;
}

export const accountsApi = {
  list: (entities?: string) => {
    const query = entities || 'entities=PERSONAL&entities=BUSINESS';
    return api.get<Account[]>(`/api/accounts?${query}`);
  },
};

// Rules
export interface Rule {
  id: string;
  name: string;
  amount: number;
  frequency_type: string;
  entity: string;
  category_id: string | null;
  account_id: string | null;
}

export const rulesApi = {
  list: () => api.get<Rule[]>('/api/rules'),
  delete: (id: string) => api.delete(`/api/rules/${id}`),
};

// Assets
export interface Asset {
  id: string;
  name: string;
  type: 'PROPERTY' | 'STOCK' | 'VEHICLE' | 'LOAN' | 'OTHER';
  entity: 'PERSONAL' | 'BUSINESS';
  current_value: number;
  starting_value: number;
  is_liability: boolean;
  currency: string;
  equity?: number;
  lvr?: number;
  linked_loan_id?: string;
  ticker?: string;
  interest_rate?: number;
}

export const assetsApi = {
  list: (entities?: string) =>
    api.get<Asset[]>(`/api/assets${entities ? `?entities=${entities}` : ''}`),
  updateValue: (id: string, current_value: number) =>
    api.put<Asset>(`/api/assets/${id}/value`, { current_value }),
};

// Categories
export interface CategoryGroup {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  categories: { id: string; name: string; color: string }[];
}

export const categoriesApi = {
  groups: () => api.get<CategoryGroup[]>('/api/categories/groups'),
};
