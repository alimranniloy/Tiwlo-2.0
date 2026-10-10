import { buildSchema, graphql } from 'graphql';
import { MasterDB, TenantDB } from '../db/multiTenant.js';
import { CloudDB } from '../db/cloud.js';
import { DiscordDB } from '../discord/discordDb.js';

// Initialize Cloud demo data
CloudDB.init();

// Construct GraphQL Schema using SDL
export const schema = buildSchema(`
  type Droplet {
    id: ID!
    userId: String
    tiwiId: String
    name: String!
    specs: String!
    vcpus: Int!
    memory: String!
    storage: String!
    ip: String!
    region: String!
    regionCode: String
    regionFlag: String
    status: String!
    image: String
    created: String!
    createdAt: String
  }

  type CloudMetrics {
    totalDroplets: Int!
    dropletsGrowth: String
    totalVcpus: Int!
    vcpusGrowth: String
    totalStorage: String!
    storageGrowth: String
    totalBandwidth: String!
    bandwidthGrowth: String
    cpuPercent: Int!
    cpuUsed: String!
    memoryPercent: Int!
    memoryUsed: String!
    storagePercent: Int!
    storageUsed: String!
    bandwidthPercent: Int!
    bandwidthUsed: String!
  }

  type CloudActivity {
    id: ID!
    userId: String
    action: String!
    target: String!
    type: String!
    time: String!
    createdAt: String
  }

  type PopularImage {
    id: ID!
    name: String!
    os: String!
    version: String
    icon: String
  }

  type CloudDashboardData {
    metrics: CloudMetrics!
    droplets: [Droplet]!
    activities: [CloudActivity]!
    popularImages: [PopularImage]!
  }

  type UserBillingDetails {
    address: String
    city: String
    country: String
    phone: String
    postalCode: String
  }

  type UserStore {
    id: ID!
    tiwiId: String!
    storeName: String!
    subdomain: String
    ownerId: String
    planId: String
    category: String
    currency: String
    billingDetails: UserBillingDetails
    status: String
    createdAt: String
  }

  input CreateDropletInput {
    name: String!
    region: String!
    regionCode: String
    regionFlag: String
    image: String!
    vcpus: Int
    memory: String
    storage: String
  }

  input BillingDetailsInput {
    address: String
    city: String
    country: String
    phone: String
    postalCode: String
  }

  input CreateStoreInput {
    storeName: String!
    subdomain: String
    planId: String
    category: String
    currency: String
    billingDetails: BillingDetailsInput
  }

  type Product {
    id: ID!
    name: String!
    sku: String!
    category: String!
    subCategory: String
    price: Float!
    costPrice: Float
    stock: Int!
    minStock: Int
    unit: String
    status: String
    image: String
    supplier: String
    warehouse: String
    barcode: String
    description: String
    isNew: Boolean
    badge: String
    createdAt: String
  }

  type Category {
    id: ID!
    name: String!
    slug: String!
    icon: String
    color: String
    description: String
    itemCount: Int
  }

  type Subcategory {
    id: ID!
    name: String!
    parentCategory: String!
    itemCount: Int
  }

  type Customer {
    id: ID!
    name: String!
    email: String
    phone: String
    address: String
    city: String
    totalOrders: Int
    totalSpent: Float
  }

  type Supplier {
    id: ID!
    name: String!
    contactPerson: String
    email: String
    phone: String
    address: String
    category: String
    status: String
  }

  type Purchase {
    id: ID!
    orderNumber: String!
    supplier: String!
    productId: String
    productName: String!
    sku: String
    quantity: Int!
    unitCost: Float!
    totalCost: Float!
    status: String
    date: String
  }

  type Sale {
    id: ID!
    invoiceNumber: String!
    customerName: String!
    customerPhone: String
    subtotal: Float!
    discount: Float
    tax: Float
    totalAmount: Float!
    paymentMethod: String
    paymentStatus: String
    date: String
  }

  type Activity {
    id: ID!
    type: String!
    action: String!
    details: String
    timestamp: String
  }

  type StoreSettings {
    storeName: String!
    tiwiId: String!
    currency: String
    timezone: String
  }

  type DashboardStats {
    totalProducts: Int!
    totalStockUnits: Int!
    totalStockValuation: Float!
    lowStockCount: Int!
    outOfStockCount: Int!
    totalSalesRevenue: Float!
  }

  type TiwiStore {
    id: ID!
    tiwiId: String!
    storeName: String!
    email: String!
    role: String
    planId: String
    planName: String
    subdomain: String
  }

  input ProductInput {
    name: String!
    sku: String
    category: String!
    subCategory: String
    price: Float!
    costPrice: Float
    stock: Int!
    minStock: Int
    unit: String
    image: String
    supplier: String
    description: String
  }

  input ProductUpdateInput {
    name: String
    price: Float
    costPrice: Float
    stock: Int
    category: String
    status: String
  }

  input SaleInput {
    customerName: String
    customerPhone: String
    subtotal: Float!
    discount: Float
    tax: Float
    totalAmount: Float!
    paymentMethod: String
  }

  input PurchaseInput {
    supplier: String!
    productName: String!
    productId: String
    sku: String
    quantity: Int!
    unitCost: Float!
  }

  type Query {
    cloudDashboard(userId: String): CloudDashboardData
    droplets(userId: String): [Droplet]
    cloudMetrics(userId: String): CloudMetrics
    cloudActivities(userId: String): [CloudActivity]
    popularImages: [PopularImage]
    userStores(userId: String): [UserStore]
    products(tiwiId: String, category: String, search: String): [Product]
    product(tiwiId: String, id: ID!): Product
    categories(tiwiId: String): [Category]
    subcategories(tiwiId: String): [Subcategory]
    customers(tiwiId: String): [Customer]
    suppliers(tiwiId: String): [Supplier]
    purchases(tiwiId: String): [Purchase]
    sales(tiwiId: String): [Sale]
    activities(tiwiId: String): [Activity]
    storeSettings(tiwiId: String): StoreSettings
    dashboardStats(tiwiId: String): DashboardStats
    tiwiStores: [TiwiStore]
    discordOverview(userId: String!): DiscordOverview
    discordBots(userId: String!): [DiscordBot]
    discordServers(userId: String!): [DiscordServer]
    discordMarketplace(category: String, search: String): [DiscordMarketplaceProduct]
    discordWorkspace(userId: String!, search: String): DiscordWorkspaceData
    discordWorkspaceOperations(userId: String!): [DiscordWorkspaceOperation]
  }

  type Mutation {
    createDroplet(userId: String, input: CreateDropletInput!): Droplet
    updateDropletStatus(id: ID!, status: String!): Droplet
    deleteDroplet(id: ID!): Boolean
    createUserStore(userId: String, input: CreateStoreInput!): UserStore
    addProduct(tiwiId: String, input: ProductInput!): Product
    updateProduct(tiwiId: String, id: ID!, input: ProductUpdateInput!): Product
    deleteProduct(tiwiId: String, id: ID!): Boolean
    recordSale(tiwiId: String, input: SaleInput!): Sale
    recordPurchase(tiwiId: String, input: PurchaseInput!): Purchase

    # Discord Bot & Community Mutations
    createDiscordBot(userId: String!, input: CreateDiscordBotInput!): DiscordBot
    createDiscordServer(userId: String!, input: CreateDiscordServerInput!): DiscordServer
    deleteDiscordBot(userId: String!, id: ID!): Boolean
    deleteDiscordServer(userId: String!, id: ID!): Boolean
  }

  # Discord Bot Manager Schema Types
  type DiscordBot {
    id: ID!
    userId: String!
    name: String!
    token: String
    clientId: String
    avatar: String
    prefix: String!
    status: String!
    description: String
    commandsToday: Int
    serversCount: Int
    createdAt: String
    updatedAt: String
  }

  type DiscordServer {
    id: ID!
    userId: String!
    name: String!
    icon: String
    memberCount: Int!
    guildId: String
    bots: [DiscordBot]
    createdAt: String
    updatedAt: String
  }

  type DiscordActivity {
    id: ID!
    userId: String!
    botId: String
    serverId: String
    title: String!
    description: String
    actionType: String
    createdAt: String
  }

  type DiscordOverview {
    botsOnlineCount: Int @deprecated(reason: "Live bot heartbeat is not available.")
    botsRegisteredCount: Int!
    connectedServersCount: Int!
    totalMembersCount: Int!
    bots: [DiscordBot]!
    servers: [DiscordServer]!
    recentActivities: [DiscordActivity]!
  }

  type DiscordMarketplaceProduct {
    id: ID!
    name: String!
    developer: String!
    category: String!
    description: String!
    rating: Float
    reviewsCount: Int
    pricingType: String
    pricingLabel: String
    iconType: String
    iconBg: String
    iconColor: String
    logoUrl: String
    installCount: Int
  }

  type DiscordWorkspaceService {
    id: ID!
    userId: String!
    serviceId: String
    name: String!
    category: String!
    iconType: String
    status: String!
    serverId: String
    serverName: String!
    plan: String
    usageCurrent: Int
    usageLimit: Int
    usageLabel: String
    renewalDate: String
    createdAt: String
    updatedAt: String
  }

  type DiscordWorkspaceOperation {
    id: ID!
    userId: String!
    operation: String!
    serviceId: String
    serviceName: String!
    result: String!
    timeAgo: String
    createdAt: String
  }

  type DiscordWorkspaceData {
    services: [DiscordWorkspaceService]!
    operations: [DiscordWorkspaceOperation]!
    totalServices: Int!
    connectedServersCount: Int!
    allServicesHealthy: Boolean
  }

  input CreateDiscordBotInput {
    name: String!
    token: String
    clientId: String
    prefix: String
    status: String
    description: String
    avatar: String
  }

  input CreateDiscordServerInput {
    name: String!
    icon: String
    memberCount: Int
    guildId: String
    botId: String
  }
`);

