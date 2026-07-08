# Cloud Deployment

A single, real deployment path — any Linux host with Docker installed and SSH access. This is deliberately identical across a generic VPS, DigitalOcean, and Hetzner (they're all "rent a Linux VM," with no meaningful difference to a containerized app). See **Per-provider notes** at the end for how the same path applies to AWS/Azure/GCP, and what's deliberately *not* built.

## 1. Server prep

Any host with:
- A recent Linux distribution (Ubuntu 22.04/24.04 LTS is a safe default)
- [Docker Engine](https://docs.docker.com/engine/install/) + the Compose plugin (`docker compose version` should work)
- Inbound firewall rules allowing `80`/`443` (HTTP/HTTPS, via Nginx) and `1883` (MQTT, for devices) from wherever they need to originate. Do **not** open `5432`/`6379`/`9000` (Postgres/Redis/MinIO) — `docker-compose.prod.yml` deliberately doesn't publish them to the host at all.
- SSH key-based access for the account `scripts/deploy.sh` will use

Clone (or otherwise copy) this repository onto the host, e.g. into `/opt/iot-platform` (the default `scripts/deploy.sh` expects — override with its second argument if you use a different path).

## 2. Configuration & secrets

```
cp .env.production.example .env
scripts/generate-secrets.sh   # prints JWT_SECRET, JWT_REFRESH_SECRET, POSTGRES_PASSWORD,
                               # MINIO_ACCESS_KEY, MINIO_SECRET_KEY — paste each into .env
```

Fill in the remaining `SMTP_*` values with a real mail provider's credentials — there is no Mailpit-equivalent in production. Every other value in `.env.production.example` has a working default (Docker Compose service hostnames, not `localhost` — containers reach each other by service name on the compose network).

Secrets stay in this `.env` file, consistent with every environment this project runs in (dev, CI, production) — no cloud-specific secret-manager integration is built here (see **Secrets management alternatives** below for why, and what to reach for instead if you want one).

**Never commit `.env`.** It's already gitignored; keep it that way, and restrict its file permissions (`chmod 600 .env`) on the host.

## 3. Cloudflare & SSL

This deployment terminates TLS at Nginx using a **Cloudflare Origin Certificate**, with Cloudflare's proxy in front handling the public-facing edge (CDN, DDoS protection, and its own publicly-trusted certificate for browsers). This is Cloudflare's **Full (Strict)** mode — both legs of the connection (browser→Cloudflare, Cloudflare→origin) are real TLS.

1. Add your domain to Cloudflare, point its nameservers there.
2. Create a DNS record for your API/app hostname (e.g. `app.example.com`) pointing at the server's IP, **proxied** (orange cloud, not grey/DNS-only).
3. In Cloudflare's SSL/TLS settings, set the mode to **Full (Strict)**.
4. Generate an **Origin Certificate**: SSL/TLS → Origin Server → Create Certificate (Cloudflare's dashboard defaults — RSA, 15-year validity — are fine). Save the certificate and private key.
5. On the server, place them where `docker-compose.prod.yml` expects (mounted into the frontend container read-only):
   ```
   mkdir -p certs
   # paste the certificate into certs/origin.pem
   # paste the private key into certs/origin.key
   chmod 600 certs/origin.key
   ```
6. (Recommended) Turn on **Always Use HTTPS** and set a minimum TLS version of 1.2 in Cloudflare's SSL/TLS settings.

For local verification without a real Cloudflare account, a self-signed certificate is a drop-in stand-in for `certs/origin.pem`/`origin.key` — the Nginx config doesn't care where the cert came from, only that the files exist. See **Verification** in this phase's implementation notes for the exact `openssl` command used to confirm this.

**MQTT is not covered by Cloudflare or this Nginx TLS setup.** Cloudflare's proxy carries HTTP(S) (and a few other protocols on paid plans), not raw MQTT TCP — devices connect to EMQX's `1883` directly, unencrypted, unless you additionally configure EMQX's own TLS listener (`8883`) with a certificate of your choosing (a Let's Encrypt certificate for an unproxied `mqtt.example.com` subdomain is a reasonable choice). This is a real, recommended hardening step for production device fleets, but isn't wired up by `docker-compose.prod.yml` — EMQX's TLS listener configuration is broker-specific and outside this repo's scope, same reasoning as the per-device EMQX credentials/ACLs gap documented in `docs/architecture.md`.

## 4. CI/CD — publishing images

`.github/workflows/release.yml` builds and pushes both the backend and frontend images to GitHub Container Registry (GHCR) whenever a `v*` tag is pushed:

```
git tag v1.2.0
git push origin v1.2.0
```

produces `ghcr.io/<owner>/<repo>-backend:v1.2.0` and `ghcr.io/<owner>/<repo>-frontend:v1.2.0` (plus `:latest`). No extra account or secret is needed — it authenticates with the GitHub Actions-provided `GITHUB_TOKEN`. Make the packages public (or configure a pull secret on the server) depending on your repo's visibility needs.

**This workflow is unverified against a real run** — this environment has no way to trigger an actual GitHub Actions execution, the same documented caveat as the CI changes in Phases 9/11/12. The YAML has been reasoned through carefully but hasn't been observed running for real.

## 5. Deploying

```
scripts/deploy.sh <ssh-host> [remote-dir]
```

This SSHes in, runs `docker compose -f docker-compose.prod.yml pull`, then `up -d --wait` — which blocks until the new containers' `HEALTHCHECK` (built into the backend image since Phase 13) passes before the command returns — then curls `/health/ready` to confirm. If any step fails, it prints the rollback command instead of leaving you guessing.

If you'd rather build directly on the server instead of pulling from GHCR (e.g. for a first deploy before you've set up CI, or if you don't want a registry dependency at all), `docker compose -f docker-compose.prod.yml build` works the same as it does locally — `image:` and `build:` are both set on each service, so Compose can do either.

## 6. Update strategy & rollback

Every deploy is a **health-check-gated recreate**: pull the new image, start it, and only remove the old container once the new one reports healthy (`docker compose up -d --wait`). There's a brief window of downtime during the actual container swap — this is *not* a zero-downtime blue-green setup (see `docs/architecture.md`'s Cloud Deployment section for why that's a deliberate scope boundary given this platform's single-instance-per-tenant architecture: every background dispatcher assumes exactly one running instance).

To roll back, pin the previous image tag and redeploy:

```
BACKEND_IMAGE=ghcr.io/<owner>/<repo>-backend:v1.1.0 \
FRONTEND_IMAGE=ghcr.io/<owner>/<repo>-frontend:v1.1.0 \
scripts/deploy.sh <ssh-host>
```

## Secrets management alternatives

This repo deliberately keeps secrets in a `.env` file rather than integrating a specific cloud provider's secret manager (AWS Secrets Manager, Azure Key Vault, GCP Secret Manager) — doing so for one provider and not the others would contradict the infra-agnostic approach this whole deployment path is built around, and building all three isn't warranted without a real account to verify each against. If you're deploying to AWS/Azure/GCP and want to use that platform's native secret store instead, the natural integration point is your process supervisor/orchestration layer injecting the same environment variables `.env` currently provides — the application itself only ever reads `process.env`, so nothing in `src/` needs to change.

## Per-provider notes

- **Generic VPS / DigitalOcean / Hetzner**: this entire guide, as written, with no changes. Create a Droplet/Cloud Server/VPS, install Docker, follow steps 1-6 above.
- **AWS EC2 / Azure VM / GCP Compute Engine**: this entire guide, plus platform-specific firewall/security-group rules (open 80/443/1883 the same way you would any other inbound rule) and DNS (point Cloudflare's DNS record at the instance's public IP, same as any other provider).
- **AWS ECS / Azure Container Apps / Cloud Run** (managed container services, not a VM): a real architectural alternative to everything above — no SSH, no `docker-compose.prod.yml`, a different secrets model per platform, and each platform's own deployment tooling instead of `scripts/deploy.sh`. **Documented here as a future option, not built** — it would mean genuinely different automation per platform (not a config tweak on top of what exists), and this environment has no real cloud account to build and verify any of the three against. The container images this repo already publishes to GHCR (step 4 above) are the right starting point for whoever picks this up.
