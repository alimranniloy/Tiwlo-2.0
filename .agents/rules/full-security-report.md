---
trigger: always_on
---

# 🔄 CROSS-PLATFORM FEATURE + LOGIC + SECURITY CONSISTENCY RULE

কোনো নতুন feature, modification, bug fix, security fix, API change, database change, plugin/add-on বা business logic পরিবর্তন করার সময় **শুধু যে জায়গায় পরিবর্তন করতে বলা হয়েছে সেই জায়গা পরিবর্তন করে কাজ শেষ করা যাবে না।**

প্রথমে পুরো system-এর architecture বুঝে দেখতে হবে feature বা change-টি অন্য কোনো platform/component-এর সঙ্গেও সম্পর্কিত কিনা।

---

## 1. Website এবং App দুটোই Check করতে হবে

যদি project-এর মধ্যে থাকে:

* Main Website
# 🚨 18. MANDATORY NO-SKIP CHANGE REPORTING RULE

এই নিয়মটি বাধ্যতামূলক। কোনো development task, feature update, bug fix, security fix, API modification, database change, plugin development বা refactoring-এর ক্ষেত্রে কোনো গুরুত্বপূর্ণ কাজ নীরবে বাদ দেওয়া যাবে না।

### A. No-Skip Development Policy

* কোনো requested task-এর অংশ বাদ দেওয়া যাবে না।
* Website-এ পরিবর্তন করে App-এর প্রয়োজনীয় পরিবর্তন বাদ দেওয়া যাবে না।
* App-এ পরিবর্তন করে Website বা Portal-এর প্রয়োজনীয় পরিবর্তন বাদ দেওয়া যাবে না।
* API, GraphQL, PostgreSQL বা Backend-এর প্রয়োজনীয় পরিবর্তন বাদ দেওয়া যাবে না।
* Security audit, testing বা verification না করে কাজ complete ঘোষণা করা যাবে না।
* কোনো feature আংশিক implement হলে সেটিকে সম্পূর্ণ হয়েছে বলা যাবে না।
* কোনো সমস্যা fix করা সম্ভব না হলে সেটি স্পষ্টভাবে জানাতে হবে।
* কোনো ফাইল, module বা connected service access করা সম্ভব না হলে সেটিকে verified বলে দাবি করা যাবে না।

### B. Before Development — Change Plan

কাজ শুরু করার আগে সংক্ষেপে জানাবে:

1. কোন feature বা functionality পরিবর্তন হবে।
2. কোন কোন file/folder পরিবর্তন হতে পারে।
3. Website-এর কোন অংশ প্রভাবিত হবে।
4. App-এর কোন অংশ প্রভাবিত হবে।
5. Backend, API, GraphQL ও Database-এর কী পরিবর্তন প্রয়োজন।
6. Security ও connected integrations-এর কী প্রভাব পড়তে পারে।
7. কোন কোন test চালাতে হবে।

### C. During Development — Change Tracking

প্রতিটি পরিবর্তন track করবে।

* Created files
* Modified files
* Deleted files
* Updated APIs
* Updated GraphQL schemas/resolvers
* Database migrations
* Updated plugins
* Updated integrations
* Security modifications

কোনো গুরুত্বপূর্ণ পরিবর্তন report-এর বাইরে রাখা যাবে না।

### D. After Development — Mandatory Change Report

প্রতিটি task শেষ হলে নিচের format-এ report দেবে:

**CHANGE REPORT**

* Requested feature:
* Implementation status:
* Files created:
* Files modified:
* Files deleted:
* Website status:
* Web Portal status:
* Mobile App status:
* Backend status:
* API/GraphQL status:
* PostgreSQL status:
* Plugin/Add-on status:
* Connected Apps status:
* Security audit status:
* Tests executed:
* Regression test status:

### E. Skipped / Unavailable Items

যদি কোনো কাজ বাদ পড়ে বা সম্পন্ন করা সম্ভব না হয়, তাহলে আলাদাভাবে জানাবে:

* কোন কাজটি বাকি।
* কেন বাকি।
* কোন dependency বা permission প্রয়োজন।
* কী ঝুঁকি তৈরি হতে পারে।
* কীভাবে সম্পন্ন করা যাবে।

কোনো কাজ বাদ দিয়ে সেটি লুকানো যাবে না।

### F. Verification Evidence

শুধু "Done", "Fixed", "Working" বা "100% Complete" লিখে কাজ শেষ করা যাবে না।

যেখানে সম্ভব, test result, build result, API response, database verification এবং security scan result দিয়ে প্রমাণ করবে।

যে কাজ পরীক্ষা করা হয়নি, সেটিকে **Not Verified** হিসেবে চিহ্নিত করবে।

### G. Final Completion Status

প্রতিটি task-এর শেষে নিচের যেকোনো একটি status ব্যবহার করবে:

* **COMPLETED & VERIFIED:** প্রয়োজনীয় কাজ সম্পন্ন এবং যাচাই করা হয়েছে।
* **PARTIALLY COMPLETED:** কিছু কাজ সম্পন্ন, কিছু কাজ বাকি।
* **BLOCKED:** Permission, dependency বা access-এর কারণে কাজ আটকে আছে।
* **NOT VERIFIED:** পরিবর্তন করা হয়েছে, কিন্তু পর্যাপ্ত verification হয়নি।
* **SECURITY ISSUE REMAINING:** গুরুত্বপূর্ণ unresolved security issue রয়েছে।

### H. Absolute Rule

কোনো কাজ চুপচাপ বাদ দেওয়া, অসম্পূর্ণ কাজকে complete বলা, test না করে success দাবি করা অথবা Website/App-এর inconsistency উপেক্ষা করা সম্পূর্ণ নিষিদ্ধ।

**প্রতিটি requested change-এর জন্য accountability, transparency এবং verification বাধ্যতামূলক।**

Final response দেওয়ার আগে নিজে নিশ্চিত করবে যে requested scope-এর প্রতিটি item-এর status report-এ উল্লেখ করা হয়েছে।

