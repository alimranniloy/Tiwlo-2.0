# 🌐 Subdomain Service Engine — uids.app

This directory references the **uids.app** Free Subdomain Service & Google-Inspired Clean UI experience located in:
👉 [`client/src/subdomain/`](../client/src/subdomain/)

### Architecture & Components
- **Container**: `client/src/subdomain/UidsLandingPage.jsx`
- **Navigation Bar**: `client/src/subdomain/components/UidsNavbar.jsx` (Centered logo, Mobile Login only, Desktop Login & Sign Up)
- **Hero & Typewriter**: `client/src/subdomain/components/UidsHero.jsx` (Compact dynamic typewriter animation)
- **Search Console**: `client/src/subdomain/components/UidsSearchBox.jsx` (Debounced PostgreSQL availability checks and recommendations)
- **Popular Examples**: `client/src/subdomain/components/UidsPopularChips.jsx`
- **In-Page Claim Wizard**: `client/src/subdomain/components/UidsClaimConsole.jsx` (Authenticated PostgreSQL-backed registration; zero popups / modals)
- **Pricing Plans**: `client/src/subdomain/components/UidsPricingCards.jsx` (Compact 20MB & Pro cards)
- **How It Works**: `client/src/subdomain/components/UidsHowItWorks.jsx` (Compact 3-step setup)
- **Edge Infrastructure**: `client/src/subdomain/components/UidsEdgeSpecs.jsx` (Compact 6-card grid)
- **FAQ Vault**: `client/src/subdomain/components/UidsFaq.jsx` (Compact accordion)
- **Footer**: `client/src/subdomain/components/UidsFooter.jsx`
- **Optimized Hero Graphic**: `client/public/background.jpg` (91KB optimized web asset, Hero only)

### Supported URLs & Routes:
- `/subdomain`, `/subdomains`
- `/uids`, `/uids.app`, `/uidis`, `/uidis.app`
- Standalone host: `https://uids.app`

### Backend

- `GET /api/subdomains/check?name=...` checks the requested name against PostgreSQL and returns matching available recommendations.
- `POST /api/subdomains/claim` registers an available name for the authenticated account.
- PostgreSQL startup creates `system_free_subdomains` automatically. Reserved platform names and duplicate registrations are rejected.
