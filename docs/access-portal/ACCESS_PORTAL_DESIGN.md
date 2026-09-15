# Access Portal — Design

**Status:** Draft for review — design only, nothing is implemented
**Version:** 0.2
**Last Updated:** September 15, 2026
**Applies to:** a new Access Portal (frontend, backend, database) and the DBMS, Dashboard and Parser backends and frontends it connects to

---

## Table of Contents

1. [Overview](#1-overview)
2. [Decisions](#2-decisions)
3. [Architecture](#3-architecture)
4. [Data Model](#4-data-model)
5. [Portal Login](#5-portal-login)
6. [Opening a System](#6-opening-a-system)
7. [Remembering System Sessions (Complexity 1)](#7-remembering-system-sessions-complexity-1)
8. [Adding a User](#8-adding-a-user)
9. [Choosing Roles (Complexity 3)](#9-choosing-roles-complexity-3)
10. [Removing and Changing Access (Complexity 2)](#10-removing-and-changing-access-complexity-2)
11. [Security Controls](#11-security-controls)
12. [Changes Needed in Each App](#12-changes-needed-in-each-app)
13. [Failure Handling](#13-failure-handling)
14. [Rollout](#14-rollout)
15. [Testing](#15-testing)
16. [Operations](#16-operations)
17. [Security Findings to Fix First](#17-security-findings-to-fix-first)
18. [Verified Behaviour of the Existing Apps](#18-verified-behaviour-of-the-existing-apps)

---

## 1. Overview

### 1.1 What the client asked for

- A web page, the **Access Portal**, with one button per system: Parser, DBMS, Dashboard, Stripe.
- The user logs in to the portal first. The portal keeps each person's username and password for every system in its own database.
- Clicking a button calls that system's own login API, gets a session, and opens that system's frontend in a new tab, already logged in.
- An admin adds a user once, picks the systems and a role for each, and the portal creates the account in every selected system and sends one invitation email.
- The client listed three complexities: repeated OTP and staying logged in (Complexity 1), revoking and changing access (Complexity 2), and selecting a role on invite (Complexity 3). Sections 7, 10 and 9 answer them.

### 1.2 Goals

- Internal staff open DBMS, Dashboard and Parser from one place without retyping passwords.
- Admins add, change and remove a person's access to every system from one screen.
- Everyone else keeps logging in to each system directly, exactly as today.
- Saved passwords never reach the browser; system tokens are kept only in `HttpOnly` cookies that page scripts cannot read.

### 1.3 Non-goals

- Single sign-on or a shared identity across systems (rejected by the client on 2026-09-13).
- Comms (out of scope).
- Logging in to Stripe automatically: Stripe offers no API to log into its dashboard, so Stripe is a plain link.
- Setting portfolio or property scope from the portal; that stays inside each app.
- Replacing or closing the systems' own login pages.

### 1.4 Who uses it

Some internal people. All other users continue to use the systems' own login pages.

---

## 2. Decisions

| # | Topic | Decision |
|---|---|---|
| P1 | Architecture | New project: portal frontend, portal backend and its own MongoDB database, at `https://portal.dashboardvnps.com` |
| P2 | Portal login | Email + password + emailed 6-digit code |
| P3 | System login | The portal backend sends the saved email and password to that system's login API; the user types that system's emailed code in a portal popup |
| P4 | Saved passwords | Encrypted with AES-256-GCM using a dedicated key; decrypted only on the portal backend, in memory, when needed |
| P5 | Remembered sessions | Each system's tokens are kept in `HttpOnly` cookies on the portal (for example `dbms_acc_token`, `dbms_refresh_token`); a click first tries the refresh token and falls back to email + password + OTP |
| P6 | Handoff to the new tab | A 60-second single-use code in the URL; tokens never appear in URLs |
| P7 | Systems' own login pages | Stay available |
| P8 | Existing accounts | Linked (the person enters their existing password once and the portal verifies it with a test login) or created where missing |
| P9 | Removing access | The portal backend makes an HTTP call to that system's new disable API (`PATCH /api/users/:id/status` with `{ "is_active": false }`); never delete |
| P10 | Roles | Never stored in the portal: role lists and each person's current role are always fetched from that system's API; portfolio and property scope set later inside the app |
| P11 | Password rule for accounts the portal creates | 8–32 characters with at least one letter, one number and one special character (the strictest rule of the three apps) |
| P12 | Stripe and Comms | Stripe is a plain link with no saved credentials; Comms is out of scope |

---

## 3. Architecture

### 3.1 Components

```
                         https://portal.dashboardvnps.com
┌──────────────────────────┐          ┌────────────────────────────────────────────┐
│ Portal frontend          │ ───────▶ │ Portal backend                             │
│ login · access list      │          │ portal login + code · saved passwords      │
│ code popup · admin pages │          │ token cookies · handoff codes · invites    │
└────────────▲─────────────┘          └───────┬──────────────────────┬─────────────┘
             │ opens a new tab                 │ own database         │ calls each system's
             │ /portal-login?code=…            ▼                      │ existing APIs
             │                        ┌──────────────────┐            ▼
             │                        │ Portal MongoDB   │   DBMS API · Dashboard API · Parser API
             ▼                        └──────────────────┘   (vnpmanage.online)
  dbms. / new. / parser.dashboardvnps.com
  /portal-login page ── redeems the code at the portal backend ──▶ normal session in that system
```

| Component | Responsibility |
|---|---|
| Portal frontend | Portal login and code screens, access list with one button per system, code popup, admin pages for users, systems and roles |
| Portal backend | Portal accounts and sessions, encrypted system passwords, system token cookies, handoff codes, invitations, audit log. NestJS 11 on Node 24 with Prisma 6, the same stack as the existing backends |
| Portal database | MongoDB database owned only by the portal, run as a replica set (Prisma requires one) |
| System connectors | One module per system inside the portal backend, each implementing the capabilities in 3.2 |
| `/portal-login` page | A small page added to the DBMS, Dashboard and Parser frontends that redeems the handoff code |
| Stripe button | A link to the Stripe dashboard |

### 3.2 System connectors

Paths are relative to each API's base URL.

| Capability | DBMS | Dashboard | Parser |
|---|---|---|---|
| Request login code | `POST /api/auth/login/request-otp` with `email`, `password` | `POST /api/auth/login/request-otp` with `email`, `password` | `POST /auth/login` with `email`, `password` |
| Verify code | `POST /api/auth/login/verify-otp` with `email`, `otp`, `keep_sign_in`; in production the tokens come back **only as cookies** | `POST /api/auth/login/verify-otp` with `email`, `otp`; `access_token` and `refresh_token` in the body | `POST /auth/verify-otp` with `email`, `otp`; `access_token` in the body |
| Check a session | `GET /api/users/profile` | `GET /api/users/profile` | `GET /auth/me` |
| Renew a session | `POST /api/auth/refresh` with `refresh_token`; sets new cookies | `POST /api/auth/refresh` with `refresh_token`; returns new tokens | Not available |
| List roles | `GET /api/user-role` | `GET /api/user-role` | Fixed: `admin`, `partial` |
| Read a person's current role | `GET /api/users/:id` | `GET /api/users/:id` | `GET /user/:id` (after finding F2 is fixed) |
| Create an account | `POST /api/invitations`, then `POST /api/invitations/accept/:token` with the password | New endpoint (Section 12) | `POST /invitations`, then `POST /invitations/accept/:token` with `name` and `password` |
| Change role | `PATCH /api/users/:id/role` with `role_id` | `PATCH /api/users/:id/role` with `role_id` | `PATCH /user/:id` with `role` (after finding F2 is fixed) |
| Disable or enable | `PATCH /api/users/:id/status` with `is_active` (new, Section 12) | `PATCH /api/users/:id/status` with `is_active` (new) | `PATCH /user/:id/status` with `is_active` (new) |

---

## 4. Data Model

### 4.1 Portal collections

| Collection | Contents | Rules |
|---|---|---|
| `portal_users` | Name, email, bcrypt password hash, status `active` / `disabled`, portal role `admin` / `member`, must-change-password flag, timestamps | Email trimmed, lowercased and unique |
| `portal_login_codes` | Hashed 6-digit code, attempts, expiry, consumed time | 10-minute expiry, 5 attempts |
| `portal_sessions` | Portal user, device, IP, created, last seen, expiry | 12-hour lifetime |
| `portal_login_throttle` | Failure counters per email and per IP, expiry | Removed automatically when expired |
| `system_accounts` | Portal user, system (`DBMS` / `DASHBOARD` / `PARSER`), the system's user id, system email, encrypted password (ciphertext, IV, auth tag, key id), status, last error, timestamps | One row per portal user per system; no role is stored |
| `handoff_codes` | Hash of the code, portal user, system, the token to hand over (encrypted), expiry, used time | 60-second expiry, single use, deleted after use |
| `portal_invitations` | Email, hashed token, inviter, expiry, accepted time | 7-day expiry |
| `audit_events` | Actor, action, system, target, result, IP, time | Append-only |

`system_accounts.status` is one of `active`, `waiting_for_password`, `creating`, `disabled`, `failed`.

### 4.2 System token cookies

Set by the portal backend on `portal.dashboardvnps.com`. They are never stored in the portal database.

| Cookie | Holds | Used for |
|---|---|---|
| `dbms_acc_token` | DBMS access token | Handing a live DBMS session to the new tab |
| `dbms_refresh_token` | DBMS refresh token | Getting new DBMS tokens without an OTP |
| `dashboard_acc_token` | Dashboard access token | Handing a live Dashboard session to the new tab |
| `dashboard_refresh_token` | Dashboard refresh token | Getting new Dashboard tokens without an OTP |
| `parser_acc_token` | Parser access token | Reusing a Parser session; Parser has no refresh token |

Every cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, host-only on `portal.dashboardvnps.com`, with `Path=/` and an expiry equal to the token's own expiry. All of them are cleared on portal logout.

### 4.3 Mapping to the client's diagram

The diagram keeps every system's fields on the user row (`dbms_email`, `dbms_pass`, `dbms_access_status`, `remember`, `dash_email`, `dash_pass`, …). This design stores the same information as one `system_accounts` row per system, so adding a system later needs no schema change. Stripe and Comms have no rows.

---

## 5. Portal Login

- Email and password, then a 6-digit code sent by email. The code expires after 10 minutes, is burned after 5 wrong tries, can be resent after 60 seconds, and at most 3 codes are sent per 15 minutes. Codes are never logged.
- Throttling: 5 wrong passwords for one email in 15 minutes locks that email for 15 minutes and sends a notice email; 50 failures from one IP in 15 minutes blocks that IP for 15 minutes. Every failure shows the same message.
- The portal session is a cookie limited to `portal.dashboardvnps.com`, marked `Secure`, `HttpOnly` and `SameSite=Lax`, lasting 12 hours.
- A user created by an admin must change the portal password at first login.
- Logging out of the portal deletes the portal session and clears all system token cookies.

---

## 6. Opening a System

```
User clicks DBMS  (the browser sends the portal's DBMS token cookies with the request)
  portal backend: dbms_refresh_token cookie works? (Section 7) ── yes, new tokens ──▶ step 5
  1  decrypt the saved DBMS password in memory
  2  ──▶ DBMS request-otp (email, password)
  3  popup: "Enter the code DBMS sent to your email"
  4  ──▶ DBMS verify-otp (email, code) ──▶ DBMS tokens (read from the cookie headers)
     set dbms_acc_token and dbms_refresh_token cookies on the portal
  5  create a single-use code (60 s) holding the token to hand over ──▶ open a new tab
     https://dbms.dashboardvnps.com/portal-login?code=…
  6  DBMS frontend ──▶ portal backend: redeem the code
     ◀── DBMS refresh token
  7  DBMS frontend ──▶ DBMS POST /api/auth/refresh ──▶ DBMS sets its normal session cookies
```

| System | What the `/portal-login` page receives when redeeming | What it does next |
|---|---|---|
| DBMS | Refresh token | Calls DBMS `POST /api/auth/refresh` with `refresh_token`; DBMS sets its session cookies |
| Dashboard | Refresh token | Calls Dashboard `POST /api/auth/refresh` with `refresh_token` and stores the returned tokens as it does today |
| Parser | Access token | Stores it as it does today |

- The redeem endpoint accepts requests only from the three frontend origins.
- The saved password is used only in steps 1–2 and is never sent to any browser.
- If the saved password is rejected, the portal asks the user for the current password of that system, verifies it with a test login and saves it (Section 10.5).

---

## 7. Remembering System Sessions (Complexity 1)

```
User clicks DBMS or Dashboard
  <system>_refresh_token cookie present?
     yes → portal backend ──▶ that system's POST /api/auth/refresh
              accepted → set new <system>_acc_token and <system>_refresh_token cookies
                         → open the tab, no popup
              rejected → clear that system's cookies → email + password + OTP (Section 6, steps 1–4)
     no  → email + password + OTP (Section 6, steps 1–4)

User clicks Parser (no refresh token)
  parser_acc_token cookie present and accepted by GET /auth/me?
     yes → open the tab, no popup
     no  → email + password + OTP
```

| Rule | Value |
|---|---|
| Where tokens are kept | `HttpOnly` cookies on `portal.dashboardvnps.com`, set by the portal backend (Section 4.2); never in the portal database and never readable by the portal page's scripts |
| How long no OTP is needed | As long as that system accepts its refresh token (DBMS, Dashboard) or its access token (Parser) |
| When cookies are cleared | Portal logout; the system rejects the token (for example after access was disabled or the password changed); cookie expiry |
| Differences per system | DBMS and Dashboard renew with their refresh token; Parser has no refresh token, so the popup returns when its access token expires |

How long a login is remembered therefore depends on each system's token lifetimes. The local configuration files set DBMS refresh tokens to `7d`, Dashboard refresh tokens to `365d` and Parser access tokens to `3650d`; each system should choose lifetimes it accepts for remembered logins (Section 12).

---

## 8. Adding a User

```
Admin: "Add user"
  1  name, email, one password (rule P11)
  2  tick systems and choose a role for each (Section 9)
  3  for each ticked system, as the admin inside that system:
        account created                   → status active, password saved encrypted
        system says the email exists      → status waiting_for_password (linked)
        system says an invite is pending  → status failed, "cancel the pending invite in <system>"
        any other error                   → status failed, Retry
  4  create the portal account (must change portal password at first login)
  5  send one invitation email from the portal
User: logs in to the portal; for each waiting_for_password system, enters that system's
      existing password once; the portal verifies it with a test login and saves it
```

| System | How the account is created |
|---|---|
| DBMS | `POST /api/invitations` with `email`, `user_role_id` and `send_email: false` (new option), then `POST /api/invitations/accept/:token` with the name and password |
| Dashboard | New endpoint that creates a verified user with `role_id`, name and password (Section 12) |
| Parser | `POST /invitations` with `email`, `role` and `send_email: false` (new option), then `POST /invitations/accept/:token` with `name` and `password` |

- Calls run as the admin inside each system, using the admin's own token cookies for that system; if they are missing or rejected, the admin sees the code popup first. Each system's own permission rules therefore apply.
- Each system shows its own result on the admin screen, with Retry for failures. Repeating the action never creates duplicates, because each system rejects an email that already exists.

---

## 9. Choosing Roles (Complexity 3)

```
☑ DBMS        [ Super Admin ▾ ]     loaded live from DBMS       GET /api/user-role
☑ Dashboard   [ Viewer      ▾ ]     loaded live from Dashboard  GET /api/user-role
☐ Parser      [ Admin / Partial ]   fixed list
☐ Stripe      link only, no account
```

- Role lists are fetched from each system's API every time the admin opens the screen (DBMS and Dashboard `GET /api/user-role`; Parser's fixed `admin` / `partial`), using the admin's token cookies for that system, so new roles appear without portal changes.
- Portfolio and property scope are not chosen in the portal. After creating an account with a partial role (a DBMS or Dashboard role with partial access, or Parser `partial`), an admin sets the scope inside that app. Until then that person sees no restricted data there.
- The portal never stores roles. Wherever it shows a person's role, it reads it from that system at that moment (`GET /api/users/:id` in DBMS and Dashboard, `GET /user/:id` in Parser).

---

## 10. Removing and Changing Access (Complexity 2)

### 10.1 Remove a person's access to one system

1. The portal backend makes an HTTP call to that system as the admin: `PATCH /api/users/:id/status` with `{ "is_active": false }` in DBMS and Dashboard, `PATCH /user/:id/status` with `{ "is_active": false }` in Parser.
2. The system sets `is_active = false`. That person's next login is refused, and their existing tokens are rejected on the next request, including refresh.
3. Only after the system confirms, the portal marks the `system_accounts` row `disabled` and deletes its saved password. The person's token cookies stop working because the system rejects them.

The person's data in that system stays intact. Deleting is not used, because deleting a user removes business data in Dashboard (notes, tasks, contract URLs, consolidated reports, pending requests), is refused in DBMS for users who uploaded files or saved column templates, and in Parser leaves existing tokens working.

### 10.2 Give access again

The portal makes the same HTTP call with `{ "is_active": true }`, sets the row back to `waiting_for_password`, and the person enters that system's password once more.

### 10.3 Change a role

The portal makes an HTTP call to that system's role endpoint (Section 3.2), then reads the role back from the system to display it. Nothing is stored in the portal.

### 10.4 Add another system later

Same as Section 8, for one system.

### 10.5 Password changed directly inside a system

Because direct login stays available, a person may change a password inside a system. The next portal click is rejected by that system; the portal asks for the current password, verifies it with a test login and saves it.

### 10.6 Disable a whole portal user

The portal account is disabled and its portal sessions are deleted. The admin chooses per system whether to disable the account there too; systems the person also uses directly are unaffected unless selected.

### 10.7 When one system fails

Each system shows its own result. The portal never shows "removed" for a system until that system confirms, and failures can be retried.

---

## 11. Security Controls

| Area | Rule |
|---|---|
| Encryption of saved passwords and handoff tokens | AES-256-GCM with a random 96-bit IV per value and the authentication tag stored alongside; a random 32-byte key held outside the database (environment or secret store) with a key id on every record so the key can be rotated. The existing DBMS `EncryptionUtil` is not reused (see F16). |
| Use of saved passwords | Decrypted only inside the portal backend for a single login call; never logged, never returned by any API, never sent to a browser |
| Portal login | Password plus emailed code, throttling and generic errors (Section 5) |
| Portal session cookie | Host-only on `portal.dashboardvnps.com`, `Secure`, `HttpOnly`, `SameSite=Lax`, 12 hours |
| System token cookies | Set only by the portal backend; `HttpOnly`, `Secure`, `SameSite=Lax`, host-only on `portal.dashboardvnps.com`; never readable by page scripts; reach a system's frontend only through a handoff code |
| CSRF | `SameSite=Lax` cookies plus an Origin check on every state-changing portal request |
| Handoff codes | Random, stored only as a hash, single use, 60 seconds, bound to one user and one system |
| Redeem endpoint | Accepts requests only from `https://dbms.dashboardvnps.com`, `https://new.dashboardvnps.com` and `https://parser.dashboardvnps.com` |
| Tokens in URLs | Never |
| Admin actions | Only portal admins; every action written to `audit_events` with actor, target, system and result |
| Transport | HTTPS only, with HSTS |
| Database access | The portal database and its backups are reachable only by the portal backend and named operators; the encryption key is never stored with the backups |

### 11.1 Accepted risks

| Risk | Mitigation |
|---|---|
| If the portal database and the encryption key both leak, every saved system password leaks | Key kept outside the database, restricted access, audit log, portal limited to internal staff; runbook to reset every saved password in the systems (Section 16) |
| Direct login stays available, so the portal alone cannot block a person | Removing access always disables the account inside the system (Section 10.1) |
| A session handed to a browser lasts as long as the system's own tokens | Shorten token lifetimes in each system (Section 12) |
| Someone who copies a user's portal cookies can use that person's system tokens until they are rejected | `HttpOnly` and `Secure` cookies; disabling through the system's API (10.1) makes the system reject them; sensible refresh token lifetimes (Section 12) |

---

## 12. Changes Needed in Each App

| App | Change | Needed for |
|---|---|---|
| DBMS backend | `is_active` on `User`; login, refresh and the JWT strategy reject inactive users; new `PATCH /api/users/:id/status` taking `{ "is_active": boolean }` | Removing access (10.1) |
| DBMS backend | Optional `send_email` on `POST /api/invitations` | Creating accounts without a second email (8) |
| Dashboard backend | `is_active` on `User`; login, refresh and the JWT strategy reject inactive users; new `PATCH /api/users/:id/status` taking `{ "is_active": boolean }` | Removing access (10.1) |
| Dashboard backend | Admin endpoint that creates a verified user with role, name and password | Creating accounts (8); today's invite emails a temporary password and returns nothing |
| Parser backend | The JWT strategy looks the user up on every request and rejects inactive or deleted users; login rejects inactive users; new `PATCH /user/:id/status` taking `{ "is_active": boolean }` | Removing access actually working (10.1) |
| Parser backend | Guards on `POST /auth/register` and `GET/PATCH/DELETE /user/:id` (F1, F2) | Security; role changes (10.3) |
| Parser backend | Optional `send_email` on `POST /invitations` | Creating accounts without a second email (8) |
| DBMS, Dashboard, Parser frontends | A `/portal-login` page that redeems the handoff code (Section 6) | Opening a system from the portal |
| All three backends | Deliberate access and refresh token lifetimes (recommended) | How long a login is remembered (7) and how long a handed-off session lasts (11.1) |

---

## 13. Failure Handling

| Failure | What the user sees | Response |
|---|---|---|
| A system's API is down or slow | "DBMS is not responding, try again" | 10-second timeout per call; no retry loop |
| Refresh token rejected | The code popup | That system's cookies are cleared, then email + password + OTP |
| Saved password rejected | "Your DBMS password may have changed. Enter it again." | Test login, then save (10.5) |
| Code email not received | Resend after 60 seconds | The portal allows a resend after 60 seconds; the systems themselves have no resend limit today (F4) |
| Handoff code expired or already used | The system's page shows "Link expired, open it again from the portal" | Nothing stored; the user clicks the button again |
| Account disabled inside the system | "Your access to DBMS was removed" | The portal marks the row `disabled` |
| One system fails while adding a user | That system shows "Failed" with the reason and Retry | Other systems keep their results |
| Admin lacks permission in a system | "You are not allowed to do this in DBMS" | Nothing changes in the portal |
| Portal database unreachable | "Portal temporarily unavailable" | Systems keep working through their own login pages |
| Encryption key missing or wrong | The portal backend refuses to start | Alert operators |

---

## 14. Rollout

Every phase runs on staging first and reaches production through the default branch only after it works on staging.

| Phase | What happens |
|---|---|
| 0. Security fixes | Fix F1, F2 and F3 and close the unauthenticated routes in F5 (Section 17) |
| 1. App changes | Section 12 changes in DBMS, Dashboard and Parser backends and frontends |
| 2. Portal build | Portal backend, frontend and database on staging, with all three connectors |
| 3. Pilot | Two or three internal users on staging: link their accounts, open each system, remove and restore access |
| 4. Production | Release through the default branch; add the internal users |

The portal is additive: if it has to be switched off, every system keeps working through its own login page.

---

## 15. Testing

| Layer | Covers |
|---|---|
| Connector contract tests (against staging APIs) | For each system: request code, verify code, check session, renew, list roles, create account, change role, disable and enable |
| Encryption | Encrypt and decrypt round trip; a tampered ciphertext is rejected; key rotation re-encrypts old records |
| Handoff | A code works once; an expired code fails; a code for DBMS cannot be redeemed as Dashboard; the redeem endpoint rejects other origins |
| Token cookies | Refresh token cookie tried before any OTP; OTP when the cookie is missing or rejected; cookies are `HttpOnly`, `Secure` and host-only; cleared on portal logout; Parser access token reused until rejected |
| Portal login | Code expiry and attempt limit; throttling per email and per IP; generic errors |
| Adding users | Created, linked and failed paths per system; Retry does not duplicate |
| Removing access | After the disable HTTP call, the person's next request and next refresh in that system are rejected, including Parser; roles are read back from the system, never from the portal |
| Security cases | Saved passwords never appear in any API response or log; tokens never appear in URLs; non-admins cannot reach admin endpoints |

The portal backend uses Jest with `ts-jest`, `@nestjs/testing` and `supertest`, following Parser's existing setup, and runs its tests in CI on every pull request.

---

## 16. Operations

- **Health:** `/health` checks the portal database and the encryption key; an external uptime check alerts.
- **Alerts:** connector failure rate per system, saved-password rejections, portal login lockouts, admin removals.
- **Logs:** structured JSON, never containing passwords, codes or tokens.
- **Audit retention:** 1 year by default; the client confirms before go-live.
- **Runbooks:** rotate the encryption key; suspected portal compromise (disable the portal, reset every saved password inside the systems, rotate the key); a system API change breaks a connector; restore a disabled user.

---

## 17. Security Findings to Fix First

These exist today in the `staging` branches reviewed on 2026-09-13, independent of the portal.

| # | Finding | Where | Severity |
|---|---|---|---|
| F1 | Anyone can register a Parser account with role `admin`: no guard, the role comes from the request, and login ignores `is_active` / `is_verified` | Scraper `src/module/auth/auth.controller.ts:85`, `src/module/auth/auth.service.ts:270` | Critical |
| F2 | Parser `GET`, `PATCH`, `DELETE /user/:id` require no authentication; `PATCH` accepts `email`, `password`, `role`, so changing an email and using password reset takes over any account | Scraper `src/module/user/user.controller.ts:100,119,164` | Critical |
| F3 | Login codes written to server logs | DBMS `src/modules/auth/auth.service.ts:169`; Dashboard `src/modules/auth/auth.service.ts:114` | High |
| F4 | No rate limiting on login or code entry in any app | All three auth services | High |
| F5 | Internal routes with no authentication | DBMS `POST external/lambda/trigger`, `POST external/recurring-jobs/update-historical-run-date`, `POST property/{expedia,agoda,booking}-check/trigger-lambda`; Dashboard `PATCH property/:parent_id/access-level`; Scraper `POST recurring-jobs/dbms-ingest` | High |
| F6 | A ten-year DBMS user token is used as a service credential | Scraper `DBMS_JWT_TOKEN`, `src/module/scraper/scraper.controller.ts:359-382` | High |
| F7 | A raw shared secret is accepted as a bearer token | `external-raw-secret.guard.ts` in DBMS `src/common/guards/` and Scraper `src/module/qa-panel/guards/` | High |
| F8 | Unmasked OTA credentials available to anyone holding the shared communication secret | DBMS `GET external/property/:propertyId/credentials/unmasked` | High |
| F9 | Parser's token check never reads the database, so deleted users keep access | Scraper `src/module/auth/strategies/jwt.strategy.ts` | Medium |
| F10 | Invitation temporary passwords stored in plain text and compared with `!==` | Dashboard `src/modules/auth/auth.service.ts:266,417` | Medium |
| F11 | Open CORS (any origin) | Dashboard `src/main.ts:9`; Scraper `src/main.ts:35` | Medium |
| F12 | System user with a fixed password (`1234567890`, role `admin`) found by name | Scraper `src/module/recurring-job/recurring-job.service.ts:1566-1575` | Medium |
| F13 | Node 20 is end-of-life (2026-04-30) | DBMS and Scraper `Dockerfile` | Medium |
| F14 | Account enumeration through different error messages | Dashboard `src/modules/auth/auth.service.ts:101`; DBMS `src/modules/auth/auth.service.ts:145-149` | Low |
| F15 | Test-user seed script has no environment guard | Dashboard `prisma/seed-test-users.ts` | Low |
| F16 | Credential encryption uses AES-256-CBC with a fixed salt and no tamper detection, while its documentation says AES-256-GCM | DBMS `src/common/utils/encryption.util.ts:9,37`; `ENCRYPTION_IMPLEMENTATION.md` | Medium |

---

## 18. Verified Behaviour of the Existing Apps

| Topic | Behaviour | Source |
|---|---|---|
| DBMS login tokens | In production, `verify-otp` returns tokens only as HTTP-only cookies; the body contains a token only when `NODE_ENV=development` | DBMS `src/modules/auth/auth.controller.ts` (verify-otp) |
| Dashboard login tokens | `verify-otp` returns `access_token` and `refresh_token` in the body; requests authenticate only with a Bearer header | Dashboard `src/modules/auth/auth.dto.ts:210`, `src/modules/auth/strategies/jwt.strategy.ts` |
| Parser login tokens | `verify-otp` returns `access_token` in the body; no refresh endpoint | Scraper `src/module/auth/auth.service.ts:234,260` |
| Renewal | DBMS `refresh` reads the refresh token from its cookie or a `refresh_token` body field and sets new cookies; Dashboard `refresh` takes `refresh_token` in the body and returns tokens | DBMS `auth.controller.ts:211`; Dashboard `auth.controller.ts:177` |
| Invitations | DBMS and Parser invitation APIs email the invitee themselves and reject an email that already has an account or a pending invite; Dashboard's invite emails a temporary password and returns no data | DBMS `src/modules/user-invitation/user-invitation.service.ts`; Scraper `src/module/user-invitation/user-invitation.service.ts`; Dashboard `auth.controller.ts:75` |
| Deleting users | Dashboard delete also deletes the user's notes, tasks, contract URLs, property contract URLs, consolidated reports and requested pending actions; DBMS delete also deletes notes and is refused for users with files or column templates (required relations, Prisma default `Restrict`); Parser delete is a hard delete; DBMS and Dashboard delete require a Super Admin and the admin's password | `prisma/schema.prisma` in each repo; DBMS and Dashboard `src/modules/user/user.service.ts` |
| Disabled state | No app has a working disabled state: DBMS and Dashboard have only `is_verified`; Parser has `is_active` but nothing reads it | `prisma/schema.prisma`; Scraper auth module |
| Role and scope endpoints | DBMS `PATCH users/:id/role` takes `role_id`; Dashboard also accepts `portfolio_ids` and `property_ids`; both have `access/add` and `access/revoke` | DBMS `user.controller.ts:210,233,261`; Dashboard `user.controller.ts:219,242,270` |
| Admin actions needing a code | Dashboard admin password reset and admin activation require an OTP | Dashboard `src/modules/user/user.dto.ts` (`AdminResetUserPasswordDto`, `AdminActivateUserDto`) |
| Password rules | DBMS and Dashboard: 8–32 characters with a letter, a number and a special character; Parser invitation accept: at least 6 characters | DBMS `user-invitation.dto.ts:166`, `auth.dto.ts:41`; Dashboard `auth.dto.ts:142,190`; Scraper `user-invitation.validation.ts:36` |
| Account lookup | DBMS `GET /api/users` and Parser `GET /user` support `search` across name and email | DBMS `user.controller.ts:69`; Scraper `user.controller.ts:40` |
