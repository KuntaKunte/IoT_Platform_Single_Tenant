# Git Strategy

## Repository Model
- Use a single repository for the platform core.
- Keep infrastructure, documentation, and application code in the same repository during the initial phase.

## Branch Strategy
- main: protected, production-ready state
- develop: integration branch for planned work
- feature/*: delivery of new capabilities
- hotfix/*: emergency fixes for production issues
- chore/*: maintenance and tooling work

## Merge Policy
- Require pull requests for all changes to main and develop.
- Prefer squash merges for small, focused changes.
- Preserve release tags for production tracking.