// Root Resolvers mapping directly to the Multi-Tenant Database
export const rootValue = {
  async products({ tiwiId, category, search }) {
    let prods = await TenantDB.getProducts(tiwiId);
    if (category && category !== 'All Categories') {
      prods = prods.filter(p => p.category?.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      prods = prods.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
      );
    }
    return prods;
  },

  async product({ tiwiId, id }) {
    return await TenantDB.getProductById(id, tiwiId);
  },

  async categories({ tiwiId }) {
    return await TenantDB.getCategories(tiwiId);
  },

  async subcategories({ tiwiId }) {
    return await TenantDB.getSubcategories(tiwiId);
  },

  async customers({ tiwiId }) {
    return await TenantDB.getCustomers(tiwiId);
  },

  async suppliers({ tiwiId }) {
    return await TenantDB.getSuppliers(tiwiId);
  },

  async purchases({ tiwiId }) {
    return await TenantDB.getPurchases(tiwiId);
  },

  async sales({ tiwiId }) {
    return await TenantDB.getSales(tiwiId);
  },

  async activities({ tiwiId }) {
    return await TenantDB.getActivities(tiwiId);
  },

  async storeSettings({ tiwiId }) {
    return await TenantDB.getStoreSettings(tiwiId);
  },

  async dashboardStats({ tiwiId }) {
    const products = await TenantDB.getProducts(tiwiId);
    const sales = await TenantDB.getSales(tiwiId);

    const totalStockUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    const totalStockValuation = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);
    const lowStockCount = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) < (p.minStock || 20)).length;
    const outOfStockCount = products.filter(p => (p.stock || 0) === 0).length;
    const totalSalesRevenue = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

    return {
      totalProducts: products.length,
      totalStockUnits,
      totalStockValuation: Math.round(totalStockValuation),
      lowStockCount,
      outOfStockCount,
      totalSalesRevenue: Math.round(totalSalesRevenue)
    };
  },

  async tiwiStores() {
    const users = await MasterDB.getUsers();
    return users.map(u => ({
      id: u.id,
      tiwiId: u.tiwiId,
      storeName: u.storeName,
      email: u.email,
      role: u.role,
      planId: u.planId,
      planName: u.planName,
      subdomain: u.subdomain
    }));
  },

  // Cloud Queries
  async cloudDashboard({ userId }) {
    return await CloudDB.getCloudDashboardData(userId);
  },

  async droplets({ userId }) {
    return await CloudDB.getDroplets(userId);
  },

  async cloudMetrics({ userId }) {
    return await CloudDB.getCloudMetrics(userId);
  },

  async cloudActivities({ userId }) {
    return await CloudDB.getCloudActivities(userId);
  },

  async popularImages() {
    return await CloudDB.getPopularImages();
  },

  async userStores({ userId }) {
    return await MasterDB.getUserStores(userId);
  },

  // Cloud Mutations
  async createDroplet({ userId, input }) {
    return await CloudDB.createDroplet(userId, input);
  },

  async updateDropletStatus({ id, status }) {
    return await CloudDB.updateDropletStatus(id, status);
  },

  async deleteDroplet({ id }) {
    return await CloudDB.deleteDroplet(id);
  },

  async createUserStore({ userId, input }) {
    return await MasterDB.createStoreForUser({
      userId,
      storeName: input.storeName,
      subdomain: input.subdomain,
      planId: input.planId || 'free',
      category: input.category,
      currency: input.currency,
      billingDetails: input.billingDetails
    });
  },

  // Mutations
  async addProduct({ tiwiId, input }) {
    return await TenantDB.addProduct(tiwiId, input);
  },

  async updateProduct({ tiwiId, id, input }) {
    return await TenantDB.updateProduct(tiwiId, id, input);
  },

  async deleteProduct({ tiwiId, id }) {
    const res = await TenantDB.deleteProduct(tiwiId, id);
    return !!res;
  },

  async recordSale({ tiwiId, input }) {
    return await TenantDB.addSale(tiwiId, input);
  },

  async recordPurchase({ tiwiId, input }) {
    return await TenantDB.addPurchase(tiwiId, input);
  },

  // Discord Bot Manager GraphQL Resolvers
  async discordOverview({ userId }) {
    return await DiscordDB.getOverview(userId);
  },

  async discordBots({ userId }) {
    return await DiscordDB.getBots(userId);
  },

  async discordServers({ userId }) {
    return await DiscordDB.getServers(userId);
  },

  async createDiscordBot({ userId, input }) {
    return await DiscordDB.createBot(userId, input);
  },

  async createDiscordServer({ userId, input }) {
    return await DiscordDB.createServer(userId, input);
  },

  async deleteDiscordBot({ userId, id }) {
    return await DiscordDB.deleteBot(userId, id);
  },

  async deleteDiscordServer({ userId, id }) {
    return await DiscordDB.deleteServer(userId, id);
  },

  async discordMarketplace({ category, search }) {
    return await DiscordDB.getMarketplaceProducts({ category, search });
  },

  async discordWorkspace({ userId, search }) {
    return await DiscordDB.getWorkspace(userId, { search });
  },

  async discordWorkspaceOperations({ userId }) {
    return await DiscordDB.getWorkspaceOperations(userId);
  }
};

