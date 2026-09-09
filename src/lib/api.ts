import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig, isAxiosError } from 'axios';
import type { Branch, Business, Role } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

// Remove tokens left behind by versions that stored JWTs in browser storage.
if (typeof window !== 'undefined') {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 45000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const PAGE_CACHE_TTL_MS = 15_000;
const pageCache = new Map<string, { expiresAt: number; response: AxiosResponse<unknown[]> }>();
const pageRequests = new Map<string, Promise<AxiosResponse<unknown[]>>>();
let pageCacheVersion = 0;

/**
 * Parties and items are workspace-wide master data shared by every company.
 * A party ledger is deliberately excluded because its transactions belong to
 * the currently selected company and branch.
 */
function isSharedMasterRequest(url: string) {
  const path = url.split('?')[0];
  if (path === '/items' || path.startsWith('/items/')) return true;
  if (path === '/parties') return true;
  return /^\/parties\/[^/]+$/.test(path);
}

function getPageCacheKey(url: string, config: AxiosRequestConfig) {
  if (isSharedMasterRequest(url)) {
    // Party totals are calculated from the active company's transactions, so
    // master records are shared but each company's derived view is cached apart.
    const businessId = typeof window === 'undefined' ? '' : getActiveBusinessId() ?? '';
    return `${businessId}:shared:${url}:${JSON.stringify(config.params ?? {})}`;
  }
  const businessId = typeof window === 'undefined' ? '' : getActiveBusinessId() ?? '';
  const branchId = typeof window === 'undefined' ? '' : getActiveBranchId(businessId) ?? '';
  return `${businessId}:${branchId}:${url}:${JSON.stringify(config.params ?? {})}`;
}

export function clearApiCache() {
  pageCacheVersion += 1;
  pageCache.clear();
  pageRequests.clear();
}

export async function getAllPages<T>(
  url: string,
  config: AxiosRequestConfig = {},
): Promise<AxiosResponse<T[]>> {
  if (config.signal) return collectAllPages<T>(api, url, config);

  const key = getPageCacheKey(url, config);
  const cached = pageCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.response as AxiosResponse<T[]>;
  if (cached) pageCache.delete(key);

  const existing = pageRequests.get(key);
  if (existing) return existing as Promise<AxiosResponse<T[]>>;

  const requestVersion = pageCacheVersion;
  const request = collectAllPages<T>(api, url, config)
    .then((response) => {
      if (requestVersion === pageCacheVersion) {
        pageCache.set(key, {
          expiresAt: Date.now() + PAGE_CACHE_TTL_MS,
          response: response as AxiosResponse<unknown[]>,
        });
      }
      return response;
    })
    .finally(() => pageRequests.delete(key));

  pageRequests.set(key, request as Promise<AxiosResponse<unknown[]>>);
  return request;
}

async function collectAllPages<T>(
  client: AxiosInstance,
  url: string,
  config: AxiosRequestConfig = {},
): Promise<AxiosResponse<T[]>> {
  const limit = 100;
  let offset = 0;
  let firstResponse: AxiosResponse<T[]> | undefined;
  const records: T[] = [];

  do {
    const response = await client.get<T[]>(url, {
      ...config,
      params: { ...config.params, limit, offset },
    });
    firstResponse ??= response;
    records.push(...response.data);
    offset += response.data.length;
    if (response.data.length < limit) break;
  } while (true);

  return { ...firstResponse!, data: records };
}

const refreshClient = axios.create({
  baseURL: API_URL,
  timeout: 45000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const sessionClient = axios.create({
  baseURL: API_URL,
  timeout: 45000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

type RetryableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshRequest: Promise<void> | null = null;
let sessionRequest: Promise<SessionUser | null> | null = null;
let businessRequest: Promise<string | null> | null = null;
let branchRequest: Promise<string | null> | null = null;

const ACTIVE_BUSINESS_KEY = 'activeBusinessId';
const ACTIVE_BRANCH_PREFIX = 'activeBranchId:';

function getPageScopedBusinessId() {
  if (typeof window === 'undefined') return null;
  const isDocumentDetail = /^\/(invoices|documents)\/[^/]+\/?$/.test(window.location.pathname);
  return isDocumentDetail ? new URLSearchParams(window.location.search).get('companyId') : null;
}

api.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined') return config;

  const url = config.url ?? '';
  const canRunWithoutSession =
    url.startsWith('/auth/login') ||
    url.startsWith('/auth/refresh') ||
    url.startsWith('/auth/logout');

  if (!canRunWithoutSession) {
    const user = await getCurrentUser();
    if (!user) {
      redirectToLogin();
      throw new axios.Cancel('Authentication required');
    }
  }

  const isUnscoped = url.startsWith('/auth/') || url === '/businesses' || url.startsWith('/businesses/');
  if (isUnscoped) return config;

  const requestedBusinessId = config.headers.get('X-Business-Id')?.toString() || getPageScopedBusinessId() || undefined;
  let businessId = requestedBusinessId || getActiveBusinessId();
  if (!businessId) {
    businessRequest ??= collectAllPages<Business>(refreshClient, '/businesses')
      .then(({ data }) => {
        const firstBusiness = data[0]?.id ?? null;
        if (firstBusiness) setActiveBusinessId(firstBusiness);
        return firstBusiness;
      })
      .finally(() => {
        businessRequest = null;
      });
    businessId = await businessRequest;
  }

  if (!businessId) {
    if (window.location.pathname !== '/businesses') window.location.href = '/businesses';
    throw new axios.Cancel('No business selected');
  }

  // The API requires a business for authorization, even for shared masters.
  // Send the company header but omit the branch header so these records remain
  // common across the company's branches.
  if (isSharedMasterRequest(url)) {
    config.headers['X-Business-Id'] = businessId;
    return config;
  }

  const isCompanyScoped = url === '/branches' || url.startsWith('/branches/');
  if (isCompanyScoped) {
    config.headers['X-Business-Id'] = businessId;
    return config;
  }

  let branchId = config.headers.get('X-Branch-Id')?.toString() || getActiveBranchId(businessId);
  if (!branchId || (requestedBusinessId && branchId === 'all')) {
    const resolveBranch = () => collectAllPages<Branch>(refreshClient, '/branches', {
      headers: { 'X-Business-Id': businessId },
    })
      .then(({ data }) => {
        const firstBranch = data.find(({ isActive }) => isActive)?.id ?? null;
        if (firstBranch && !requestedBusinessId) setActiveBranchId(firstBranch, businessId);
        return firstBranch;
      });
    if (requestedBusinessId) {
      branchId = await resolveBranch();
    } else {
      branchRequest ??= resolveBranch().finally(() => {
        branchRequest = null;
      });
      branchId = await branchRequest;
    }
  }

  if (!branchId) {
    if (window.location.pathname !== '/businesses') window.location.href = '/businesses';
    throw new axios.Cancel('Create a branch before continuing');
  }

  const isOperational = ['/invoices', '/documents', '/production-orders'].some(
    (prefix) => url === prefix || url.startsWith(`${prefix}/`),
  );
  if (branchId === 'all' && isOperational && config.method?.toLowerCase() !== 'get') {
    throw new axios.Cancel('Select a specific branch before creating or changing records');
  }

  config.headers['X-Business-Id'] = businessId;
  config.headers['X-Branch-Id'] = branchId;
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.config.method && response.config.method.toLowerCase() !== 'get') clearApiCache();
    return response;
  },
  async (error) => {
    const config = error.config as RetryableRequestConfig | undefined;
    const isAuthMutation =
      config?.url?.includes('/auth/login') ||
      config?.url?.includes('/auth/register') ||
      config?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && config && !config._retry && !isAuthMutation) {
      config._retry = true;

      try {
        await refreshSession();
        return api(config);
      } catch {
        resetSession();
        redirectToLogin();
      }
    }

    if (
      error.response?.status === 403 &&
      error.response?.data?.message === 'Authenticator MFA is required for billing access' &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/security'
    ) {
      const currentUser = await getCurrentUser().catch(() => null);
      if (currentUser?.mfaEnabled && !currentUser.mfaVerified) {
        window.location.href = '/security';
      }
    }

    return Promise.reject(error);
  },
);

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  sessionId: string;
  mfaEnabled: boolean;
  mfaVerified: boolean;
};

