# Customer Onboarding (Fork-per-Customer)

This platform is deployed **single-tenant-per-customer**: every customer gets their own git fork of this repository, their own infrastructure stack, and their own deployment — never a shared multi-tenant instance. This doc is the runbook for standing up a new one, and for keeping it from drifting silently out of sync with core fixes over time.

## Why fork-per-customer

The alternative — one core repo with per-customer config directories, no forking — was considered and deliberately not chosen. Fork-per-customer trades automatic core-fix propagation for maximum per-customer freedom: a customer whose needs genuinely exceed what a plugin can express (see `docs/architecture.md`'s Plugin Framework section for that extension surface's boundaries) can hand-edit `src/` in their own fork without it affecting anyone else, or waiting on a core feature request. The real cost of this choice is **Step 5** below — it does not happen automatically, and needs to be a standing habit, not a one-off.

## 0. One-time repo setup (do once, not per customer)

Mark this repository as a **GitHub template repository**: Settings → General → check "Template repository". This makes "Use this template" available on the repo page and via `gh repo create --template <owner>/<repo> <new-repo-name>`, so every subsequent customer fork starts from a clean, current copy rather than a manual clone-and-rename.

## 1. Create the customer's fork

```bash
gh repo create <customer-slug>-iot-platform --template <owner>/IoT_Platform_Single_Tenant --private --clone
cd <customer-slug>-iot-platform
git remote add upstream https://github.com/<owner>/IoT_Platform_Single_Tenant.git
git remote -v   # confirm both origin (the new fork) and upstream (this repo) are set
```

The `upstream` remote is what Step 5 depends on — add it now, while you're already here, not later when you actually need it.

## 2. Customize

Everything customer-specific should live in the extension points this platform was built around — in order of preference:

1. **Device templates, rules, dashboards, reports** — pure data, applied through the real REST API. `examples/` has five worked reference verticals (Agriculture, Industrial Automation, Energy, Water, Healthcare); the closest match is usually a faster starting point than writing a `seed.js` from scratch. Copy the closest one, adjust the field names/thresholds/recipients to the customer's actual scenario, and keep it under `examples/<customer-slug>/` in their fork so their onboarding is itself reproducible.
2. **A plugin**, if the customer's scenario needs a rule action or dashboard widget the generic types (`webhook`/`mqtt_publish`/`device_command`/`notification`; `chart`/`gauge`/`status_card`/`alarm_list`/`map`) can't express. `plugins/plc-monitoring-plugin` is the template to copy for structure.
3. **A real `src/` change**, only if 1 and 2 genuinely can't cover it. This is the fork's whole reason for existing — but it's also exactly the code that Step 5's upstream merges will need to reconcile against, so keep such changes as small and clearly-commented as possible.

## 3. Configuration & secrets

Standard production setup — see `docs/operations/cloud-deployment.md` for the full walkthrough (server prep, `.env` generation, Cloudflare/SSL, deploying, update/rollback). Nothing about that guide changes per customer; it's written generically for exactly this reason.

## 4. Deploy and tag a release

```bash
git tag v1.0.0
git push origin v1.0.0    # triggers this fork's own release.yml -> its own GHCR namespace
scripts/deploy.sh <customer-ssh-host>
```

Each fork's CI/CD is fully independent — a release tag in the customer's fork publishes to `ghcr.io/<owner>/<customer-slug>-iot-platform-*`, never touching any other customer's images.

## 5. Keep the fork in sync with core (the recurring part)

This is the step that makes fork-per-customer sustainable instead of a slow-motion liability. When a core fix lands in this template repo (a security patch, a bug fix — e.g. the `notification` action `message`-default bug found during Phase 15, PROGRESS.md), it does **not** reach any customer fork on its own.

```bash
git fetch upstream
git merge upstream/main        # or: git cherry-pick <specific-commit> for a targeted fix
# resolve conflicts if the fork has its own src/ changes near the same code
npm test                       # re-verify before deploying
```

Recommended cadence: whenever a security-relevant fix lands upstream, treat it the same as a CVE alert — sync every active fork within a defined SLA (e.g. one business day), not "eventually." For non-security fixes, a lighter cadence (monthly, or opportunistically alongside the customer's own next deploy) is reasonable.

**Track this somewhere.** A simple table (spreadsheet, internal wiki page, or a `customers.md` in a private ops repo — deliberately not built here, since it holds customer names/hosts and doesn't belong in a public/shared template) listing each fork's URL, deployment host, and the upstream commit it was last synced to is enough to answer "which customers are behind on the latest fix" without archaeology. Without this, drift is invisible until something breaks.

## Summary checklist

- [ ] Fork created from the template, `upstream` remote added
- [ ] Extension-point customization done (templates/rules/dashboards/reports/plugin), `src/` changes minimized and documented if any were needed
- [ ] `.env` configured, secrets generated, Cloudflare Origin Certificate installed
- [ ] First deploy verified (`/health/ready`, a real dashboard/rule smoke test)
- [ ] Release tagged, CI confirmed publishing to this fork's own GHCR namespace
- [ ] Fork's URL/host/last-synced-commit recorded in your customer tracking sheet
