# Release Strategy

## Versioning
- Use semantic versioning: MAJOR.MINOR.PATCH.
- Increment MAJOR for breaking changes.
- Increment MINOR for backward-compatible feature work.
- Increment PATCH for bug fixes and documentation-only changes.

## Release Flow
1. Merge validated changes into develop.
2. Create a release branch from develop.
3. Run tests, smoke checks, and release validation.
4. Merge into main and tag the release.

## Rollback
- Keep deployment artifacts and release tags available.
- Roll back by redeploying the previous known-good image or release.
