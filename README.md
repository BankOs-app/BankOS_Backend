# BankOS Backend

BankOS backend built with NestJS and TypeScript. The project is organized into business modules; at this stage, these modules are scaffolding and do not yet implement banking operations or integrate with PostgreSQL, Drizzle, or authentication.

## Requirements

- Node.js `22.22.3` or later in the 22.x release line, `24.15.0` or later in the 24.x release line, or `26.0.0` or later.
- npm, included with Node.js.
- Git to clone the repository.

Check your installed versions:

```bash
node --version
npm --version
```

## Installation

Clone the repository and switch to its directory:

```bash
git clone <REPOSITORY_URL>
cd BankOS_Backend
```

Install the exact dependency versions listed in `package-lock.json`:

```bash
npm ci
```

## Run in development

```bash
npm run start:dev
```

By default, the server listens at `http://localhost:3000`. You can change the port with the `PORT` environment variable:

PowerShell:

```powershell
$env:PORT=3001
npm run start:dev
```

Linux or macOS:

```bash
PORT=3001 npm run start:dev
```

> **Current status:** the server can start, but `GET /` returns `404` because `AppModule` does not currently register a controller for that route. The business modules do not expose endpoints yet.

## Build and run

```bash
npm run build
npm run start:prod
```

The production command starts the compiled application from `dist/`.

## Tests and linting

```bash
# Unit tests
npm test -- --runInBand

# End-to-end tests
npm run test:e2e -- --runInBand

# Test coverage
npm run test:cov

# Lint
npm run lint
```

The included end-to-end test expects `GET /` to return `Hello World!`, but currently fails with `404` because that controller is not registered in `AppModule`.

## Environment variables

`src/main.ts` reads `PORT` from the process environment. A `.env` file is not loaded automatically at this stage. `.env.example` is a reference template only: its database and JWT variables are not connected to the application yet. Do not use example values or commit real secrets to Git.

## Project structure

```text
src/
├── common/
├── config/
├── database/
└── modules/
    ├── accounts/
    ├── audit/
    ├── customers/
    ├── exchange-rates/
    ├── fees/
    ├── identity/
    ├── idempotency/
    ├── ledger/
    ├── tenants/
    ├── transactions/
    └── webhooks/
```

Each business module is structured to grow with `domain`, `application`, `infrastructure`, and `presentation` layers. Dependencies between modules will be added when required by implemented features.

## Files ignored by Git

The `.gitignore` excludes dependencies (`node_modules/`), build output (`dist/` and `*.tsbuildinfo`), environment files (`.env*`, except `.env.example`), logs, coverage reports, and local editor settings.
