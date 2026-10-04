---
trigger: always_on
---

### 🧩 CODE + DATABASE + API + PROJECT ARCHITECTURE MASTER RULE

এই নিয়মগুলো প্রতিটি project-এর code generation, feature development, database integration, API development, plugin/add-on development এবং code maintenance-এর ক্ষেত্রে **সবসময় অনুসরণ করতে হবে**।

---

### 1. PostgreSQL ও GraphQL Integration

যে project-এ PostgreSQL এবং GraphQL ব্যবহার করা হবে:

* PostgreSQL হবে real application database।
* GraphQL হবে properly structured API/data layer।
* Database এবং API-এর সঙ্গে proper connection/configuration রাখতে হবে।
* কোনো JSON file-কে database-এর বিকল্প হিসেবে ব্যবহার করা যাবে না।
* `users.json`, `demo-users.json`, `fake-data.json`, `dummy-data.json` বা এ ধরনের কোনো file-এ real application data রাখা যাবে না।
* Demo user, fake user বা dummy production data কখনো production application-এর অংশ হবে না।
* User-related data সবসময় actual database থেকে আসবে।
* Authentication, authorization এবং user data-এর ক্ষেত্রে real database/API flow ব্যবহার করতে হবে।

**মূল নিয়ম:**

> JSON শুধুমাত্র configuration, static metadata অথবা প্রয়োজনীয় non-user data-এর জন্য ব্যবহার করা যাবে; database-এর বিকল্প হিসেবে নয়।

---

### 2. Dummy / Demo Data নিষিদ্ধ

Production code-এর মধ্যে:

❌ Demo users
❌ Fake accounts
❌ Dummy profiles
❌ Fake posts
❌ Fake messages
❌ Hardcoded users
❌ Fake database records
❌ Placeholder production records

রাখা যাবে না।

UI preview-এর জন্য data দরকার হলে সেটি বাস্তব application architecture-এর সঙ্গে conflict না করে development/test environment-এর মাধ্যমে handle করতে হবে।

---

### 3. Test File ও Temporary Data Management

কোনো feature test করার জন্য temporary:

* Test file
* Temporary script
* Temporary JSON
* Dummy database record
* Temporary API endpoint
* Temporary migration/test data

তৈরি করতে হলে:

1. Test তৈরি করবে।
2. Test execute করবে।
3. Test result verify করবে।
4. কাজ শেষ হলে unnecessary temporary files/data পরিষ্কার করবে।
5. Temporary test code production code-এর মধ্যে রেখে যাবে না।

অর্থাৎ:

> **Test → Verify → Clean up**

তবে কোনো test file যদি project-এর permanent automated test suite-এর অংশ হিসেবে প্রয়োজনীয় হয়, তাহলে সেটিকে সরাবে না; বরং proper test directory-তে সংগঠিত রাখবে।

---

### 4. API-First Architecture

Application-এর functionality যতটা সম্ভব properly separated API architecture-এর মাধ্যমে তৈরি করতে হবে।

একটি file-এর মধ্যে:

* Database logic
* GraphQL logic
* Business logic
* Authentication
* UI logic
* API logic
* Utility functions

সব একসঙ্গে রাখা যাবে না।

প্রতিটি responsibility আলাদা layer/module-এ রাখতে হবে।

উদাহরণস্বরূপ:

```text
project/
├── app/
│   ├── api/
│   ├── graphql/
│   ├── services/
│   ├── controllers/
│   ├── models/
│   ├── middleware/
│   └── utils/
│
├── database/
│   ├── migrations/
│   ├── schemas/
│   └── seeds/
│
├── plugins/
│
├── components/
├── pages/
├── tests/
├── config/
└── docs/
```

Project-এর framework অনুযায়ী exact folder structure পরিবর্তন করা যাবে, কিন্তু **separation of concerns অবশ্যই বজায় রাখতে হবে।**

---

### 5. Feature আলাদা Module হিসেবে তৈরি করতে হবে

আমি যদি নতুন কোনো feature যোগ করতে বলি, সেটিকে existing code-এর মধ্যে অপ্রয়োজনীয়ভাবে মিশিয়ে ফেলবে না।

প্রয়োজনে feature-এর জন্য আলাদা:

* Component
* Service
* API
* GraphQL resolver
* Schema
* Model
* Utility
* Configuration
* Test

তৈরি করবে।

Feature যত বড় হবে, তার architecture তত বেশি modular হবে।

---

### 6. Add-on / Plugin বুঝে কাজ করা

আমি যদি কোনো নতুন functionality যোগ করতে বলি, তুমি নিজে analysis করে বুঝবে সেটি:

* সাধারণ feature,
* add-on,
* extension,
* অথবা plugin

কোন ধরনের architecture-এর মধ্যে সবচেয়ে ভালোভাবে রাখা উচিত।

যদি project-এ আগে থেকেই plugin system থাকে:

```text
plugins/
├── plugin-name/
│   ├── components/
│   ├── api/
│   ├── services/
│   ├── config/
│   └── ...
```

তাহলে নতুন plugin-এর code **সেই plugin-এর নিজস্ব folder-এর মধ্যেই** রাখতে হবে।

Existing plugin থাকলে তার architecture অনুসরণ করবে।

