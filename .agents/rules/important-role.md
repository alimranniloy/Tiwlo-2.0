---
trigger: always_on
---

# 🚀 ROUTE - AUTH - ARCHITECTURE - PERFORMANCE - NOTIFICATION MASTER RULE

এই rule অনুযায়ী কোনো নতুন feature, page, dashboard, authentication flow, API, email system, notification system বা application architecture পরিবর্তন করার আগে **পুরো project আবার scan এবং audit করতে হবে।**

শুধু requested file পরিবর্তন করে কাজ শেষ করা যাবে না।

---

# 1. FULL PROJECT RESCAN — প্রথম কাজ

কোনো পরিবর্তন করার আগে সম্পূর্ণ accessible project structure পুনরায় scan করবে।

বিশেষভাবে দেখবে:

* Frontend
* Backend
* Website
* Web Portal
* Mobile App
* Dashboard
* Authentication
* Routing
* API
* GraphQL
* PostgreSQL
* Middleware
* Session management
* Token handling
* Email system
* Notification system
* Plugins/Add-ons
* Connected apps
* Environment configuration
* Loading architecture
* Lazy loading
* Caching
* Error handling
* Existing security controls
* Existing reusable components

আগের implementation ভালোভাবে না বুঝে নতুন code যোগ করা যাবে না।

---

# 2. PROFESSIONAL ROUTING RULE

সব page এবং dashboard-এর routing professional এবং predictable হতে হবে।

অপ্রয়োজনীয়:

* `#`
* `#/`
* `#token`
* `#hash`
* `#user`
* `?random`
* temporary route
* debug route
* meaningless route parameter

ব্যবহার করা যাবে না, যদি architecture অনুযায়ী সেগুলোর প্রয়োজন না থাকে।

উদাহরণ:

```text
/login
/register
/forgot-password
/dashboard
/profile
/settings
/notifications
/messages
/admin
```

যে application framework ব্যবহার করা হচ্ছে তার standard routing convention অনুসরণ করবে।

---

# 3. ROUTE-এ TOKEN বা SECRET প্রকাশ করা যাবে না

URL-এর মধ্যে কখনো sensitive authentication information রাখবে না।

বিশেষভাবে:

❌ Password
❌ Access token
❌ Refresh token
❌ Session secret
❌ API key
❌ Private credential

URL, query string বা fragment-এ unnecessaryভাবে রাখা যাবে না।

Authentication architecture অনুযায়ী secure cookie বা appropriate secure token mechanism ব্যবহার করবে।

যদি কোনো verification/reset flow-তে temporary token URL-এ থাকা technically প্রয়োজন হয়, তাহলে:

* short-lived token
* single-use token
* proper validation
* expiration
* server-side verification

ব্যবহার করবে এবং token exposure কমানোর ব্যবস্থা রাখবে।

---

# 4. LOGIN → DASHBOARD FLOW

Login সফল হওয়ার পরে user-কে proper authenticated state-এ নিয়ে যাবে।

উদাহরণ:

```text
/login
   ↓
Authentication
   ↓
Session / Auth State
   ↓
/dashboard
```

Login করার পরে user-এর authentication state যেন application-এর সব relevant অংশে properly available থাকে।

---

# 5. PAGE RELOAD করলে LOGIN হারানো যাবে না

User authenticated থাকা অবস্থায় browser reload করলে অপ্রয়োজনীয়ভাবে:

```text
Login → Logout → Login
```

হওয়া যাবে না।

Reload-এর পরে application-কে properly:

1. Auth state restore করতে হবে।
2. Session/token validity verify করতে হবে।
3. User information restore করতে হবে।
4. তারপর protected page render করতে হবে।

Authentication architecture অনুযায়ী secure persistence ব্যবহার করবে।

Expired বা invalid session হলে অবশ্যই properly logout/re-authentication flow-এ পাঠাবে।

---

# 6. DASHBOARD ROUTING

