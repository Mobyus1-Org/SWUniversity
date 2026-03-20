# Overview
A server side system to create, read, and update users via MongoDB Atlas. The UI should also have pieces to sign up, log in, and change password.

# Requirements
## Features
- FEAT-1: Able to create a user via sign up process by providing username, email, and password.
- FEAT-2: Able to log in with created credentials via username and password.
- FEAT-3: Able to save a cookie via a "Remember Me" checkbox. Disclaimer is displayed below checkbox to remind users that a cookie will be saved to their browser (standard practice).
- FEAT-4: Able to change password from user profile page.
- FEAT-5: For now, only block the /internal/* paths from non-Admin logins. all other pages should remain public.
- FEAT-6: User can log out and session is disposed client-side and server-side.
- FEAT-7: Non-authenticated users that try to access protected routes are redirected to the homepage.
- FEAT-8: Authenticated non-Admin users that try to access protected routes are redirected to the homepage.

## Data
- DATA-1: users model as follows:
```json
{
  "username": "string",
  "email": "string",
  "passwordHash": "string",
  "role": "string",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```
- DATA-2: roles as one of `["user", "admin"]`
- DATA-3: use `bcrypt.hash(password + process.env.CRYPTO_PEPPER_CURRENT, 12)` for hashing passwords before storing them.
- DATA-4: use Mongoose for ORM between app and DB
- DATA-5: `email` is required. trimmed, lowercased. does not have to be unique.
- DATA-6: `username` is required. trimmed and unique.
- DATA-7: default `role` on signup is `"user"`

## Security
- SEC-1: Never store or log plaintext passwords.
- SEC-2: Password verification uses bcrypt compare against `passwordHash`.
- SEC-3: Login errors must not reveal whether email/username exists.
- SEC-4: Rate-limit login attempts per IP + account identifier.
- SEC-5: Session cookie must be `httpOnly`, `secure` (in prod), `sameSite=lax` or stricter.
- SEC-6: Changing password requires valid current password.
- SEC-7: On password change, invalidate existing sessions.
- SEC-8: Require env vars `MONGO_CONNECTION_STRING`, `CRYPTO_PEPPER_CURRENT`, `SESSION_SECRET`; optionally allow `CRYPTO_PEPPER_PREVIOUS` during pepper rotation.

## Authoriztion
- AUTHZ-1: Enforce admin checks server-side for `/internal/*` page requests.
- AUTHZ-2: Enforce admin checks for all related API endpoints (not just UI routing).

# Validation