export function resetSession() {
  sessionRequest = null;
  businessRequest = null;
  branchRequest = null;
  clearApiCache();
}

export function getActiveBusinessId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_BUSINESS_KEY);
}

export function setActiveBusinessId(businessId: string) {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(ACTIVE_BUSINESS_KEY) !== businessId) clearApiCache();
  localStorage.setItem(ACTIVE_BUSINESS_KEY, businessId);
}

export function getActiveBranchId(businessId = getActiveBusinessId()) {
  if (typeof window === 'undefined' || !businessId) return null;
  return localStorage.getItem(`${ACTIVE_BRANCH_PREFIX}${businessId}`);
}

export function setActiveBranchId(branchId: string, businessId = getActiveBusinessId()) {
  if (typeof window === 'undefined' || !businessId) return;
  if (getActiveBranchId(businessId) !== branchId) clearApiCache();
  localStorage.setItem(`${ACTIVE_BRANCH_PREFIX}${businessId}`, branchId);
}

export function clearActiveBranch(businessId = getActiveBusinessId()) {
  if (typeof window === 'undefined' || !businessId) return;
  localStorage.removeItem(`${ACTIVE_BRANCH_PREFIX}${businessId}`);
  clearApiCache();
}

export function clearActiveBusiness() {
  if (typeof window === 'undefined') return;
  clearActiveBranch();
  localStorage.removeItem(ACTIVE_BUSINESS_KEY);
  clearApiCache();
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  sessionRequest ??= sessionClient
    .get<SessionUser>('/auth/me')
    .then(({ data }) => data)
    .catch(async (error: unknown) => {
      if (isAxiosError(error) && error.response?.status === 401) {
        try {
          await refreshSession();
          const { data } = await sessionClient.get<SessionUser>('/auth/me');
          return data;
        } catch {
          return null;
        }
      }
      sessionRequest = null;
      throw error;
    });

  return sessionRequest;
}

async function refreshSession(): Promise<void> {
  refreshRequest ??= refreshClient
    .post('/auth/refresh')
    .then(() => undefined)
    .finally(() => {
      refreshRequest = null;
    });
  return refreshRequest;
}

function redirectToLogin() {
  if (
    typeof window !== 'undefined' &&
    window.location.pathname !== '/login'
  ) {
    window.location.href = '/login';
  }
}

export function getApiError(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (axios.isCancel(error)) return error.message || fallback;
  if (!isAxiosError<{ message?: string | string[] }>(error)) return fallback;

  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message[0] ?? fallback;
  if (message) return message;
  if (error.code === 'ECONNABORTED') return 'The request took too long. Please try again.';
  if (!error.response) return 'Unable to reach the server. Check your connection and try again.';
  return fallback;
}