প্রতিটি dashboard-এর জন্য পরিষ্কার route এবং access control থাকবে।

উদাহরণ:

```text
/dashboard
/dashboard/profile
/dashboard/settings
/dashboard/notifications
/dashboard/security
```

Admin-এর জন্য:

```text
/admin
/admin/users
/admin/settings
/admin/security
```

প্রয়োজন অনুযায়ী project-এর architecture অনুসরণ করবে।

এক user যেন URL manually পরিবর্তন করে unauthorized dashboard access করতে না পারে।

**Frontend route guard + server-side authorization—দুটোই প্রয়োজন অনুযায়ী ব্যবহার করবে।**

---

# 7. DASHBOARD SECURITY

প্রতিটি dashboard-এর ক্ষেত্রে পরীক্ষা করবে:

* Authentication
* Authorization
* User ownership
* Role permissions
* API permissions
* Sensitive data exposure
* Direct URL access
* Refresh behavior
* Logout behavior
* Session expiration

শুধু UI hide করে security তৈরি করা যাবে না।

---

# 8. ID / USER ID / TOKEN HANDLING

যেখানে user ID, resource ID বা identifier ব্যবহার করা হয়:

* predictable ID থাকলে security risk তৈরি করছে কিনা পরীক্ষা করবে।
* অন্য user-এর ID পরিবর্তন করে resource access করা যায় কিনা পরীক্ষা করবে।
* Server-side ownership/authorization enforce করবে।
* Sensitive token এবং credential expose করবে না।

কেবল ID hide করাকে security হিসেবে বিবেচনা করবে না।

প্রয়োজন অনুযায়ী secure opaque identifier ব্যবহার করা যেতে পারে, কিন্তু **authorization সবসময় server-side enforce করতে হবে।**

---

# 9. “PLACEHOLDER UI” রাখা যাবে না

Production UI-তে অস্বাভাবিক placeholder বা developer-facing text থাকবে না।

যেমন:

❌ `#TOKEN`
❌ `USER_ID_HERE`
❌ `HASH_HERE`
❌ `TEST_USER`
❌ `LOADING...` যেখানে actual loading state দরকার নেই
❌ `TODO`
❌ `TEMP`
❌ `DEBUG`

Production-এর visible UI-তে রাখা যাবে না।

এর পরিবর্তে professional user-facing text ব্যবহার করবে।

---

# 10. LOADING ARCHITECTURE

কোনো page load হওয়ার আগে অপ্রয়োজনীয় file বা dashboard load করা যাবে না।

উদাহরণ:

User যদি `/login` page open করে:

```text
/login
   ↓
শুধু Login-এর প্রয়োজনীয় resources
```

অপ্রয়োজনীয়ভাবে:

```text
Settings Dashboard
Admin Dashboard
Messages
Analytics
Profile
Other plugins
```

load করা যাবে না।

---

# 11. CODE SPLITTING + LAZY LOADING

Application বড় হলে route অনুযায়ী প্রয়োজনীয় code lazy-load করবে।

উদাহরণ:

```text
/login
    → Login resources

/dashboard
    → Dashboard resources

/settings
    → Settings resources

/admin
    → Admin resources
```

যে feature দরকার নেই সেটার JavaScript/component/API/data অকারণে initial load-এ আনবে না।

তবে অতিরিক্ত code splitting করে application unnecessarily complex করবে না।

---

# 12. BACKEND LOAD OPTIMIZATION

একটি page-এর জন্য backend-এ অপ্রয়োজনীয় service, query বা module execute করা যাবে না।

উদাহরণ:

Login request-এর সময় অপ্রয়োজনীয়ভাবে:

* Settings service
* Notification service
* Analytics service
* Admin service
* Unrelated database queries

চালানো যাবে না।

প্রতিটি request-এর জন্য প্রয়োজনীয় dependency এবং database query যতটা সম্ভব সীমিত রাখতে হবে।

---

# 13. DATABASE QUERY OPTIMIZATION