যদি featureটি আলাদা plugin হিসেবে তৈরি করা বেশি logical হয় এবং plugin structure না থাকে, তাহলে প্রয়োজন অনুযায়ী নতুন plugin/module structure তৈরি করবে।

---

### 7. Existing Code নষ্ট না করে Extend করতে হবে

নতুন feature যোগ করার সময়:

* Existing functionality অপ্রয়োজনীয়ভাবে পরিবর্তন করবে না।
* Existing API ভাঙবে না।
* Existing database structure অপ্রয়োজনীয়ভাবে পরিবর্তন করবে না।
* Existing components duplicate করবে না।
* একই code বারবার লিখবে না।
* Existing reusable functions/components থাকলে সেগুলো ব্যবহার করবে।

নতুন functionality অবশ্যই existing architecture-এর সঙ্গে compatible হতে হবে।

---

### 8. Codebase Scan ও Cleanup

নতুন code লেখার আগে এবং বড় feature শেষ করার পরে project structure review করবে।

যদি দেখতে পাও:

* কোনো file অস্বাভাবিকভাবে বড়,
* এক file-এর মধ্যে অতিরিক্ত responsibility,
* duplicate code,
* ভুল folder-এ code,
* unused file,
* unused function,
* unused import,
* duplicate component,
* improperly named file,
* misplaced API,
* database logic UI-এর মধ্যে,
* plugin code মূল application-এর মধ্যে unnecessarily mixed,
* obsolete temporary code,

তাহলে project-এর architecture অনুযায়ী সেগুলো **সঠিক জায়গায় reorganize করবে**।

তবে শুধু code সুন্দর দেখানোর জন্য working functionality ভেঙে refactor করবে না।

---

### 9. File Naming ও Folder Organization

সব file-এর নাম:

* পরিষ্কার
* predictable
* meaningful
* consistent

হতে হবে।

একই ধরনের functionality একই ধরনের folder-এ থাকবে।

উদাহরণ:

```text
components/
services/
api/
graphql/
models/
middleware/
utils/
hooks/
plugins/
tests/
config/
```

Framework-এর নিজস্ব convention থাকলে সেটিকে অগ্রাধিকার দিতে হবে।

---

### 10. One Giant File নিষিদ্ধ

সম্ভব হলে একটি file-এর মধ্যে পুরো application বা পুরো feature লিখবে না।

বিশেষ করে:

❌ 1000+ line-এর অপ্রয়োজনীয় component
❌ UI + API + database এক file
❌ সব GraphQL resolver এক বিশাল file
❌ সব services এক file
❌ সব plugins-এর code এক file

পরিবর্তে logical responsibility অনুযায়ী code split করবে।

তবে অকারণে অতিরিক্ত ছোট ছোট file তৈরি করেও architecture জটিল করবে না।

**Goal হলো balanced modular architecture।**

---

### 11. Database Structure পরিষ্কার রাখতে হবে

PostgreSQL ব্যবহার করলে:

* Proper schema
* Proper relations
* Proper migrations
* Proper indexes
* Appropriate constraints
* Proper validation

ব্যবহার করবে।

Database-related পরিবর্তন হলে প্রয়োজন অনুযায়ী migration তৈরি করবে।

Production database-এর data সরাসরি hardcode করবে না।

---

### 12. Security

Code তৈরি করার সময়:

* API keys hardcode করবে না।
* Password source code-এ রাখবে না।
* Database credentials source code-এ রাখবে না।
* Secret `.env` বা appropriate secret-management system ব্যবহার করবে।
* Sensitive information JSON file-এ রাখবে না।
* Authentication/authorization properly separate করবে।

---

### 13. Feature Complete হওয়ার পর Final Architecture Check

প্রতিটি বড় feature শেষ করার পরে নিজে check করবে:

```text
✓ Database connection ঠিক আছে?
✓ GraphQL/API properly separated?
✓ Real database ব্যবহার হচ্ছে?
✓ Dummy production data নেই?
✓ Unnecessary JSON database হিসেবে ব্যবহার হচ্ছে না?
✓ Temporary test files clean করা হয়েছে?
✓ Plugin/add-on সঠিক folder-এ আছে?
✓ Duplicate code আছে?
✓ Unused code আছে?
✓ File structure logical?
✓ Existing functionality ভাঙেনি?
✓ Security issue নেই?
✓ Code maintainable?
```

---

## 🔒 MASTER PRINCIPLE

সব development-এর ক্ষেত্রে এই principle অনুসরণ করবে:

> **Real Database + Proper API + Modular Architecture + Clean File Structure + Separated Responsibilities + Minimal Duplication + Proper Testing + Automatic Cleanup**

আমি কোনো feature-এর architecture আলাদাভাবে specify না করলেও, project-এর existing structure দেখে **নিজে সবচেয়ে logical এবং maintainable architecture নির্বাচন করবে।**

কোনো existing structure ভালো থাকলে সেটি অনুসরণ করবে; structure খারাপ বা অগোছালো হলে প্রয়োজন অনুযায়ী reorganize করবে।

**একটি file-এ সবকিছু ঢুকিয়ে দ্রুত code দেওয়ার পরিবর্তে, production-quality, scalable এবং maintainable project structure তৈরি করাই default হবে।**

