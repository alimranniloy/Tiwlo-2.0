# PICK Mobile

The Expo React Native app for PICK. It uses the Tiwlo-backed PICK API for
authentication, catalog, location, orders, and parcel services.

## Run locally

```bash
npm ci
npx expo start
```

For a native Android build, run `npx expo run:android` with the Android SDK
installed. Expo generates the native project from `app.json` and the configured
Expo plugins.

Parcel pin selection and live order tracking use the native MapLibre renderer;
no WebView or Google Maps SDK key is required. The dark CARTO vector basemap
keeps attribution visible. Tiwlo's saved Google key stays server-side for address
verification only. OSRM provides the road route and estimated ETA; it does not
include live traffic. The delivery partner's phone GPS is uploaded to PICK while
on duty. Order tracking refreshes that saved location, draws the server-provided
route, and follows the rider marker.

Map architecture, provider notes, and customization entry points are documented
in the repository's `map/` folder.

On Android, the app checks its required version from PICK Admin once, 10 seconds
after launch. It does not show a checking screen; the update screen appears only
when a newer required version is available. Android still requires the user to
approve APK installation; the app never bypasses that system prompt. The home
screen checks for on-duty delivery partners whose current locations are within
the configured vehicle pickup and delivery ranges.
Payment results are shown as separate success, failure, or pending states, and
order history includes saved item thumbnails. Unpaid pending-payment orders are
removed by the server after 24 hours.