Page বা API-এর প্রয়োজনের চেয়ে বেশি database data fetch করবে না।

চেক করবে:

* Unnecessary queries
* Duplicate queries
* N+1 queries
* Excessive joins
* Unnecessary fields
* Missing indexes
* Over-fetching
* Repeated API calls

প্রয়োজন অনুযায়ী pagination, caching বা batching ব্যবহার করবে।

---

# 14. AUTHENTICATION PAGE আলাদা Architecture

Login, Register, Forgot Password, Reset Password, Verification ইত্যাদি authentication flow-কে application-এর authenticated dashboard architecture থেকে properly separate রাখবে।

উদাহরণ:

```text
/auth
    /login
    /register
    /forgot-password
    /reset-password
    /verify
```

Framework অনুযায়ী structure পরিবর্তন করা যাবে।

---

# 15. EMAIL SYSTEM

যখন কোনো user-facing system তৈরি করা হবে এবং email notification প্রয়োজন হয়, তখন শুধু UI তৈরি করে থেমে যাবে না।

প্রয়োজন অনুযায়ী:

* Email trigger
* Backend service
* Email template
* User preference
* Verification
* Retry handling
* Delivery status
* Error handling
* Security
* Unsubscribe/preferences যেখানে প্রযোজ্য

পরীক্ষা করবে।

---

# 16. EMAIL-এর UI

সব email-এর visual design project-এর নির্ধারিত **clean, modern Google-inspired UI language** অনুসরণ করবে।

তবে:

* Google logo ব্যবহার করবে না।
* Google branding ব্যবহার করবে না।
* Google-specific product text ব্যবহার করবে না।
* Actual project-এর নিজস্ব branding ব্যবহার করবে।

Email হবে:

* Clean
* Minimal
* Professional
* Spacious
* Mobile responsive
* Accessible
* Clear hierarchy-সহ

---

# 17. EMAIL SECURITY

Verification, password reset বা sensitive email-এর ক্ষেত্রে:

* Short-lived token
* Expiration
* Single-use token যেখানে প্রয়োজন
* Secure token generation
* Server-side validation
* Rate limiting
* Account enumeration protection

ব্যবহার করবে।

Sensitive information email body-তে অপ্রয়োজনীয়ভাবে পাঠাবে না।

---

# 18. APP NOTIFICATION SYSTEM

যদি project-এর Mobile App থাকে এবং কোনো feature user notification তৈরি করে, তাহলে প্রয়োজন অনুযায়ী:

```text
Event
  ↓
Backend
  ↓
Notification Service
  ↓
Push Notification
  ↓
Mobile App
  ↓
Relevant Screen
```

flow কাজ করছে কিনা পরীক্ষা করবে।

শুধু Website-এ notification তৈরি করে App-এ notification না পাঠিয়ে কাজ শেষ করা যাবে না, যদি featureটির জন্য App notification প্রয়োজন হয়।

---

# 19. Notification-এর Deep Link

Push notification থেকে user app-এর relevant screen-এ পৌঁছাতে পারবে।

উদাহরণ:

```text
New Message
     ↓
Notification
     ↓
App
     ↓
/messages/{conversation}
```

অথবা framework-এর appropriate deep-link/navigation system ব্যবহার করবে।

Deep link-এর মাধ্যমে unauthorized resource access করা যাবে না।

---

# 20. Website + App Notification Consistency

একটি event-এর notification logic থাকলে পরীক্ষা করবে:

* Website notification
* App notification
* Email notification
* Push notification
* Notification preferences

কোনগুলো প্রয়োজন এবং কোনগুলো নয়।

একই event যেন অপ্রয়োজনীয়ভাবে duplicate notification না পাঠায়।

---

# 21. USER PREFERENCES

যদি notification settings থাকে:

```text
Notifications
├── Email
├── Push
├── In-App
└── Security Alerts
```

তাহলে user preference backend-এ properly persist করবে এবং Website/App দুটোতেই একই account state ব্যবহার করবে।

