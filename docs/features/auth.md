# Auth (admin)

> Status: Built — code in `src/features/auth/`, token helpers in `src/core/security/`,
> `authenticate` middleware in `src/core/middleware/`.

## Purpose

Lets internal staff sign in to the admin panel and keep a session alive. Consumers (travellers) have
no account and never use this feature.

## Out of scope

- **Self-registration.** Staff accounts are created by invite only; there is no sign-up endpoint and
  none should be added. The invite fields exist on `User` but the invite flow is **not built yet**.
- **Role-based permissions.** `ADMIN` and `SUPER_ADMIN` have the same permissions today.
- **Consumer accounts.**

## Data model

`prisma/schema/user.prisma`

- **User** — `email` (unique), `password` (bcrypt hash), `firstName`, `lastName`, `role`
  (`ADMIN` | `SUPER_ADMIN`), `isActive`, `isEmailVerified`, invite fields (`invitedById`,
  `invitationTokenHash`, `lastInvitationSentAt`).
- **RefreshToken** — one row per session: `tokenHash`, `expiresAt`, `revokedAt`. The raw token is
  never stored.
- **PasswordResetToken** — `tokenHash`, `expiresAt`, `usedAt`.

Seeded users (`prisma/seeds/user.ts`, password `!Qwer1234`): one active admin, one inactive admin, one
active super admin.

## Tokens & session

- **Access token** — JWT, short-lived (`JWT_ACCESS_EXPIRES`), returned in the response body. The FE
  sends it as `Authorization: Bearer <token>`.
- **Refresh token** — JWT, long-lived (`JWT_REFRESH_EXPIRES`), sent only as an httpOnly cookie
  (`refreshToken`, `SameSite=Lax`, `Secure` + shared `COOKIE_DOMAIN` in production). The cookie's
  `Max-Age` comes from the token's own `exp`, so both expire together.
- **Rotation** — every `/auth/refresh` revokes the presented refresh token and issues a new pair. A
  token that was already revoked (or unknown) is rejected, so a stolen, already-used token can't be
  replayed.
- **Session** = one non-revoked, non-expired `RefreshToken` row.

## Business rules

1. Sign-in fails with the same message ("Invalid email or password") whether the email doesn't exist
   or the password is wrong; a dummy bcrypt compare runs for unknown emails so timing doesn't leak
   which.
2. An inactive user (`isActive = false`) cannot sign in or refresh ("This account has been disabled",
   401).
3. **401 means only "access token missing/invalid/expired"** on authenticated routes — the FE refreshes
   and retries on it. Business-rule failures use 400/403/404 (e.g. wrong current password on
   change-password → 400).
4. New passwords (change/reset) must be at least 8 chars with upper, lower, digit and symbol, and
   match `confirmPassword`. On change, the new one must differ from the current one.
5. **Change password** revokes all the user's other sessions; the current one stays signed in.
6. **Forgot password** always answers success, even for an unknown email (with a short delay), so it
   can't be used to discover accounts. It emails a link to
   `${FRONTEND_URL}/admin/reset-password?token=...`, valid for `RESET_TOKEN_EXPIRES`.
7. **Reset password** works once per token. It sets the new password, marks the token used, revokes
   **all** sessions, and signs the user in (returns a new token pair).
8. Change/forgot/reset password are rate-limited (5 per 15 min in production).
9. Never log passwords or raw tokens; log only hashes/ids.
10. Revoked, used or expired tokens are deleted once they are more than 7 days past that point. The
    cleanup runs on server start, then every 24 hours (`auth.cleanup.ts`).

## Endpoints

All under `/auth` on the public router (they must work without an access token). "Bearer" = needs
`authenticate`.

| Method | Path                    | Auth   | What                                                  |
| ------ | ----------------------- | ------ | ----------------------------------------------------- |
| POST   | `/auth/sign-in`         | —      | Email + password → user + access token; sets cookie   |
| POST   | `/auth/sign-out`        | —      | Revokes the cookie's refresh token; clears cookie     |
| POST   | `/auth/refresh`         | cookie | Rotates the refresh token; returns a new access token |
| GET    | `/auth/me`              | Bearer | Current user (no password)                            |
| POST   | `/auth/change-password` | Bearer | Change password; revokes other sessions               |
| POST   | `/auth/forgot-password` | —      | Email a reset link                                    |
| POST   | `/auth/reset-password`  | —      | Reset with token; revokes all sessions; signs in      |
| GET    | `/auth/sessions`        | Bearer | List active sessions, flagging the current one        |
| DELETE | `/auth/sessions/:id`    | Bearer | Revoke one session (404 if not yours / not active)    |
| DELETE | `/auth/sessions`        | Bearer | Revoke all sessions except the current one            |

Shapes: OpenAPI at `/docs`.

## Interactions

- Every `/admin/*` route is protected by `authenticate`, applied once on `adminRoutes` (`src/routes.ts`).
- FE: silent refresh on 401 + retry once — see `tripsurance-fe/AGENTS.md` → "API & session contract".

## Known gaps

- Invite flow (create staff account + set password) not built.
- FE screens for sessions and change-password are deferred (see `ROADMAP.md` backlog).
