import { applicationFetch as fetch } from '../../../api/graphqlTransport.js';
// Real Enterprise GraphQL Client for Tiwlo Cloud Dashboard & Droplets
const GRAPHQL_ENDPOINT = '/graphql';

export async function fetchGraphQL(query, variables = {}, { throwOnGraphQLErrors = false } = {}) {
  try {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    });
    if (!res.ok) {
      throw new Error(`GraphQL HTTP error ${res.status}`);
    }
    const json = await res.json();
    if (json.errors && json.errors.length > 0) {
      console.warn('GraphQL Query Warnings:', json.errors);
      if (throwOnGraphQLErrors) {
        const error = new Error(json.errors[0].message || 'GraphQL request failed');
        error.graphQLError = true;
        throw error;
      }
    }
    return json.data;
  } catch (err) {
    if (err.graphQLError) throw err;
    console.error('GraphQL request failed, attempting REST fallback:', err);
    return null;
  }
}

// 1. Fetch Cloud Dashboard Data (Metrics, Droplets, Activities, Popular Images)
export async function getCloudDashboardData(userId = null) {
  const query = `
    query GetCloudDashboard($userId: String) {
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
          userId
          tiwiId
          name
          specs
          vcpus
          memory
          storage
          ip
          region
          regionCode
          regionFlag
          status
          image
          created
          createdAt
        }
        activities {
          id
          userId
          action
          target
          type
          time
          createdAt
        }
        popularImages {
          id
          name
          os
          version
          icon
        }
      }
    }
  `;

  const data = await fetchGraphQL(query, { userId });
  if (data?.cloudDashboard) {
    return data.cloudDashboard;
  }

  // REST API Fallback
  const res = await fetch(`/api/cloud/dashboard?userId=${encodeURIComponent(userId)}`, { credentials: 'include' });
  if (res.ok) {
    return await res.json();
  }
  throw new Error('Failed to load cloud dashboard data');
}

// 2. Fetch User Stores for "Your Store" section
export async function getUserStores(userId = null) {
  const query = `
    query GetUserStores($userId: String) {
      userStores(userId: $userId) {
        id
        tiwiId
        storeName
        subdomain
        ownerId
        planId
        category
        currency
        billingDetails {
          address
          city
          country
          phone
          postalCode
        }
        status
        createdAt
      }
    }
  `;

  const data = await fetchGraphQL(query, { userId });
  if (data?.userStores) {
    return data.userStores;
  }

  // REST API Fallback
  const res = await fetch(`/api/stores?userId=${encodeURIComponent(userId)}`, { credentials: 'include' });
  if (res.ok) {
    return await res.json();
  }
  const payload = await res.json().catch(() => ({}));
  throw new Error(payload.error || 'Failed to load stores');
}

// 3. Create Droplet Mutation
export async function createDropletGraphQL(userId, dropletInput) {
  const mutation = `
    mutation CreateDroplet($userId: String, $input: CreateDropletInput!) {
      createDroplet(userId: $userId, input: $input) {
        id
        userId
        tiwiId
        name
        specs
        vcpus
        memory
        storage
        ip
        region
        regionCode
        regionFlag
        status
        image
        created
      }
    }
  `;

  const data = await fetchGraphQL(mutation, { userId, input: dropletInput });
  if (data?.createDroplet) {
    return data.createDroplet;
  }

  // REST API Fallback
  const res = await fetch('/api/cloud/droplets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ userId, ...dropletInput })
  });
  if (res.ok) {
    return await res.json();
  }
  const payload = await res.json().catch(() => ({}));
  throw new Error(payload.error || 'Failed to create droplet');
}

// 4. Update Droplet Status Mutation
export async function updateDropletStatusGraphQL(id, status) {
  const mutation = `
    mutation UpdateDropletStatus($id: ID!, $status: String!) {
      updateDropletStatus(id: $id, status: $status) {
        id
        status
      }
    }
  `;

  const data = await fetchGraphQL(mutation, { id, status });
  if (data?.updateDropletStatus) {
    return data.updateDropletStatus;
  }

  // REST API Fallback
  const res = await fetch(`/api/cloud/droplets/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status })
  });
  if (res.ok) {
    return await res.json();
  }
  throw new Error('Failed to update droplet status');
}

// 5. Delete Droplet Mutation
export async function deleteDropletGraphQL(id) {
  const mutation = `
    mutation DeleteDroplet($id: ID!) {
      deleteDroplet(id: $id)
    }
  `;

  const data = await fetchGraphQL(mutation, { id });
  if (typeof data?.deleteDroplet === 'boolean') {
    return data.deleteDroplet;
  }

  // REST API Fallback
  const res = await fetch(`/api/cloud/droplets/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (res.ok) {
    const json = await res.json();
    return json.success;
  }
  return false;
}

// 6. Create New Store Mutation ("Your Store" + action)
export async function createStoreGraphQL(userId, storeInput) {
  const mutation = `
    mutation CreateUserStore($userId: String, $input: CreateStoreInput!) {
      createUserStore(userId: $userId, input: $input) {
        id
        tiwiId
        storeName
        subdomain
        planId
        category
        currency
        billingDetails {
          address
          city
          country
          phone
          postalCode
        }
        status
        createdAt
      }
    }
  `;

  const data = await fetchGraphQL(mutation, { userId, input: storeInput }, { throwOnGraphQLErrors: true });
  if (data?.createUserStore) {
    return data.createUserStore;
  }

  // REST API Fallback
  const res = await fetch('/api/stores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ userId, ...storeInput })
  });
  if (res.ok) {
    return await res.json();
  }
  const payload = await res.json().catch(() => ({}));
  throw new Error(payload.error || 'Failed to create store');
}

// ==========================================
// 6. REAL CLOUD BILLING, CREDITS & INVOICES
// ==========================================

export async function getCloudBillingData(userId = null) {
  if (!userId) {
    throw new Error('Sign in to view your cloud billing account.');
  }
  try {
    const query = `
      query GetBillingAccount {
        cloudBillingAccount {
          userId
          billingAccountId
          billingAccountName
          currency
          credits
          promotionalCredits
          status
          hasConfiguredGateway
          paymentGatewayStatusMessage
          billingEnabled
          monthToDateSpent
          projectedCost
          configuredGateways {
            id
            name
            enabled
            mode
            currencies
          }
          invoices {
            id
            amount
            currency
            status
            description
            createdAt
            paidAt
          }
          costBreakdown {
            service
            amount
            percentage
          }
        }
      }
    `;
    const res = await fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    if (Array.isArray(json?.errors) && json.errors.length > 0) {
      throw new Error(json.errors[0]?.message || 'GraphQL billing query failed.');
    }
    if (json?.data?.cloudBillingAccount) {
      return { success: true, account: json.data.cloudBillingAccount };
    }
  } catch (e) {
    console.warn('GraphQL billing query fallback to REST:', e);
  }

  const res = await fetch('/api/cloud/billing', {
    credentials: 'include'
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to load billing account (${res.status}).`);
  }
  return await res.json();
}

export async function deductCloudCredits(userId, amount, service, description) {
  const res = await fetch('/api/cloud/billing/deduct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ userId, amount, service, description })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to deduct credits');
  }
  return data;
}

export async function redeemCloudVoucher(code) {
  const res = await fetch('/api/cloud/billing/vouchers/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ code })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Could not redeem voucher.');
  }
  return data;
}
