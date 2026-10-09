# Signup abuse controls

The web app cannot guarantee one account per human without a trusted identity
signal. A new email, browser profile and network can look like a different person.
Shared devices and networks also do not prove that two accounts have the same owner.
These controls reject duplicate mailboxes and throttle abuse; they do not automatically
ban existing users based on a fingerprint, phone typed into a form, or IP address.

- Both `/api/auth/register` and `/api/social/register` use the same persisted limits:
  network 5/hour, 10/day and 30/month; canonical mailbox 5/hour; signed browser
  5/day and 10/month. Limits count attempts, including invalid submissions.
- Browser cookies are random, signed, HttpOnly, Secure in production and expire
  after 180 days. IP changes do not reset this signal. Clearing cookies does;
  no hidden fingerprint or browser-storage resurrection is used.
- A browser signature can reserve only one account. The browser claim and account
  insert are one atomic database statement, so concurrent attempts with different
  emails cannot create multiple accounts using that same signature. Shared-device
  users receive a support message, not a ban. This restriction only covers cookies
  issued by this version; a missing/cleared/expired cookie is a new browser signal.
- Consumer Gmail dot/plus aliases and `googlemail.com` map to the same signup key.
  Custom-domain dot/plus addresses remain distinct. The submitted address is retained
  for delivery. Login identifiers are not silently merged.
- The PostgreSQL trigger serializes writes per mailbox before checking for duplicates.
  It protects inserts and email changes, including concurrent requests and direct
  database writes by ordinary app code. Banned accounts still reserve their mailbox.
  Existing duplicate rows are preserved for review, never silently merged or banned.
- Database insert failure stops signup before runtime-account and tenant creation.
  User IDs use random UUIDs; insertion cannot overwrite an existing ID.
- GraphQL `register` rejects calls and directs callers to the protected REST API.
  Signed-in users cannot create another account through these signup APIs.

## Deployment

Restart the server to apply the idempotent signup schema migration. Back up the
database using the normal deployment procedure. `SECURITY_SECRET` must be stable
and shared by every server instance; changing it invalidates browser signatures.
Do not remove `system_signup_email_locks` while the app is running: it coordinates
concurrent writes. It is not a list of banned people.

`TRUSTED_PROXY_CIDRS` defaults to `loopback` for a local Nginx reverse proxy. Set
the actual proxy IP/CIDR for other deployments; otherwise users behind that proxy
share its rate limit. The production Docker compose file trusts its private network
and does not publish Node's port. Proxies must sanitize forwarded headers and public
clients must not reach Node through a trusted network path.

## Validation

Run this as one command:

```sh
npm --prefix server run test:signup
```

PGlite exercises the real PostgreSQL schema and trigger in isolation;
its single backend is not a multi-process load test. The regression suite tests both
HTTP signup routes, rotating IPs, browser signatures, alias limits, GraphQL bypass,
database failures and existing authentication protections. `--test-force-exit` is
needed for the existing security modules' background timers.

Provider and platform references: [Gmail alias behavior](https://support.google.com/mail/answer/7436150),
[Express proxy trust](https://expressjs.com/en/guide/behind-proxies/), and
[PostgreSQL function snapshots](https://www.postgresql.org/docs/current/xfunc-volatility.html).
