# Development Workflow

## Local Development
1. Clone the repository.
2. Copy .env.example to .env and adjust values.
3. Install dependencies with npm install.
4. Run the application with npm start.
5. Run tests with npm test.

## Branching
- main: production-ready branch
- develop: integration branch for planned work
- feature/*: new features
- hotfix/*: urgent production fixes
- chore/*: maintenance and tooling updates

## Commit Convention
- feat: new feature
- fix: bug fix
- docs: documentation changes
- chore: maintenance or tooling
- refactor: structural code changes without behavior change
- test: test additions or fixes

## Pull Requests
- Open a PR against develop unless the change is a hotfix.
- Include summary, testing evidence, and risk notes.
- Require review before merge.
