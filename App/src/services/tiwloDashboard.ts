import { Platform } from 'react-native';
import { TIWLO_API_BASE } from './tiwloAuth';

const TIWLO_ORIGIN = TIWLO_API_BASE.replace(/\/api$/, '');

export interface CloudMetrics {
  totalDroplets: number | string;
  dropletsGrowth?: string;
  totalVcpus: number | string;
  vcpusGrowth?: string;
  totalStorage: number | string;
  storageGrowth?: string;
  totalBandwidth: number | string;
  bandwidthGrowth?: string;
  cpuPercent: number;
  cpuUsed?: string;
  memoryPercent: number;
  memoryUsed?: string;
  storagePercent: number;
  storageUsed?: string;
  bandwidthPercent: number;
  bandwidthUsed?: string;
}

export interface DropletItem {
  id: string;
  name: string;
  specs?: string;
  ip?: string;
  region?: string;
  status?: string;
  image?: string;
}

export interface StoreItem {
  id: string;
  tiwiId?: string;
  storeName: string;
  subdomain?: string;
  status?: string;
  category?: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  target?: string;
  type?: string;
  time?: string;
  createdAt?: string;
}

export interface DashboardSnapshot {
  metrics: CloudMetrics;
  droplets: DropletItem[];
  stores: StoreItem[];
  activities: ActivityItem[];
  liveLoaded: boolean;
}

export const EMPTY_DASHBOARD_SNAPSHOT: DashboardSnapshot = {
  metrics: {
    totalDroplets: 0,
    dropletsGrowth: 'Ready to deploy',
    totalVcpus: 0,
    vcpusGrowth: 'Compute idle',
    totalStorage: '0 GB',
    storageGrowth: 'No volumes attached',
    totalBandwidth: '0 GB',
    bandwidthGrowth: 'Billing cycle active',
    cpuPercent: 0,
    cpuUsed: '0%',
    memoryPercent: 0,
    memoryUsed: '0 GB',
    storagePercent: 0,
    storageUsed: '0 GB',
    bandwidthPercent: 0,
    bandwidthUsed: '0 GB',
  },
  droplets: [],
  stores: [],
  activities: [],
  liveLoaded: false,
};

function authHeaders(sessionToken?: string): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Device-Platform': Platform.OS === 'ios' ? 'iOS' : 'Android',
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  };
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function loadTiwloDashboard(
  userId?: string,
  sessionToken?: string
): Promise<DashboardSnapshot> {
  if (!userId || !sessionToken) {
    return EMPTY_DASHBOARD_SNAPSHOT;
  }

  const headers = authHeaders(sessionToken);

  const gqlPromise = fetchJson<{
    data?: {
      cloudDashboard?: {
        metrics?: CloudMetrics;
        droplets?: DropletItem[];
        activities?: ActivityItem[];
      };
      userStores?: StoreItem[];
    };
  }>(`${TIWLO_ORIGIN}/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: `
        query MobileCloudDashboard($userId: String) {
          cloudDashboard(userId: $userId) {
            metrics {
              totalDroplets
              dropletsGrowth
              totalVcpus
              vcpusGrowth
              totalStorage
              storageGrowth
              totalBandwidth
              bandwidthGrowth
              cpuPercent
              cpuUsed
              memoryPercent
              memoryUsed
              storagePercent
              storageUsed
              bandwidthPercent
              bandwidthUsed
            }
            droplets {
              id
              name
              specs
              ip
              region
              status
              image
            }
            activities {
              id
              action
              target
              type
              time
              createdAt
            }
          }
          userStores(userId: $userId) {
            id
            tiwiId
            storeName
            subdomain
            status
            category
          }
        }
      `,
      variables: { userId },
    }),
  });

  const logsPromise = fetchJson<{ logs?: ActivityItem[] }>(
    `${TIWLO_API_BASE}/user/account/activity-log`,
    { method: 'GET', headers }
  );

  const [gql, logsData] = await Promise.all([gqlPromise, logsPromise]);
  const cd = gql?.data?.cloudDashboard;

  if (!cd && !logsData) {
    return EMPTY_DASHBOARD_SNAPSHOT;
  }

  return {
    metrics: cd?.metrics ?? EMPTY_DASHBOARD_SNAPSHOT.metrics,
    droplets: Array.isArray(cd?.droplets) ? cd.droplets : [],
    stores: Array.isArray(gql?.data?.userStores) ? gql.data.userStores : [],
    activities:
      Array.isArray(cd?.activities) && cd.activities.length > 0
        ? cd.activities
        : Array.isArray(logsData?.logs)
          ? logsData.logs.slice(0, 8)
          : [],
    liveLoaded: Boolean(cd || logsData),
  };
}
