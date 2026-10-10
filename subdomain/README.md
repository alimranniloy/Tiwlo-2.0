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
- Each account can claim one free domain permanently. Claims require a verified email and are protected by account, device, email, IP, and rate-limit signals.
- Suspicious or repeated attempts are stored as hashed audit signals in `system_free_subdomain_claim_attempts`; the UI shows a masked linked email when a claim is blocked.
- Successful logins also maintain a per-user security identity ledger containing only HMAC hashes of the device cookie, IP, user-agent, and supported client hints. Raw hardware identifiers, device names, license IDs, and full fingerprints are not collected.
- The global security layer uses self-hosted controls only: Helmet, Express rate limits, optional self-hosted Redis, PostgreSQL audit records, trusted proxy handling, and local request-anomaly enforcement. No paid bot or fingerprint API is required.
