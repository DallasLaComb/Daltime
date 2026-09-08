# Snyk Implementation Plan

**Author context:** Produced by inspecting the live repository — `package.json`/lockfiles in `.`, `frontend/`, `backend/`; `.github/workflows/{ci,cd,foundation,sonarcloud}.yml`; `infra/{template,foundation}.yaml`; `.husky/`, `.lintstagedrc.mjs`, `.secretlintrc.json`; `robot/` (E2E). No Dockerfiles, Terraform, or Kubernetes manifests exist in this repo — those product areas are scoped out below with reasoning, not assumed.

---

## 1. Executive Summary

DalTime is a two-package npm project (`frontend/` — Angular 21, `backend/` — Node 24 AWS Lambda via SAM) deployed entirely as **serverless infrastructure** (API Gateway + 22 Lambda functions + DynamoDB + S3/CloudFront + Cognito). There are **no containers, no Terraform, no Kubernetes** — so Snyk Container has no current target, and Snyk IaC's scope is exactly two CloudFormation/SAM templates (`infra/template.yaml`, `infra/foundation.yaml`).

The repo already has a reasonable security baseline: `npm audit --audit-level=high` in CI, CodeQL SAST, Checkov IaC scanning, secretlint on every commit via Husky/lint-staged, and SonarCloud on `main`. The biggest gap is **structural, not tooling**: **no workflow in this repo triggers on `pull_request`**. Every check (tests, `npm audit`, CodeQL, Checkov, SonarCloud) runs only after code lands on `main` or `dev`/`qa`. There is also no branch protection configured (`main` returns 404 for protection rules) and no Dependabot/Renovate. This means "shift-left" currently has no left edge to shift to — the first Snyk workflow this plan introduces (the PR workflow) will be the **first pre-merge gate of any kind** in this repository.

This plan:
1. Documents the current posture precisely (so nothing is assumed).
2. Maps each Snyk product to a real target in this repo — or explicitly rules it out with reasoning (Container).
3. Designs three workflows (PR / main branch / scheduled) that slot into the existing CI/CD shape rather than replacing it.
4. Recommends severity thresholds per stage, with reasoning tied to this codebase's actual risk profile (multi-tenant scheduling SaaS handling employee PII, Cognito auth, DynamoDB single-table design).
5. Lays out a 4-phase rollout that starts in monitor-only mode and tightens gates only once the baseline is triaged — avoiding a "big bang" that blocks the solo/small-team workflow this repo is clearly built around (see `cd.yml` comments: "MVP — direct to main").

---

## 2. Current Security Posture — Assessment

### 2.1 Repository shape (verified)

| Area | Finding |
|---|---|
| Package manifests | 3: root (`devDependencies` only — prettier/lint-staged/secretlint), `frontend/package.json` (Angular 21.2, `@aws-sdk/client-cognito-identity-provider`), `backend/package.json` (Node 24, `@aws-sdk/*` v3, esbuild-bundled Lambdas) |
| Lockfiles | `package-lock.json` ×3 (root, frontend, backend) — all npm, all committed (despite `*.lock` in `.gitignore`, `package-lock.json` is explicitly tracked) |
| Dockerfiles | **None.** Lambdas run on the managed `nodejs24.x` runtime, bundled with esbuild via `sam build`. No container images are built or pushed anywhere in the pipeline. |
| IaC | `infra/template.yaml` (1,764 lines — SAM template defining 22 Lambda functions, HTTP API, DynamoDB single-table, log groups, IAM) and `infra/foundation.yaml` (442 lines — S3, CloudFront, Cognito, ACM) |
| Terraform / Kubernetes | **None present.** |
| CI/CD | GitHub Actions: `ci.yml` (push→main: frontend tests, backend tests, CodeQL, Checkov+cfn-lint), `cd.yml` (push→dev/qa, OIDC deploy to AWS), `foundation.yaml` (manual, one-time per-env stack), `sonarcloud.yml` (push→main) |
| E2E | `robot/` — Python/Robot Framework, has its own `requirements.txt` and per-environment `.env*` files (only `.env.example` and `env.robot` are tracked; real `.env*` files are gitignored) |
| Shared frontend lib | `@common-daltime` is a **TypeScript path alias** (`frontend/tsconfig.json` → `src/app/shared/components/index.ts`), not a separate published package — so this is effectively a 2-project setup, not an npm-workspaces monorepo. No special monorepo tooling (Nx/Turborepo/Lerna) is present. |

### 2.2 Existing security tooling (don't duplicate — integrate around it)

- **`npm audit --audit-level=high`** — runs in `ci.yml` for both frontend and backend, blocking on high+critical. This is direct-dependency-tree only, no license checks, no continuous monitoring, no PR-time feedback (only runs post-merge to `main`).
- **CodeQL** (`github/codeql-action` v4, `javascript-typescript`) — SAST, results to the Security tab, post-merge only.
- **Checkov** (`bridgecrewio/checkov-action` pinned to SHA) — IaC scanning for both `infra/template.yaml`/`foundation.yaml`, `soft_fail: true` (non-blocking) with explicit `skip_check` list and inline reasoning comments for each skip — this is a good model to mirror for Snyk IaC policy decisions.
- **secretlint** (`@secretlint/secretlint-rule-preset-recommend`) — runs on **every staged file** via Husky pre-commit + lint-staged, with a `.secretlintignore`. This is the repo's actual first line of defense against committed secrets, and it already runs pre-commit (the earliest possible point).
- **SonarCloud** — full reliability/security/maintainability/coverage scan, `main` only (free-tier constraint per the workflow's own comment).
- **cfn-lint** — template linting (not security, but catches malformed SAM/CFN before Checkov runs).

**Implication:** Snyk Code would be the *third* SAST tool (after CodeQL and SonarCloud) and Snyk IaC the *second* IaC tool (after Checkov). Running all of them on every PR is real friction for no proportional gain. Section 4 recommends a clear division of labor rather than blind stacking.

### 2.3 Gaps relative to the stated goals

1. **No pre-merge gate of any kind.** Confirmed: `grep -l pull_request .github/workflows/*.yml` returns nothing, and `main` has no branch protection (`gh api .../branches/main/protection` → 404). Every scan in the repo today runs *after* code is already on a long-lived branch.
2. **No transitive dependency depth or license compliance.** `npm audit` reports on the resolved tree but DalTime has no license-compliance policy anywhere (no `LICENSE` allow/deny list, no `license-checker` config).
3. **No continuous monitoring** of dependencies between CI runs — a CVE disclosed the day after a merge to `main` won't surface until the next push triggers `npm audit` again.
4. **No SBOM generation** anywhere in the pipeline — relevant given this handles employee PII (names, schedules, availability) and sits behind Cognito auth; an SBOM is increasingly an audit/compliance ask for SaaS handling personal data.
5. **No automated dependency-update mechanism** (no Dependabot/Renovate config found) — vulnerabilities get *detected* by `npm audit`/CodeQL but nothing proposes the fix.
6. **No SARIF-based PR annotation** — CodeQL results land in the Security tab but nothing currently surfaces inline PR review comments for any class of finding.
7. **Secrets management is good at commit-time, blind at scan-time.** secretlint runs pre-commit, but there's no historical/Org-wide secret-scanning equivalent in CI (GitHub secret scanning may or may not be enabled at the org level — outside this repo's config to verify).

