# PICK Delivery

PICK Delivery is a separate Expo app for delivery partners. It shares the existing PICK/Tiwlo authentication, address verification, and account-review screens from `pick/mobile`; keep that sibling folder and its assets in the repository when bundling this app. Metro resolves the shared screens against this app's single React installation to avoid duplicate React runtimes.

## Local development

```powershell
cd pick/delivery-app
npm install
npx expo install --fix
npm run start
```

Set `EXPO_PUBLIC_API_ORIGIN` to the Tiwlo server origin when it is not `https://tiwlo.com`. Set `EXPO_PUBLIC_EAS_PROJECT_ID` to the EAS project ID before building to enable Expo push notifications. Going on duty requires accurate GPS and background-location permission, which PICK Delivery requests in-app. Push setup and notification permission are optional and do not block duty; without push, parcel alerts may not arrive while the app is backgrounded.

Active delivery jobs show a native MapLibre map with rider, pickup, and delivery
markers plus a server-calculated road route and ETA. The map uses CARTO vector
tiles with attribution and does not require Google Maps SDK keys. OSRM provides
route estimates without live traffic; Google remains server-side for address
verification only. The key is never included in the app.

On Android, PICK Delivery checks its separate required version from PICK Admin
once, 10 seconds after launch. It does not show a checking screen; the update
screen appears only when a newer required version is available. Android still
asks the user to approve APK installation.

## Delivery rules

The PostgreSQL migration is initialized with PICK's existing schema. Admins can adjust vehicle limits and ranges from the PICK dashboard. Initial defaults are:

| Vehicle | Capacity | Pickup range | Delivery range |
|---|---:|---:|---:|
| Walking | 10 kg | 1.5 km | 6 km |
| Bicycle | 25 kg | 4 km | 12 km |
| Motorbike | 35 kg | 8 km | 25 km |
| Car | 150 kg | 12 km | 40 km |
| Pickup truck | 500 kg | 15 km | 50 km |

Distances are straight-line estimates. Parcel offers require pickup and destination pins in the same zone. Grocery orders use the shared pickup hub configured in PICK Admin and the customer’s saved delivery pin. Both types require an approved, on-duty partner with a recent location, and offers are revalidated transactionally when accepted.

## Platform limits

On-duty tracking uses OS background-location permission and a visible Android location-service notification. Expo push token registration is attempted when configured and permitted, but it is not a duty prerequisite. Parcel alerts use a high-priority system notification with the device's default notification sound; Android routes its audio through the ringtone stream. Android and the user control the notification-channel sound, so the app cannot force the selected call ringtone or guarantee exactly one minute of ringing. Android may stop background work and does not restart a force-stopped app.