তবে security-critical notification user preference দিয়ে সম্পূর্ণ disable করা যাবে কিনা সেটি security requirements অনুযায়ী নির্ধারণ করবে।

---

# 22. FINAL ARCHITECTURE RESCAN

সব implementation শেষ হওয়ার পরে আবার পুরো relevant architecture scan করবে।

বিশেষভাবে খুঁজবে:

* Broken routes
* Incorrect routes
* Dead routes
* Duplicate routes
* Missing route guards
* Exposed tokens
* Broken authentication
* Reload issues
* Unnecessary initial loads
* Unnecessary backend calls
* Duplicate API calls
* Incorrect database queries
* Unused imports
* Dead code
* Temporary code
* Debug code
* Placeholder text
* Incorrect dashboard links
* Broken deep links
* Missing app implementation
* Missing notification flow
* Missing email flow
* Security inconsistencies

---

# 23. AUTOMATIC DETAIL INFERENCE RULE

আমি কোনো feature-এর কথা খুব সংক্ষেপে বললেও শুধু আমার exact sentence অনুযায়ী কাজ করবে না।

Project-এর existing architecture এবং এই Master Rules দেখে নিজে determine করবে featureটির জন্য আর কী কী dependency প্রয়োজন।

উদাহরণ:

আমি বললাম:

> “User-কে নতুন security alert দাও।”

তাহলে প্রয়োজন অনুযায়ী নিজে check করবে:

```text
Backend event
↓
Database
↓
Security notification
↓
Website notification
↓
Mobile push notification
↓
Email
↓
Notification preference
↓
Dashboard
↓
Security audit
↓
Cross-platform verification
```

সবগুলো প্রয়োজনীয় কিনা architecture অনুযায়ী নির্ধারণ করবে।

অর্থাৎ **আমি প্রতিটি ছোট dependency আলাদাভাবে বলে না দিলেও project-এর rules অনুসারে প্রয়োজনীয় implementation identify করবে।**

---

# 24. FINAL NO-SKIP CHECK

কাজ শেষ করার আগে অবশ্যই verify করবে:

```text
[ ] Full project rescan completed
[ ] Routes reviewed
[ ] Authentication reviewed
[ ] Token handling reviewed
[ ] User ID/security reviewed
[ ] Dashboard access reviewed
[ ] Reload behavior verified
[ ] Website verified
[ ] Web Portal verified
[ ] Mobile App verified
[ ] API verified
[ ] GraphQL verified
[ ] PostgreSQL verified
[ ] Backend dependencies reviewed
[ ] Unnecessary initial loading removed
[ ] Lazy loading/code splitting reviewed
[ ] Email flow verified
[ ] Email UI verified
[ ] Push notification verified
[ ] In-app notification verified
[ ] Deep links verified
[ ] Connected apps verified
[ ] Security re-scan completed
[ ] Regression testing completed
[ ] Temporary files/data cleaned
[ ] No placeholder/debug UI remains
[ ] No requested change skipped
```

---

# 🔒 MASTER PRINCIPLE

কোনো feature-কে শুধু একটি button, page বা screen হিসেবে বিবেচনা করবে না।

প্রতিটি feature-এর ক্ষেত্রে চিন্তা করবে:

**UI → Route → Authentication → Authorization → API → GraphQL → Backend → Database → Website → Portal → App → Email → Notification → Integration → Security → Performance → Testing**

যে layer-গুলো featureটির জন্য প্রয়োজন, সেগুলো automatically identify করে implement এবং verify করবে।

**কোনো প্রয়োজনীয় layer বাদ দিয়ে feature complete ঘোষণা করা যাবে না।**

Final status দেওয়ার আগে অবশ্যই জানাবে:

> **কী পরিবর্তন করা হয়েছে, কোন কোন platform-এ পরিবর্তন হয়েছে, কী কী verify করা হয়েছে, এবং কোনো অংশ বাকি/Not Verified
