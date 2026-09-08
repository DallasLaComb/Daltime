# E2E / Smoke Suite Blueprint

## What this suite covers

This suite is the post-deploy safety net for the DalTime application. It is NOT a
full-coverage test suite. Its job is to answer one question after every deployment:
"Is the deployed application alive and can all four roles authenticate and reach their
respective API routes?"

The suite consists of exactly 7 smoke checks:

| #   | Check           | What it proves                                                                                                                                  |
| --- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Frontend loads  | CloudFront is serving index.html; S3 bucket policy and distribution are healthy                                                                 |
| 2   | Health endpoint | API Gateway and the HealthFunction Lambda are alive; the JSON response shape is correct                                                         |
| 3   | WebAdmin auth   | `robot-dev@daltime.com` can authenticate via Cognito and call `/web-admin/employees`; the JWT authorizer rejects unauthenticated calls with 401 |
| 4   | OrgAdmin auth   | `alex.admin@sunsetcafe.dev` can authenticate and call `/org-admin/profile`                                                                      |
| 5   | Manager auth    | `morgan.manager@sunsetcafe.dev` can authenticate and call `/manager/profile`; response has `first_name` and `last_name`                         |
| 6   | Employee auth   | `sam.smith@sunsetcafe.dev` can authenticate and call `/employee/profile`                                                                        |
| 7   | Role isolation  | The Manager's token is rejected on `/employee/profile` with HTTP 403                                                                            |

## Which environments the suite runs against

The suite is environment-agnostic — it reads all URLs and credentials from environment
variables. DevOps-agent wires the suite into the CD workflow so it runs:

- After every successful deploy to **dev** (branch: `dev`)
- After every successful deploy to **qa** (branch: `qa`)
- After every successful deploy to **prod** (branch: `main`)

The suite must never run against a local SAM-local instance or against another
team's production environment. The synthetic test users (see below) must exist in
the Cognito User Pool of the target environment before the suite can pass there.

## Which seeded user each role test uses

All test users are created by `backend/scripts/seed-dev.mjs`. The same set must be
seeded into qa and prod Cognito pools before the suite runs there. See `e2e/README.md`
for the full roster and the seeding prerequisite.

| Role     | Email used by the suite                                                        |
| -------- | ------------------------------------------------------------------------------ |
| WebAdmin | `robot-dev@daltime.com` — a dedicated CI robot account, not a personal account |
| OrgAdmin | `alex.admin@sunsetcafe.dev`                                                    |
| Manager  | `morgan.manager@sunsetcafe.dev`                                                |
| Employee | `sam.smith@sunsetcafe.dev` (Tier 4, 5-day availability — most stable)          |

## How credentials are injected

No credential is ever hardcoded. The suite reads six environment variables at import
time (via `e2e/src/config.ts`). If any variable is missing, the suite throws
immediately with a human-readable error message rather than failing mid-test with a
confusing auth error.

| Variable                 | Purpose                                               |
| ------------------------ | ----------------------------------------------------- |
| `FRONTEND_BASE_URL`      | Base URL for the Angular frontend (CloudFront domain) |
| `API_BASE_URL`           | Base URL for API Gateway (no trailing slash)          |
| `COGNITO_CLIENT_ID`      | Cognito App Client ID                                 |
| `COGNITO_USER_POOL_ID`   | Cognito User Pool ID                                  |
| `COGNITO_REGION`         | AWS region, e.g. `us-east-1`                          |
| `E2E_SEED_USER_PASSWORD` | Shared password for all seeded test users             |

## How the Cognito headless auth flow works

The suite uses the **USER_PASSWORD_AUTH** flow (no browser, no PKCE, no redirect URI).
This is the simplest Cognito auth flow for automated testing:

1. The `getCognitoToken(email, password, clientId, userPoolId, region)` function in
   `e2e/src/auth.ts` sends an `InitiateAuthCommand` to Cognito.
2. Cognito validates the credentials and returns an `AuthenticationResult` containing
   `IdToken`, `AccessToken`, and `RefreshToken`.
3. The suite extracts the `IdToken` (a signed JWT) and passes it to each API call as
   `Authorization: Bearer <IdToken>`.
4. API Gateway's JWT authorizer validates the token against the User Pool's JWKS endpoint
   and extracts the `cognito:groups` claim to enforce role-scoped access.

The USER_PASSWORD_AUTH flow must be enabled on the Cognito App Client in each
environment. There is no MFA requirement on the seeded test users.

Tokens are obtained fresh per test — there is no file-based or in-memory token cache
between tests. This means each authenticated test independently proves that Cognito is
alive and the user's credentials are valid in the target environment.

## Test runner choice and rationale

**vitest** was chosen because:

- It is already used in the backend (`backend/vitest.config.ts`) — no new tooling to
  learn or maintain.
- It supports ESM natively, matching the project's Node 24 / ESM-first stack.
- It exits non-zero on any test failure by default — no special configuration needed
  to make the CD workflow step fail visibly.
- It is significantly lighter than Jest and starts faster, which matters for post-deploy
  checks where the goal is fast feedback.

**undici** is used as the HTTP client because:

- It is Node's underlying HTTP client (used by the built-in `fetch`), so it has no
  external dependencies beyond the Node runtime.
- The suite uses the `fetch` export from `undici` (which matches the Web Fetch API
  surface) so the tests read naturally and can be switched to native `fetch` when the
  Node 24 built-in fetch is fully stable in CI.

Browser-based testing tools (Playwright, Cypress) are explicitly excluded from this
initial suite. The smoke checks are pure HTTP calls — no DOM interaction, no
JavaScript execution, no browser rendering. This keeps the suite fast and dependency-
free. Browser-based E2E is a future story.

## How to add new tests

1. Add a new `describe` block in `e2e/src/tests/smoke.test.ts` (or create a new test
   file in `e2e/src/tests/` — vitest discovers all `*.test.ts` files automatically).
2. Use `getToken(email)` from the existing helper to obtain a fresh Cognito token for
   any of the seeded users.
3. Use `fetch` from `undici` for all HTTP calls.
4. Import URLs and config from `e2e/src/config.ts` — never reference `process.env`
   directly in a test file.
5. All new checks should be read-only (GET) — no writes, creates, or deletes against
   seeded data.
6. After adding a test, run it locally against dev to verify it passes:
   ```
   cd e2e && npm install && \
     FRONTEND_BASE_URL=https://dev.daltime.com \
     API_BASE_URL=<api-gateway-url> \
     COGNITO_CLIENT_ID=<client-id> \
     COGNITO_USER_POOL_ID=<pool-id> \
     COGNITO_REGION=us-east-1 \
     E2E_SEED_USER_PASSWORD=<password> \
     npm test
   ```