// Express GraphQL Middleware
export function createGraphQLMiddleware() {
  return async (req, res) => {
    // If GET request with accept html, serve interactive GraphQL Explorer UI
    if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Tiwlo StockPro - Enterprise GraphQL Explorer</title>
          <style>
            body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f17; color: #f1f5f9; padding: 24px; }
            .container { max-width: 900px; margin: 0 auto; }
            h1 { font-size: 24px; color: #38bdf8; margin-bottom: 8px; }
            p { font-size: 14px; color: #94a3b8; }
            textarea { width: 100%; height: 180px; background: #1e293b; color: #f8fafc; border: 1px solid #334155; border-radius: 12px; padding: 12px; font-family: monospace; font-size: 13px; }
            button { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; }
            button:hover { background: #1d4ed8; }
            pre { background: #0f172a; padding: 16px; border-radius: 12px; border: 1px solid #1e293b; overflow-x: auto; font-size: 13px; color: #4ade80; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>⚡ Tiwlo Enterprise GraphQL API Explorer</h1>
            <p>Direct PostgreSQL & Multi-Tenant GraphQL interface. Enter your GraphQL query below:</p>
            <textarea id="query">query {
  dashboardStats(tiwiId: "your-tiwi-id") {
    totalProducts
    totalStockUnits
    totalStockValuation
    totalSalesRevenue
  }
  products(tiwiId: "your-tiwi-id") {
    name
    sku
    price
    stock
    category
  }
}</textarea><br/>
            <button onclick="runQuery()">Execute Query</button>
            <h3>Result:</h3>
            <pre id="output">Run query to see JSON output...</pre>
          </div>
          <script>
            async function runQuery() {
              const query = document.getElementById('query').value;
              const res = await fetch('/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
              });
              const data = await res.json();
              document.getElementById('output').textContent = JSON.stringify(data, null, 2);
            }
          </script>
        </body>
        </html>
      `);
    }

    try {
      const { query: queryString, variables, operationName } = req.body || {};
      if (!queryString) {
        return res.status(400).json({ error: 'GraphQL query is required in request body' });
      }

      const result = await graphql({
        schema,
        source: queryString,
        rootValue,
        variableValues: variables,
        operationName
      });

      res.json(result);
    } catch (err) {
      console.error('GraphQL Execution Error:', err);
      res.status(500).json({ errors: [{ message: err.message }] });
    }
  };
}
