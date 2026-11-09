# PICK API

This module runs inside the existing Tiwlo Express server; it does not start a
separate service. PostgreSQL data is isolated in the `pick` schema. The PICK
user table references the Tiwlo `system_users` record, so sign-in and signup
remain in Tiwlo and no Tiwlo password is copied into PICK.

The schema is initialized by the Tiwlo server on startup. It creates empty
catalog tables and does not import or seed the mobile app's mock products.
Products and categories must be populated with real PICK inventory before
they appear in the app.

## PICK public site and admin

The React/Next.js landing page and admin dashboard live in `pick/landing-page`.
Production builds are statically exported to `pick/landing-page/out` and served
on `https://pick.tiwlo.com`; `/api` requests are proxied to this same Tiwlo
server. The deployment script builds the site and provisions a Certbot
HTTP-01 certificate when no applicable PICK or wildcard certificate exists.

The Tiwlo authoritative DNS service resolves managed `tiwlo.com` subdomains
to the configured public edge IP, so PICK does not need a manually maintained
DNS record when the domain is delegated to Tiwlo DNS. Production still requires
`DNS_PUBLIC_EDGE_IP` to point at the public edge and the authoritative
nameservers for `tiwlo.com` to be delegated correctly.

The dashboard uses Tiwlo's existing `/login` and `/create-account` pages and
returns to PICK after authentication. Its API accepts only Tiwlo `admin` and
`super_admin` sessions. Catalog, order, customer, parcel, payment, and checkout
settings are read from or written to the `pick` PostgreSQL schema. Service
coverage uses administrator-configured circles; customer GPS coordinates are
reverse-geocoded with Tiwlo's Google Maps key and checked against active circles.
Locations outside all active areas see an unavailable screen and can join the
PostgreSQL-backed coverage waitlist. Rider fleet, coupons, and push broadcasts
remain unavailable until their services are connected; no demo records are shown.
Waitlist requests are visible to Tiwlo admins; automated notifications are not
configured.

## Mobile authentication

The app starts the existing Tiwlo web login or signup flow using
`GET /api/pick/auth/mobile-start`. After Tiwlo authentication, a short-lived,
single-use authorization code is returned to `pick://auth/callback`. The app
exchanges that code at `POST /api/pick/auth/mobile-token` using its PKCE
verifier. The resulting Tiwlo session is stored in the mobile app's secure
storage and sent as a Bearer token.

`POST /api/pick/auth/mobile-handoff` is an authenticated Tiwlo web endpoint
used to complete the mobile redirect. Neither the session token nor passwords
are placed in the callback URL.

## Endpoints

- `GET /api/pick/me` — current Tiwlo-linked PICK profile.
- `PATCH /api/pick/profile` — update PICK display name, phone, or delivery address.
- `GET /api/pick/catalog/categories` — active PICK categories.
- `GET /api/pick/catalog/products` — active products; accepts `categoryId` and `search`.
- `GET /api/pick/checkout/config` — authenticated grocery delivery fee.
- `GET /api/pick/payments/providers` — enabled, live BDT platform gateways available to PICK.
- `POST /api/pick/orders` — create a stock-checked grocery order using database prices and optionally start hosted payment.
- `GET /api/pick/parcel/vehicles` — configured parcel vehicles and server-side rates.
- `POST /api/pick/orders/parcel` — create a parcel order with its server-quoted vehicle rate and optionally start hosted payment.
- `GET /api/pick/orders` — current user's grocery and parcel order history.
- `GET /api/pick/payments/:orderId` — authenticated payment/order status.
- `GET /api/pick/admin/session` — verify a Tiwlo administrator session.
- `GET /api/pick/admin/overview` — actual PICK order/payment summary.
- `GET|POST /api/pick/admin/categories` — read and create database categories.
- `PATCH /api/pick/admin/categories/:id` — activate or deactivate an unused category.
- `GET|POST /api/pick/admin/products` — read and create database products.
- `PATCH|DELETE /api/pick/admin/products/:id` — edit or deactivate products.
- `GET /api/pick/admin/orders` and `PATCH /api/pick/admin/orders/:id/status` — review orders and advance supported grocery-order statuses.
- `GET /api/pick/admin/users` — Tiwlo-linked PICK profiles and stored order totals.
- `GET /api/pick/admin/parcels` and `/api/pick/admin/finance` — actual parcel orders, vehicle rates, and payment states.
- `GET /api/pick/admin/settings` and `PUT /api/pick/admin/settings/grocery-delivery-fee` — read and persist the fee used by mobile checkout.
- `POST /api/pick/location/reverse-geocode` — resolve and save a GPS delivery location
  using the Google Maps key already configured in Tiwlo and return its live
  match against configured service areas.
- `POST /api/pick/coverage/waitlist` — add the signed-in customer’s saved
  out-of-coverage location to the waitlist.
- `GET /api/pick/admin/coverage` — coverage circles, current customer-location
  matches, area summaries, and waitlist requests.
- `POST /api/pick/admin/coverage/zones` — create a real radius-based delivery
  circle after selecting its center on the admin map.
- `PATCH /api/pick/admin/coverage/zones/:id` — update or activate/deactivate a
  delivery circle.

The profile, location, and order endpoints require a valid Tiwlo session. Catalog
endpoints only return database records and never fall back to mock data.

Set `PICK_GROCERY_DELIVERY_FEE` in the Tiwlo server environment before enabling
grocery checkout. Parcel vehicles must be configured in `pick.parcel_vehicles`;
there are deliberately no seeded mock prices. Online checkout uses the live
platform gateways configured in Tiwlo Admin, without exposing credentials to
PICK clients. Only enabled bKash and SSLCOMMERZ gateways configured for live
BDT checkout are offered. The Tiwlo server verifies provider callbacks before
marking an order paid; online orders remain pending until verification. Pending
payments expire after 20 minutes and release reserved grocery stock. A verified
payment received after expiry is marked for payment review instead of being
silently treated as a fulfillable order. Cash on delivery remains available.
Wallet and live rider coordinates are not backed by a PICK service yet.

The mobile app loads the category and product endpoints for Home, groceries,
and product details. Variant prices must be configured for each listed unit;
products with incomplete variant pricing are rejected rather than estimated
from a base price.
