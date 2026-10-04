# StockPro - Inventory Management Dashboard

An exact replica of the modern SaaS Inventory Management Dashboard built with **React**, **Tailwind CSS**, and **Node.js Express** with real persistent data and interactive CRUD operations.

## ✨ Features

- **Exact Visual Match**:
  - macOS window buttons, sleek icons, rounded cards, subtle shadows, and soft gradients
  - 4 KPI Stat Cards with custom wave sparklines (Total Products, Total Stock, Total Sales, Low Stock)
  - Donut Chart with Category Breakdown (Electronics, Clothing, Home & Living, Beauty & Health, Sports, Others)
  - 7-Day In/Out Stock Movement Bar Chart
  - Top Selling Products list with sales counts, revenue, and growth rates
  - 6 Quick Action tiles (Add Product, New Purchase, New Sale, Scan Barcode, Import CSV, Generate Report)
  - Recent Activity timeline with live event logging
  - Recent Products Table with real-time search, category filters, list/grid toggle, and item actions
  - Bottom 3 promotional cards (Manage Stock, Total Value $248,650, Upgrade to Pro)
  - Dark / Light mode toggle
- **Real Data & Full CRUD**:
  - Add new products via interactive modal
  - Real deletion of products (permanently updates database and recalculates metrics)
  - Edit product names, SKUs, categories, stock, and prices
  - Record sales (auto-decrements inventory and increases total revenue)
  - Record restock purchase orders (auto-increments inventory)
  - Export real CSV reports

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons, Plus Jakarta Sans font
- **Backend**: Node.js, Express, CORS
- **Storage**: Persistent JSON database (`server/data/products.json`, `server/data/activities.json`)

## 🚀 Running the App

### Start both Frontend & Backend:
```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
