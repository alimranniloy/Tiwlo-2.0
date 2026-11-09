# PICK Delivery

PICK Delivery is a separate Expo app for delivery partners. It shares the existing PICK/Tiwlo authentication, address verification, and account-review screens from `pick/mobile`; keep that sibling folder and its assets in the repository when bundling this app. Metro resolves the shared screens against this app's single React installation to avoid duplicate React runtimes.

## Local development

```powershell
cd pick/delivery-app
npm install
npx expo install --fix
npm run start
```

Set `EXPO_PUBLIC_API_ORIGIN` to the Tiwlo server origin when it is not `https://tiwlo.com`. Set `EXPO_PUBLIC_EAS_PROJECT_ID` to the EAS project ID to enable Expo push notifications. Without that ID, the app still refreshes offers while open and warns that background offer alerts are unavailable.

## Delivery rules

The PostgreSQL migration is initialized with PICK's existing schema. Admins can adjust vehicle limits and ranges from the PICK dashboard. Initial defaults are:

| Vehicle | Capacity | Pickup range | Delivery range |
|---|---:|---:|---:|
| Walking | 10 kg | 1.5 km | 6 km |
| Bicycle | 25 kg | 4 km | 12 km |
| Motorbike | 35 kg | 8 km | 25 km |
| Car | 150 kg | 12 km | 40 km |
| Pickup truck | 500 kg | 15 km | 50 km |

Distances are straight-line estimates. Offers are limited to active coverage zones, require pickup and destination pins in the same zone, and are revalidated transactionally when accepted.

## Platform limits

On-duty tracking uses the OS background-location permission and a visible Android location-service notification. The operating system can still stop background work; Android does not restart a force-stopped app. The system notification sound uses the device's default notification sound, whose duration is controlled by the operating system and cannot be guaranteed to ring for exactly 20 seconds.
