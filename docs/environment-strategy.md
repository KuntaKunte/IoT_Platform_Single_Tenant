# Environment Strategy

## Environments
- local: developer workstations
- development: shared integration environment
- staging: pre-production validation
- production: customer deployments

## Configuration Rules
- Keep secrets out of source control.
- Use .env for local development.
- Use environment-specific secret stores in higher environments.
- Validate required variables at startup.
