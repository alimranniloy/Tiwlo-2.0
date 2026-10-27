# Account security and restrictions

## Authentication and device signals

- Password, Google and GitHub authentication flows require the configured email
  verification and two-step challenge before creating a dashboard session.
- After a successful web or trusted-app login, the server stores keyed hashes of
  the user-agent, browser client hints and network address. A newly observed
  device or network creates a durable security event. These browser signals are
  advisory and never independently disable an account.
- OTP issuance is capped per network and account. Each challenge remains
  one-time, expires, and has a bounded number of verification attempts.

## High-impact changes

The following actions require a fresh email OTP and a one-use, five-minute
grant bound to the signed-in account: custom-domain creation/verification/
activation/removal, free subdomain claims and DNS record changes, payment-provider
credential changes, staff records, administrator user edits, account bans/restores,
user deletion, platform payment gateway changes, system settings, social-login
credentials, storage credentials/transfers and full backup exports. Grant
consumption is logged as a security event. Protected routes retain their own
business audit records where implemented.

## Duplicate signup and abuse review

Email aliases, the signed first-party signup browser claim, and persisted
network/browser/account velocity limits help detect repeated signup attempts.
Duplicate attempts and authenticated dashboard mutation bursts are available in
the administrator security-events endpoint. Read-only GraphQL queries no longer
count as write activity. A shared address, network, or browser clue alone is not
evidence that two people are the same person.

## Runtime limits and dependencies

The API body size is bounded, signup/login/OTP/domain endpoints have focused
rate limits, and the application already uses Helmet, Express Rate Limit, Redis,
`rate-limit-redis`, and `sanitize-html`. Configure `REDIS_URL` in multi-instance
production so IP rate-limit buckets are shared across app replicas. Do not use
browser screen dimensions or a third-party fingerprint score to automatically
disable accounts; those values are unstable and can group unrelated users.
Authenticated dashboard accounts can make up to 300 mutations per five-minute
window; after that, the API returns a temporary 429 cooldown and records an
administrator security event. This does not disable the account.

## Disable policy

Automated request fingerprints and text keyword categories may create review
signals or policy strikes, but do not instantly permanently disable an account.
Permanent restrictions continue to require the existing repeated-violation
threshold or an explicit administrator decision. The administrator ban/restore
and destructive user-management actions require recent email verification.
Session revocation, notices and appeal intake remain recorded; an appeal never
restores access automatically.