### 2.4 Highest-risk areas (reasoning, not guesswork)

Ranked by blast radius if compromised:

1. **`backend/` — 22 Lambda functions behind Cognito, single DynamoDB table, multi-tenant (org/manager/employee roles).** A dependency or code-level vuln here is the highest-impact target: it's the data-access layer for PII across every tenant. `@aws-sdk/client-dynamodb` and `@aws-sdk/client-cognito-identity-provider` are exactly the kind of "looks safe, AWS-maintained" packages whose *transitive* deps (e.g., `smithy-*`, credential-resolution chains) are worth Snyk's deeper transitive-tree visibility beyond `npm audit`.
2. **`infra/template.yaml` (1,764 lines, 22 functions, IAM policies, API Gateway routes).** A misconfigured IAM policy or open route here is a direct path to data exposure — and it's large/complex enough that manual review alone is unreliable. Checkov already covers this; Snyk IaC's value-add is cross-referencing against a continuously updated rule set and surfacing results in the same dashboard as the OSS/Code findings (single pane of glass).
3. **`frontend/` Cognito integration** (`@aws-sdk/client-cognito-identity-provider` in the browser bundle). Frontend dependency vulnerabilities ship directly to end users; this is the supply-chain surface with the largest blast radius per-vulnerability (every visitor's browser executes it).
4. **`robot/` E2E credentials** — `.env*` files contain "emails, subs, passwords" per the `.gitignore` comment. These are gitignored correctly, but they're a standing reminder that test credentials exist in the dev environment; worth folding into the secrets-management conversation even though it's Python/out of Snyk's typical npm-centric scope.

### 2.5 Supply-chain risk specifics

- Both `frontend` and `backend` pull `@aws-sdk/*` v3 packages independently with slightly different version ranges (`^3.991.0` vs `^3.1024.0`/`^3.995.0`) — drift between the two is itself worth tracking (not a vuln, but a maintenance signal Snyk's continuous monitoring will surface as version-skew over time).
- `esbuild` is a backend devDependency used both for local SAM builds and bundling — esbuild has had real advisories historically (e.g., dev-server CORS issues); it's exactly the kind of build-tool dependency `npm audit --audit-level=high` *would* catch but that benefits from continuous monitoring between CI runs.
- No lockfile integrity verification step beyond `npm ci` (which does verify against the lockfile) — that's actually sufficient; no change needed there.

### 2.6 Secret-management assessment

Already strong at the point closest to the developer (pre-commit secretlint + `.secretlintignore`). The one open question Snyk doesn't need to solve but this plan should flag: whether **GitHub secret scanning / push protection** is enabled at the org or repo level — that's a free, complementary control that catches what a developer might commit with `--no-verify`. (Outside the scope of "Snyk implementation," but worth a one-line mention in the rollout since it's a 30-second toggle with high payoff.)

---

## 3. Snyk Product Coverage — What Applies Here

### 3.1 Snyk Open Source (SCA) — **applies, high value**
- **Targets:** `package.json`/`package-lock.json` in root, `frontend/`, `backend/` (3 projects).
- **Transitive scanning:** This is Snyk OSS's core differentiator over `npm audit` — full dependency-graph resolution including nested/transitive packages, with reachability analysis (does the vulnerable function actually get called?) on supported ecosystems. Directly addresses gap 2.3.2.
- **License compliance:** DalTime has zero license policy today. Recommend starting in **report-only** mode (flag copyleft licenses — GPL/AGPL/LGPL — which are incompatible with a closed-source SaaS) and only gate once the existing tree is audited (a brand-new gate on day one would likely surface false "violations" in transitive deps that were always there).
- **Continuous monitoring:** `snyk monitor` on `main`-branch runs creates a point-in-time snapshot in the Snyk dashboard that gets re-evaluated against newly disclosed CVEs without needing a new commit — directly addresses gap 2.3.3.

### 3.2 Snyk Code (SAST) — **applies, but needs a division-of-labor decision**
- DalTime already runs **CodeQL** (post-merge, JS/TS) and **SonarCloud** (post-merge, `main` only, includes security hotspots). Adding Snyk Code as a *third* full SAST pass on every PR is real noise/friction for marginal gain.
- **Recommendation:** Use Snyk Code as the **PR-time, fast-feedback SAST** (it's typically faster than CodeQL's autobuild+analyze cycle and gives inline PR annotations natively), and let CodeQL continue as the **deep, post-merge, Security-tab-of-record** scan, with SonarCloud remaining the **code-quality + security-hotspot** layer on `main`. Don't run all three on every PR — that's exactly the kind of redundant-tool-stacking that increases friction without proportionally increasing signal. Revisit in Phase 4 once you have a few months of comparative signal-to-noise data from both CodeQL and Snyk Code to decide whether to consolidate to one.

### 3.3 Snyk Container — **does not apply; do not implement**
Verified: no `Dockerfile`, `docker-compose.yml`, or container-image build/push step exists anywhere in the repo or workflows. The backend is deployed as native `nodejs24.x` Lambda zip packages built by `sam build`/esbuild — there is no container image in the deployment path. **Implementing Snyk Container here would scan nothing and create a permanently-green, meaningless job.** If DalTime ever moves to container-image Lambdas (`PackageType: Image` in `infra/template.yaml`) or introduces a Dockerfile (e.g., for local dev parity or a future non-Lambda service), revisit this section — the workflow additions would be a small, isolated change at that point.

### 3.4 Snyk IaC — **applies, complements (not replaces) Checkov**
- **Targets:** `infra/template.yaml`, `infra/foundation.yaml` (both CloudFormation/SAM — confirmed via `Transform: AWS::Serverless-2016-10-31` and `AWSTemplateFormatVersion`).
- Checkov already runs in both `ci.yml` (template + foundation, `soft_fail: true`) and `foundation.yml` (foundation only, with a documented `skip_check` list and inline reasoning — e.g., "CKV_AWS_68: CloudFront WAF costs per-request — not appropriate for this project"). That's a mature, intentional posture, not an oversight.
- **Recommendation:** Run Snyk IaC as a **second opinion in monitor/report mode**, surfaced via SARIF into the same Security tab as Checkov's findings (GitHub de-dupes by rule+location reasonably well, and having two engines cross-check a 1,764-line template that defines IAM policies for 22 functions is genuinely valuable). Do **not** make Snyk IaC a blocking gate — Checkov already fills that role with a deliberately-tuned `skip_check` list; a second blocking IaC tool with a *different* default rule set would immediately reintroduce the exact noise the team already tuned Checkov to avoid.
- No Terraform, no Kubernetes — both confirmed absent, so those Snyk IaC sub-scopes are not configured.

---

## 4. CI/CD Integration Design

### 4.1 The structural fix this plan depends on

None of the goals ("catch vulnerabilities as early as possible," "fast feedback," "PR annotations") are achievable without a workflow that triggers on `pull_request`. **This plan's first concrete change is introducing `pull_request` triggers** — something the repo has never had. This is a bigger structural shift than "add Snyk," so it's called out explicitly: expect that the *first* PR opened after this lands will be the first PR in this repo's history to show any automated check before merge. Recommend pairing this with minimal branch protection (Section 7) so the new checks are actually enforced rather than cosmetic.

### 4.2 Pull Request Workflow (`snyk-pr.yml`) — new file

**Goal:** fast, scoped, annotated feedback on exactly what changed.

- **Trigger:** `pull_request` targeting `dev`, `qa`, `main` (matching the three long-lived branches in `cd.yml`/`ci.yml`).
- **Path filtering** so a frontend-only PR doesn't wait on a backend SCA scan and vice versa (this directly serves "minimize developer friction" — a docs-only PR triggers nothing).
- Runs **Snyk Open Source** (`snyk test`) and **Snyk Code** (`snyk code test`) per affected project, plus **Snyk IaC** (`snyk iac test`) only when `infra/**` changes.
- **SARIF output** (`--sarif-file-output`) uploaded via `github/codeql-action/upload-sarif` (already a dependency of this repo's toolchain — no new action family to learn) → results land in the same Security tab as CodeQL/Checkov, and **inline PR annotations** come from the SARIF-to-PR integration GitHub provides natively once `security-events: write` is granted.
- **Severity threshold:** gates on `--severity-threshold=high` (see Section 5 reasoning) — fails fast on the worst, doesn't block on every transitive low-severity advisory during active development.
- Uses `continue-on-error` on the Snyk Code step relative to CodeQL coexisting (see 3.2) — Snyk Code reports here for fast feedback and PR comments; CodeQL remains the system of record post-merge. (Once Phase 4 data informs a consolidation decision, flip which one gates.)

### 4.3 Main Branch Workflow (`snyk-main.yml`) — new file

**Goal:** the thorough pass + the persistent monitoring snapshot.

- **Trigger:** `push` to `main` (mirrors `ci.yml`/`sonarcloud.yml` exactly — same branch, same moment, so results land alongside the SonarCloud scan for that commit).
- Runs full-depth **`snyk test`** (OSS, all projects, no path filtering — the complete graph), **`snyk code test`** (full SAST), **`snyk iac test`** (both templates), **and `snyk monitor`** for each project — `monitor` is what creates the continuously-re-evaluated snapshot in the Snyk dashboard (directly closes gap 2.3.3: a CVE disclosed next week against a dependency merged today will now surface without a new push).
- No Container job (Section 3.3 — nothing to scan). If/when container images enter the picture, this is the workflow that gains a `snyk container test && snyk container monitor` job.
- **Severity threshold:** `--severity-threshold=medium` — broader net than the PR gate because this is the audit-of-record pass, not a merge gate (failure here means "investigate," not "you can't ship" — the code already shipped).

### 4.4 Release Workflow — folded into existing `cd.yml`, not a new file

DalTime doesn't have a separate "release" concept distinct from its environment-promotion model (`dev` → `qa` → `main`, each via `cd.yml`, each gated by the prior environment's CI/CD success per the detailed comments in that file). Inventing a fourth, parallel "release workflow" would fight the grain of a deliberately-designed promotion pipeline. Instead:

- **Add a `snyk-gate` job to `cd.yml`** that runs immediately after the existing artifact-resolution step and before `Deploy SAM stack` / `Sync frontend to S3`, scoped to **`--severity-threshold=critical`** only (Section 5 reasoning) — this is the actual release gate, and it's where "fail builds only when appropriate" matters most: a deploy to `main` (production) is the one place a critical, actively-exploitable vulnerability should hard-block, while the PR/main-branch workflows stay more permissive to avoid freezing day-to-day development over findings that need triage time.
- **SBOM generation**: add `snyk sbom --format=cyclonedx1.4+json` as a step in `cd.yml` for the `main` deploy only, uploaded as a workflow artifact (mirrors the existing `frontend-build`/`sam-build` artifact pattern already in `ci.yml`/`cd.yml` — same `actions/upload-artifact` action, same retention convention). This produces an auditable, point-in-time bill of materials for every production release without adding a new artifact-handling pattern to learn.
- **Container verification**: not applicable (3.3) — omitted, with the same revisit note.

### 4.5 Scheduled Scan Workflow (`snyk-scheduled.yml`) — new file

**Goal:** catch newly-disclosed CVEs against code that hasn't changed (the gap continuous `monitor` mostly closes, but a scheduled `test` run is the belt-and-suspenders check that also re-validates IaC and license posture on a cadence independent of commit activity).

- **Trigger:** `schedule` (cron) — recommend **weekly**, not daily: this is a 3-project npm codebase with moderate dependency churn (per the `@aws-sdk/*` version-drift noted in 2.5), not a high-velocity polyglot monorepo. Daily would be noise; monthly would be too slow for a CVE-disclosure response. Weekly, early Monday UTC (before the work week starts), balances "catch it soon" against "don't generate a report nobody reads on a Saturday."
- Runs the same full-depth `snyk test` + `snyk iac test` as the main-branch workflow, but **report-only** (no failure exit code — `|| true` pattern, consistent with how Checkov's `soft_fail: true` already signals "inform, don't block" in this repo) — its job is to produce a dashboard/report artifact, not to fail a build that didn't change.
- Also a natural home for a **license-compliance summary** report (Section 3.1) once that policy graduates from report-only to something worth tracking on a cadence.

---

## 5. Security Policies — Severity Thresholds

| Stage | Critical | High | Medium | Low | Reasoning |
|---|---|---|---|---|---|
| **PR builds** | **Block** | **Block** | Report (annotate, don't fail) | Report only | A PR gate that blocks on medium/low in a codebase with **zero existing PR gates** would instantly become the thing developers route around (force-push, `--no-verify`, direct pushes to `dev`). Blocking on high+critical catches the findings that matter while the team builds trust in the new gate. Medium/low surface as PR annotations (still visible, still actionable, just not merge-blocking) so they don't silently disappear — they become Phase-2-and-later backlog, not invisible. |
| **Main branch** | **Block** (via `monitor` alerting + next-PR gate) | Report/Alert | Report | Report | Code is already merged by the time this runs — "blocking" here means "alert loudly and open a tracked issue," not "revert the merge." Critical findings should page/notify (via Snyk's GitHub integration or a follow-up issue-creation step) because they represent the highest-confidence "this is actively bad" signal, but the *enforcement* point has already passed — the next PR's gate (5.1) is where the fix gets required. |
| **Production releases (`cd.yml` → `main`)** | **Block (hard gate, `--severity-threshold=critical`)** | Report + require sign-off (manual `workflow_dispatch` override path, logged) | Report | Report | This is the one place "fail builds only when appropriate" earns its keep: production is the only environment where a critical, exploitable vulnerability shipping to real users (handling employee PII) justifies blocking a deploy outright. High-severity findings get surfaced prominently but don't auto-block — many "high" CVEs are theoretical in this context (e.g., a high-severity advisory in a dev-only transitive dependency that never ships). A hard high-severity gate on every prod deploy would, in practice, become a thing people learn to `--force` past, which is worse than a calibrated medium-strictness gate people actually respect. |

**Why not block on Medium/Low anywhere initially:** `npm audit --audit-level=high` already exists and is the team's chosen baseline — this plan respects that prior decision rather than silently overriding it with a stricter Snyk default. Once Phase 2's baseline triage (Section 9) is complete and the existing-vulnerability backlog is either fixed or explicitly accepted/ignored in `.snyk` policy files, thresholds can be tightened — that's a Phase 4 conversation informed by real data, not a day-one assumption.

---

## 6. GitHub Actions — Generated Workflows

Three new workflow files are added (alongside the existing `ci.yml`/`cd.yml`/`foundation.yml`/`sonarcloud.yml`, none of which are modified except `cd.yml` gaining one new job per Section 4.4). All three:

- Use **least-privilege `permissions:`** blocks (mirrors the explicit, minimal `permissions:` blocks already present in every existing workflow in this repo — e.g., `ci.yml`'s CodeQL job grants only `security-events: write` + `contents: read`).
- Pin third-party actions to **version tags matching this repo's existing convention** (the repo mixes pinned-SHA for some actions — e.g. `bridgecrewio/checkov-action@dfb51aed...# v12`, `aws-actions/setup-sam@89ddb14d...# v3` — and version tags for others — `actions/checkout@v6.0.2`). The Snyk actions below use version tags with the SHA-pinning convention noted inline; **resolve and pin the exact SHA before merging**, the same way the existing Checkov/SAM actions are pinned (e.g. `gh api repos/snyk/actions/git/refs/tags/<tag>` to get the commit SHA, matching how this repo already pins its other third-party actions).
- Reuse the **exact same `actions/setup-node@v6.3.0` + `cache: npm` + `cache-dependency-path` pattern** already in `ci.yml`/`sonarcloud.yml` — no new caching strategy introduced.
- Support the **monorepo shape** via explicit `working-directory` per project (mirrors every existing job in `ci.yml`).

### 6.1 `snyk-pr.yml` — Pull Request feedback

```yaml
# Fast, scoped Snyk feedback on pull requests targeting the long-lived branches.
# This is the FIRST pre-merge check of any kind in this repo (verified: no existing
# workflow triggers on pull_request, and `main` has no branch protection). Pair this
# with the branch-protection recommendation in the implementation plan so these checks
# are enforced rather than advisory-only.
name: Snyk — Pull Request

on:
  pull_request:
    branches: [dev, qa, main]
    # Path filters keep a frontend-only change from waiting on a backend scan and
    # vice versa — directly serves "minimize developer friction."
    paths:
      - 'frontend/**'
      - 'backend/**'
      - 'infra/**'
      - 'package.json'
      - 'package-lock.json'
      - '.github/workflows/snyk-*.yml'

# Cancel superseded runs on the same PR — same pattern as cd.yml's concurrency group,
# applied here so force-pushes during review don't queue redundant scans.
concurrency:
  group: snyk-pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true

permissions:
  contents: read          # checkout only
  security-events: write  # required to upload SARIF to the code-scanning API
  pull-requests: write    # required for Snyk's inline PR annotations/comments

jobs:
  # ── Detect which projects changed, so unaffected projects are skipped entirely ──
  changes:
    name: Detect changed projects
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      frontend: ${{ steps.filter.outputs.frontend }}
      backend: ${{ steps.filter.outputs.backend }}
      infra: ${{ steps.filter.outputs.infra }}
    steps:
      - uses: actions/checkout@v6.0.2
      - name: Path filter
        id: filter
        uses: dorny/paths-filter@v3   # resolve & pin to SHA before merging, per repo convention
        with:
          filters: |
            frontend:
              - 'frontend/**'
              - 'package-lock.json'
            backend:
              - 'backend/**'
              - 'package-lock.json'
            infra:
              - 'infra/**'

  # ── Snyk Open Source + Snyk Code: frontend ──
  frontend-snyk:
    name: Snyk scan — frontend
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v6.0.2

      - name: Setup Node.js
        uses: actions/setup-node@v6.3.0
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: frontend

      - name: Setup Snyk CLI
        uses: snyk/actions/setup@master   # resolve & pin to SHA before merging, per repo convention
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      # Open Source: full transitive dependency graph + license policy.
      # --severity-threshold=high means medium/low are reported (and annotated) but
      # do not fail the job — see Section 5 of the implementation plan for reasoning.
      - name: Snyk Open Source (SCA)
        working-directory: frontend
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk test \
            --severity-threshold=high \
            --org=${{ vars.SNYK_ORG_ID }} \
            --sarif-file-output=snyk-oss.sarif

      # Code: PR-time SAST. Coexists with (does not replace) the post-merge CodeQL
      # scan already in ci.yml — see Section 3.2 for the division-of-labor reasoning.
      - name: Snyk Code (SAST)
        working-directory: frontend
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk code test \
            --severity-threshold=high \
            --org=${{ vars.SNYK_ORG_ID }} \
            --sarif-file-output=snyk-code.sarif

      # Always upload SARIF, even if the scan step above failed the job — partial
      # results are still actionable, and this is what powers inline PR annotations
      # via the Security tab integration (security-events: write, granted above).
      - name: Upload Open Source SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: frontend/snyk-oss.sarif
          category: snyk-oss-frontend

      - name: Upload Code SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: frontend/snyk-code.sarif
          category: snyk-code-frontend

  # ── Snyk Open Source + Snyk Code: backend ──
  backend-snyk:
    name: Snyk scan — backend
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v6.0.2

      - name: Setup Node.js
        uses: actions/setup-node@v6.3.0
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: backend

      - name: Setup Snyk CLI
        uses: snyk/actions/setup@master   # resolve & pin to SHA before merging, per repo convention
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Snyk Open Source (SCA)
        working-directory: backend
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk test \
            --severity-threshold=high \
            --org=${{ vars.SNYK_ORG_ID }} \
            --sarif-file-output=snyk-oss.sarif

      - name: Snyk Code (SAST)
        working-directory: backend
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk code test \
            --severity-threshold=high \
            --org=${{ vars.SNYK_ORG_ID }} \
            --sarif-file-output=snyk-code.sarif

      - name: Upload Open Source SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: backend/snyk-oss.sarif
          category: snyk-oss-backend

      - name: Upload Code SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: backend/snyk-code.sarif
          category: snyk-code-backend

  # ── Snyk IaC: only when infra/ changes ──
  # Runs alongside (not instead of) the existing Checkov scan in ci.yml — see
  # Section 3.4 for why this stays in report/monitor mode rather than gating.
  infra-snyk:
    name: Snyk IaC scan
    needs: changes
    if: needs.changes.outputs.infra == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v6.0.2

      - name: Setup Snyk CLI
        uses: snyk/actions/setup@master   # resolve & pin to SHA before merging, per repo convention
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      # Report-only (`|| true`): Checkov is the existing, deliberately-tuned IaC
      # gate (see its skip_check list with inline reasoning in ci.yml/foundation.yml).
      # Snyk IaC runs as a second-opinion cross-check, not a competing gate — adding
      # a second blocking IaC tool with a different default ruleset would reintroduce
      # exactly the noise the team already tuned Checkov to avoid.
      - name: Snyk IaC scan (report-only)
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk iac test infra/template.yaml infra/foundation.yaml \
            --org=${{ vars.SNYK_ORG_ID }} \
            --sarif-file-output=snyk-iac.sarif || true

      - name: Upload IaC SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: snyk-iac.sarif
          category: snyk-iac
```

### 6.2 `snyk-main.yml` — Main branch (full-depth + continuous monitoring)

```yaml
# Full-depth Snyk scan + continuous monitoring snapshot, run on every push to `main`
# — same trigger as ci.yml and sonarcloud.yml, so all three land on the same commit
# and surface together in the Security tab / SonarCloud dashboard / Snyk dashboard.
name: Snyk — Main Branch

on:
  push:
    branches: [main]

permissions:
  contents: read
  security-events: write

jobs:
  # ── Full-depth scan + monitor: frontend ──
  frontend-snyk:
    name: Snyk full scan — frontend
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v6.0.2

      - name: Setup Node.js
        uses: actions/setup-node@v6.3.0
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: frontend

      - name: Setup Snyk CLI
        uses: snyk/actions/setup@master   # resolve & pin to SHA before merging, per repo convention
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      # Broader net than the PR gate (medium vs. high) — this is the audit-of-record
      # pass; a failure here means "investigate and triage," not "the merge is blocked"
      # (the code is already on main). See Section 5 for full reasoning.
      - name: Snyk Open Source — full dependency graph
        working-directory: frontend
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk test \
            --severity-threshold=medium \
            --org=${{ vars.SNYK_ORG_ID }} \
            --sarif-file-output=snyk-oss.sarif || true

      - name: Snyk Code — full SAST
        working-directory: frontend
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk code test \
            --severity-threshold=medium \
            --org=${{ vars.SNYK_ORG_ID }} \
            --sarif-file-output=snyk-code.sarif || true

      # `monitor` (not `test`) is what creates the persistent, continuously-re-evaluated
      # snapshot in the Snyk dashboard — closes the "CVE disclosed after merge" gap that
      # a point-in-time `test` alone cannot (Section 2.3, gap 3).
      - name: Snyk monitor — continuous tracking
        working-directory: frontend
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk monitor \
            --org=${{ vars.SNYK_ORG_ID }} \
            --project-name="daltime-frontend"

      - name: Upload Open Source SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: frontend/snyk-oss.sarif
          category: snyk-oss-frontend-main

      - name: Upload Code SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: frontend/snyk-code.sarif
          category: snyk-code-frontend-main

  # ── Full-depth scan + monitor: backend ──
  backend-snyk:
    name: Snyk full scan — backend
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v6.0.2

      - name: Setup Node.js
        uses: actions/setup-node@v6.3.0
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: backend

      - name: Setup Snyk CLI
        uses: snyk/actions/setup@master   # resolve & pin to SHA before merging, per repo convention
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Snyk Open Source — full dependency graph
        working-directory: backend
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk test \
            --severity-threshold=medium \
            --org=${{ vars.SNYK_ORG_ID }} \
            --sarif-file-output=snyk-oss.sarif || true

      - name: Snyk Code — full SAST
        working-directory: backend
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk code test \
            --severity-threshold=medium \
            --org=${{ vars.SNYK_ORG_ID }} \
            --sarif-file-output=snyk-code.sarif || true

      - name: Snyk monitor — continuous tracking
        working-directory: backend
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk monitor \
            --org=${{ vars.SNYK_ORG_ID }} \
            --project-name="daltime-backend"

      - name: Upload Open Source SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: backend/snyk-oss.sarif
          category: snyk-oss-backend-main

      - name: Upload Code SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: backend/snyk-code.sarif
          category: snyk-code-backend-main

  # ── Full IaC scan + monitor (both templates) ──
  infra-snyk:
    name: Snyk full IaC scan
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v6.0.2

      - name: Setup Snyk CLI
        uses: snyk/actions/setup@master   # resolve & pin to SHA before merging, per repo convention
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Snyk IaC — full scan
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk iac test infra/template.yaml infra/foundation.yaml \
            --severity-threshold=medium \
            --org=${{ vars.SNYK_ORG_ID }} \
            --sarif-file-output=snyk-iac.sarif || true

      - name: Snyk IaC — monitor
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk iac monitor infra/template.yaml infra/foundation.yaml \
            --org=${{ vars.SNYK_ORG_ID }} || true

      - name: Upload IaC SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: snyk-iac.sarif
          category: snyk-iac-main

  # NOTE: No container job. Verified — no Dockerfile, no image build/push step exists
  # anywhere in this repo (Section 3.3). Add a `snyk container test && snyk container
  # monitor` job here if/when infra/template.yaml ever defines `PackageType: Image`.
```

### 6.3 `snyk-scheduled.yml` — Weekly report-only sweep

```yaml
# Belt-and-suspenders weekly sweep: catches newly-disclosed CVEs / IaC rule updates
# against code that hasn't changed (continuous `snyk monitor` in snyk-main.yml covers
# most of this already, but a scheduled `test` independently re-validates and produces
# a standing report artifact on a predictable cadence).
#
# Weekly (not daily): this is a 3-project npm codebase with moderate dependency churn
# (see the @aws-sdk/* version-drift noted in the implementation plan, Section 2.5) —
# daily would generate noise nobody reads; monthly is too slow for CVE response.
# Monday 06:00 UTC — before the work week starts, so Monday's standup has fresh data.
name: Snyk — Scheduled Sweep

on:
  schedule:
    - cron: '0 6 * * 1'
  workflow_dispatch: {}   # allow manual trigger for ad-hoc "did the new advisory affect us?" checks

permissions:
  contents: read
  security-events: write

jobs:
  scheduled-scan:
    name: Weekly Snyk sweep (report-only)
    runs-on: ubuntu-latest
    strategy:
      matrix:
        project: [frontend, backend]
      fail-fast: false   # one project's findings shouldn't hide the other's
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v6.0.2

      - name: Setup Node.js
        uses: actions/setup-node@v6.3.0
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: ${{ matrix.project }}/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: ${{ matrix.project }}

      - name: Setup Snyk CLI
        uses: snyk/actions/setup@master   # resolve & pin to SHA before merging, per repo convention
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      # Report-only — `|| true` mirrors Checkov's `soft_fail: true` convention already
      # established in this repo (ci.yml, foundation.yml): inform, don't fail a build
      # that didn't change. The point is the report artifact, not a red X.
      - name: Snyk Open Source sweep
        working-directory: ${{ matrix.project }}
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk test \
            --org=${{ vars.SNYK_ORG_ID }} \
            --json-file-output=snyk-${{ matrix.project }}-report.json \
            --sarif-file-output=snyk-${{ matrix.project }}-report.sarif || true

      # License-compliance summary — Section 3.1 recommends starting this in
      # report-only mode and graduating to a gate once the existing tree is audited.
      - name: License compliance report
        working-directory: ${{ matrix.project }}
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk test --print-deps \
            --org=${{ vars.SNYK_ORG_ID }} \
            > snyk-${{ matrix.project }}-licenses.txt || true

      - name: Upload weekly report artifacts
        if: always()
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: snyk-weekly-${{ matrix.project }}-${{ github.run_id }}
          path: |
            ${{ matrix.project }}/snyk-${{ matrix.project }}-report.json
            ${{ matrix.project }}/snyk-${{ matrix.project }}-report.sarif
            ${{ matrix.project }}/snyk-${{ matrix.project }}-licenses.txt
          retention-days: 90   # longer than the 7-day build-artifact retention — these are audit trail, not build output

      - name: Upload SARIF to code scanning
        if: always()
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: ${{ matrix.project }}/snyk-${{ matrix.project }}-report.sarif
          category: snyk-scheduled-${{ matrix.project }}

  iac-sweep:
    name: Weekly IaC sweep (report-only)
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v6.0.2

      - name: Setup Snyk CLI
        uses: snyk/actions/setup@master   # resolve & pin to SHA before merging, per repo convention
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Snyk IaC sweep
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk iac test infra/template.yaml infra/foundation.yaml \
            --org=${{ vars.SNYK_ORG_ID }} \
            --sarif-file-output=snyk-iac-report.sarif || true

      - name: Upload SARIF to code scanning
        if: always()
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: snyk-iac-report.sarif
          category: snyk-scheduled-iac
```

### 6.4 Required addition to existing `cd.yml` (Release gate — Section 4.4)

Add as a new job that the existing `deploy` job depends on, gated to `main` only (the production environment), inserted between artifact resolution and the `Deploy SAM stack` step:

```yaml
  # ── Release gate: hard-blocks production deploys on CRITICAL findings only ──
  # Runs only for the `main` (production) environment — dev/qa promotions are not
  # gated here (they're gated by their own upstream CI runs per the existing
  # artifact-resolution logic in this file). See Section 5 for why "critical only"
  # is the right line for a production hard-gate: a stricter threshold here would,
  # in practice, train the team to bypass it — a calibrated gate people respect
  # beats a strict one people route around.
  snyk-release-gate:
    name: Snyk release gate (critical only)
    if: github.ref_name == 'main'
    needs: [ci-run]   # reuse the artifact-run resolution already at the top of this job
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v6.0.2
        with:
          ref: ${{ needs.ci-run.outputs.sha }}

      - name: Setup Snyk CLI
        uses: snyk/actions/setup@master   # resolve & pin to SHA before merging, per repo convention
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Hard gate — fail the deploy on any CRITICAL finding
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: |
          snyk test --all-projects --severity-threshold=critical --org=${{ vars.SNYK_ORG_ID }}
          snyk iac test infra/template.yaml infra/foundation.yaml --severity-threshold=critical --org=${{ vars.SNYK_ORG_ID }}

      # Auditable bill-of-materials for this exact production release — same
      # actions/upload-artifact + retention pattern already used for sam-build /
      # frontend-build artifacts in ci.yml, so no new pattern to learn.
      - name: Generate release SBOM
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: snyk sbom --format=cyclonedx1.4+json --org=${{ vars.SNYK_ORG_ID }} > daltime-sbom-${{ github.sha }}.json

      - name: Upload SBOM artifact
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: sbom-${{ github.sha }}
          path: daltime-sbom-${{ github.sha }}.json
          retention-days: 90

  deploy:
    name: Deploy to ${{ github.ref_name }}
    needs: [snyk-release-gate]   # add this — existing job otherwise unchanged
    if: always() && (needs.snyk-release-gate.result == 'success' || needs.snyk-release-gate.result == 'skipped')
    # ... rest of the existing `deploy` job is unchanged ...
```

---

## 7. Secrets, Configuration & Branch Protection

### 7.1 Required GitHub secrets (repo or environment level)

| Secret | Purpose | Scope |
|---|---|---|
| `SNYK_TOKEN` | API token for Snyk CLI auth in all four workflow surfaces (`snyk-pr.yml`, `snyk-main.yml`, `snyk-scheduled.yml`, `cd.yml` gate) | Repository secret (or org-level if other repos will use Snyk too — recommend org-level from day one to avoid copy-paste drift) |

No new AWS or Cognito secrets are needed — Snyk doesn't touch the deploy path except as a gate that reads (never writes) AWS state.

### 7.2 Required GitHub variables (`vars.*`, matching the existing `vars.SAM_STACK_NAME`/`vars.ALLOWED_ORIGINS` pattern in `cd.yml`)

| Variable | Purpose |
|---|---|
| `SNYK_ORG_ID` | Snyk organization ID — keeps org targeting explicit and out of hardcoded workflow text, consistent with how `cd.yml` already externalizes `SAM_STACK_NAME`/`SAM_S3_BUCKET` as `vars.*` rather than literals |

### 7.3 Required Snyk organization configuration

1. **Create one Snyk Organization** for DalTime (or a sub-org if the user's broader Snyk account hosts multiple projects) — note the Org ID for `vars.SNYK_ORG_ID`.
2. **Connect via the GitHub integration** (not just CLI tokens) — this is what enables Snyk's native PR-comment annotations and keeps the dashboard's project list in sync with the repo automatically, rather than relying solely on CLI-driven `monitor` snapshots.
3. **Three logical projects**: `daltime-frontend`, `daltime-backend`, `daltime-iac` — matches the `--project-name` values used in `snyk-main.yml` and keeps the dashboard's per-project views aligned with this repo's actual structure (don't let Snyk auto-discover and create a fourth "root" project from the root `package.json` — it has no runtime dependencies worth tracking; exclude it via `.snyk` policy or org project settings).
4. **License policy**: configure a deny-list for strong-copyleft licenses (GPL-2.0, GPL-3.0, AGPL-3.0, LGPL family) appropriate for a closed-source SaaS — start in **notify**, not **block** (Section 3.1/5 reasoning: don't gate on day one against a tree that's never been audited).
5. **Severity thresholds**: configure org-level defaults matching Section 5 (high for PR-facing integrations, medium for monitoring) so the dashboard's "what should I look at" view matches what the workflows actually gate on — mismatched defaults between org config and CI flags are a common source of "why didn't this block?" confusion.

### 7.4 Recommended branch protection rules (currently: none exist — verified via API)

This is the precondition for the new PR workflow to mean anything. Recommend, for `main` (and mirror for `dev`/`qa` once the team is comfortable):

- **Require a pull request before merging** (currently absent — confirm this matches the team's intended workflow; the `cd.yml` comments describe a PR-based promotion model for `dev→qa`/`qa→main`, so this formalizes what the comments already describe as the intended flow).
- **Require status checks to pass before merging**, specifically:
  - `Snyk scan — frontend` / `Snyk scan — backend` / `Snyk IaC scan` (from `snyk-pr.yml`, only the ones whose path-filter triggered)
  - The existing `Frontend tests` / `Backend tests` / `CodeQL security scan` (from `ci.yml`) — **these aren't currently required anywhere either**, which is worth fixing in the same pass since you're touching branch protection regardless.
- **Do not require linear history / signed commits** unless the team already does this elsewhere — adding multiple new requirements simultaneously makes it hard to isolate which one caused friction if something goes wrong.

---

## 8. Reporting

### 8.1 Where results land (single-pane-of-glass design)

- **GitHub Security tab** — the unifying surface. CodeQL, Checkov (via its own SARIF path if configured — currently it isn't; Checkov runs in `quiet`/table mode), and now Snyk OSS/Code/IaC SARIF all converge here via `github/codeql-action/upload-sarif`, the same action family already in `ci.yml`. Categorized uploads (`category: snyk-oss-frontend`, etc.) keep each tool's findings distinguishable rather than overwriting each other.
- **Snyk dashboard** — the system of record for continuous monitoring (`monitor` snapshots), license policy, and historical trend (new vulns introduced vs. fixed over time) — things the Security tab doesn't model well.
- **SonarCloud dashboard** — unchanged, remains the code-quality + coverage + security-hotspot view for `main`.
- **Workflow artifacts** (weekly sweep reports, release SBOMs) — using the exact `actions/upload-artifact` pattern and retention-day convention already established for `sam-build`/`frontend-build` (7 days) — sweep reports/SBOMs get 90 days since they're audit trail, not rebuildable build output.

### 8.2 SARIF upload strategy

- One `upload-sarif` step per scan-type-per-project, each with a unique `category:` — this is the difference between "30 overlapping findings nobody can parse" and "I can filter the Security tab by `snyk-code-backend` and see exactly what Snyk Code found in the Lambda layer." Mirrors the precision the existing CodeQL job already brings to that tab.
- `if: always()` on every upload step — a failed scan (i.e., findings exceeded the threshold) should still produce a SARIF upload; the job "failing" and the *results being visible* are two different things, and conflating them (by only uploading on success) would hide exactly the findings you most need to see.

### 8.3 Security metrics worth tracking (via Snyk dashboard + Security tab trend views)

- **New vs. fixed vulnerabilities per release** (Snyk dashboard trend) — the actual "are we improving" signal, more useful than a point-in-time count.
- **Mean time-to-remediate by severity** — especially for critical/high, since that's what the release gate (Section 6.4) enforces; if critical findings are taking weeks to clear, the gate becomes a deploy-blocker in practice, which is a signal to revisit triage process, not the threshold.
- **PR-gate bypass rate** (how often `main`/`dev`/`qa` protection rules get admin-overridden) — the canary for "is this gate calibrated correctly or are people routing around it."
- **License-policy violations trend** (once graduated from report-only) — particularly copyleft introductions in transitive deps, which are the hardest category to catch by manual review.
- **IaC drift between Checkov and Snyk IaC findings** — if the two tools consistently disagree on the same resources, that's a signal to either tune one's `skip_check`/policy config or document why the disagreement is expected (mirroring the inline-reasoning convention the team already uses for Checkov's `skip_check` list).

---

## 9. Rollout Strategy (ties into the phased roadmap, Section 11)

The core principle: **introduce in monitor/report mode, tighten only after the existing baseline is triaged.** This repo has *zero* existing PR gates — going straight to "blocking" would mean the very first thing developers experience from this initiative is "your merge is blocked by ~200 pre-existing transitive-dependency findings you didn't introduce." That's the fastest way to make a security tool resented rather than trusted.

1. **Land the workflows in report-only / non-blocking mode first** (all `|| true`, no branch-protection requirement yet) — let a full scan cycle run and populate the Snyk dashboard with the *actual* current baseline (not a guess).
2. **Triage the baseline**: for each existing finding, either fix it (if low-effort), schedule it (if it needs real work — feed into `docs/testing-backlog.md`-style tracking, which this repo already uses for similar audit-and-roadmap work), or explicitly accept it via a `.snyk` ignore policy with a reason and review-by date (mirrors the Checkov `skip_check` convention's inline-reasoning discipline — don't silence findings without writing down why).
3. **Only then flip the PR workflow to blocking** (remove `|| true`, add to branch protection) — at that point, a red check means "you introduced something new," not "you inherited 200 things," which is the difference between a gate developers respect and one they resent.
4. **Tighten thresholds incrementally** (Section 5's table is the Phase-1/2 starting point, not the permanent state) — once the team has lived with high/critical-only gating for a few sprints and the backlog from step 2 is shrinking, revisit whether medium-severity PR gating is warranted.

---

## 10. Long-Term Maintenance Plan

- **Quarterly threshold review**: revisit Section 5's table against the metrics in 8.3 — if the PR gate's bypass rate is near zero and the critical/high backlog stays near zero, that's the signal to consider tightening to medium; if bypass rate climbs, that's the signal the gate is miscalibrated (loosen, or invest in faster triage, before tightening further).
- **`.snyk` policy file hygiene**: every ignored finding needs a reason and a review-by date (same discipline as Checkov's documented `skip_check` list) — schedule a recurring review (tie it to the existing `docs/coverage-roadmap.md`-style cadence this team already uses for similar audits) so ignores don't silently become permanent.
- **SAST consolidation decision (Phase 4)**: after a few months of running Snyk Code (PR-time) alongside CodeQL (post-merge) and SonarCloud (main-only security hotspots), compare signal-to-noise and decide whether to consolidate to one PR-time + one deep-scan tool rather than maintaining three SAST surfaces indefinitely — three overlapping tools is a maintenance cost that compounds.
- **Container-readiness trigger**: if `infra/template.yaml` ever gains a `PackageType: Image` function or a `Dockerfile` appears anywhere in the repo, that's the trigger to add the Snyk Container job sketched in Section 6.2's closing note — a small, isolated addition, not a redesign.
- **Dependency-update automation**: this plan deliberately doesn't include Dependabot/Renovate setup (out of the requested Snyk scope), but Snyk's findings are most actionable when paired with automated fix-PRs — revisit whether to enable Snyk's own PR-opening capability (or Dependabot) once the baseline triage (Section 9, step 2) is complete and the team has bandwidth to review a steady trickle of update PRs.
- **Keep the `vars.SNYK_ORG_ID` / `secrets.SNYK_TOKEN` pattern in sync** with however the team manages `vars.SAM_STACK_NAME` etc. today — if those ever move to environment-scoped variables instead of repo-scoped, move the Snyk config the same way so there's one mental model for "where do pipeline config values live."

---

## 11. Priority-Ranked Backlog & Phased Roadmap

### Phase 1 — Quick Wins (1–2 days)
1. Create the Snyk organization, connect the GitHub integration, obtain `SNYK_TOKEN`/`SNYK_ORG_ID`, add as repo/org secrets and variables (Section 7).
2. Land `snyk-pr.yml`, `snyk-main.yml`, `snyk-scheduled.yml` in **report-only mode** (`|| true` everywhere, no branch protection yet) — get a real baseline into the Snyk dashboard without blocking anyone (Section 9, step 1).
3. Resolve and pin all `snyk/actions/*` and `dorny/paths-filter` references to commit SHAs, matching this repo's existing pinning convention for `checkov-action`/`setup-sam` (the workflows above flag every spot that needs this).

### Phase 2 — Core Security Coverage (1 week)
4. Triage the baseline populated in Phase 1 (Section 9, step 2): fix-now / schedule / `.snyk`-ignore-with-reason for every existing finding across `frontend`, `backend`, `infra`.
5. Flip `snyk-pr.yml` to blocking on `--severity-threshold=high` (remove `|| true`), add the relevant jobs to branch protection required-status-checks (Section 7.4) — **and** add the long-overdue `Frontend tests`/`Backend tests`/`CodeQL security scan` checks to that same required list, since you're touching branch protection regardless.
6. Configure the Snyk license policy in **notify** mode (Section 7.3, item 4).

### Phase 3 — Release Protection (1–2 weeks)
7. Add the `snyk-release-gate` job to `cd.yml`, scoped to `main` / `--severity-threshold=critical` (Section 6.4) — verify it correctly blocks `deploy` via the `needs:`/`if:` wiring shown, with a deliberate test (introduce a known-critical finding in a scratch branch, confirm the gate fires, then revert).
8. Add `snyk sbom` generation to the release gate job; confirm the artifact uploads and is retrievable (mirrors the existing `sam-build`/`frontend-build` artifact retrieval pattern already proven in `cd.yml`).
9. Document the manual-override path for the release gate (who can dispatch it, where it's logged) — Section 5's "Production releases" row assumes this exists; it needs to be a deliberate, written-down process, not an ad-hoc `git push --force` when someone's blocked.

### Phase 4 — Advanced DevSecOps Maturity (ongoing)
10. Run the SAST consolidation comparison (CodeQL vs. Snyk Code signal-to-noise) and decide whether to retire one (Section 10).
11. Graduate the license policy from notify → block, informed by Phase 2's baseline triage data.
12. Tighten PR-gate threshold from high → medium once bypass-rate metrics (Section 8.3) show the team trusts and isn't routing around the existing gate.
13. Revisit Snyk Container readiness if/when `PackageType: Image` or a Dockerfile appears (Section 3.3 / Section 10's container-readiness trigger).
14. Consider Dependabot/Renovate to pair with Snyk's detection — findings without an automated fix-PR path tend to accumulate (Section 10).
15. Cross-reference IaC findings between Checkov and Snyk IaC on a recurring cadence; either reconcile config or document expected disagreement (Section 8.3, last bullet).
