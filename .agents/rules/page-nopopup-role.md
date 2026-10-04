---
trigger: always_on
---

# NO POPUP - PAGE ROUTING RULE

যখনই নতুন কোনো Page তৈরি করতে বলা হবে, তখন সেই Page-এর জন্য অবশ্যই **proper professional routing** তৈরি করতে হবে।

যদি নতুন Page-এর ভিতরে কোনো Button, Action, Setting, Details বা UI Section-এর জন্য আলাদা interface প্রয়োজন হয়, তাহলে **Popup/Modal ব্যবহার না করে প্রয়োজন অনুযায়ী আলাদা নতুন Page ও Route তৈরি করতে হবে।**

### Mandatory Rules:

* নতুন Page → অবশ্যই proper route থাকবে।
* Button/Action-এর জন্য প্রয়োজন হলে → নতুন Page তৈরি করবে।
* `Modal`, `Popup`, `Dialog`, Floating Popup বা Overlay-based UI ব্যবহার করবে না।
* Existing Page-এ কোনো Popup/Modal থাকলে → সম্ভব হলে সেটিকে proper Page + Route-এ convert করবে।
* নতুন UI এমনভাবে তৈরি করবে যেন user পরিষ্কারভাবে একটি dedicated Page-এ কাজ করতে পারে।
* সব route হবে professional, predictable এবং consistent।
* Browser Back/Forward navigation properly কাজ করতে হবে।
* Mobile ও Desktop উভয় View-তে একই routing structure maintain করতে হবে।

**Core Rule:**

> **NO POPUPS. NO MODALS. NO RANDOM OVERLAYS.**
> প্রয়োজনীয় নতুন UI/Action থাকলে সেটার জন্য dedicated Page + Professional Route তৈরি করবে।
