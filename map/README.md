# Tiwlo Maps

Tiwlo's mobile maps use the native MapLibre renderer through
`@maplibre/maplibre-react-native`. The shared PICK map component is
`pick/mobile/src/components/maps/PickNativeMap.tsx`; PICK Delivery imports that
same component through its existing shared-mobile setup.

The UI follows MapCN's composable MapLibre approach, including a dark basemap,
native markers, route lines, camera-follow behavior, and custom overlays. MapCN
itself is a React web component registry, not a map API, tile service, routing
service, or source of API keys. Its web components cannot be mounted directly in
React Native without a WebView, so the mobile apps use MapLibre Native instead.

The app loads CARTO's public dark vector style and keeps the required map
attribution visible. Review the tile provider's current usage and attribution
terms before scaling production traffic; a provider account or different
MapLibre-compatible style can be configured in `PickNativeMap.tsx` without
changing GPS or route data contracts.

Phone GPS is collected by Expo Location. Tiwlo's server continues to use its
saved Google key for address verification only; the key is never embedded in
the mobile apps. Road routes and ETA use OSRM's open routing API, with
`PICK_OSRM_BASE_URL` available to point the server at another OSRM instance.
The default `router.project-osrm.org` host is a best-effort demo with no SLA
and may not be suitable for production volume. Use a self-hosted OSRM instance
or a contracted provider for production reliability. OSRM estimates do not
include live traffic. The apps show route-source attribution (OSRM and
OpenStreetMap contributors); Google Maps SDK keys are not required.
