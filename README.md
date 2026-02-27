[![CI](https://github.com/TylerLeonhardt/greenroom/actions/workflows/ci.yml/badge.svg)](https://github.com/TylerLeonhardt/greenroom/actions/workflows/ci.yml)
[![Deploy](https://github.com/TylerLeonhardt/greenroom/actions/workflows/deploy.yml/badge.svg)](https://github.com/TylerLeonhardt/greenroom/actions/workflows/deploy.yml)

# 🎭 GreenRoom

An improv group scheduling platform. Coordinate rehearsals, manage availability, and never miss a show.

## Tech Stack

- **[Remix](https://remix.run)** (React full-stack framework) with Vite
- **TypeScript** in strict mode
- **TailwindCSS v4** for styling
- **shadcn/ui** components (Radix UI primitives)
- **Drizzle ORM** with PostgreSQL
- **remix-auth v4** with FormStrategy for email/password + manual Google OAuth
- **Biome** for linting + formatting
- **Vitest** for testing
- **Docker** for local development and deployment

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- [Docker](https://www.docker.com/) (for local PostgreSQL)

### Setup

```bash
# Clone the repo
git clone https://github.com/TylerLeonhardt/greenroom.git
cd greenroom

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start PostgreSQL
docker compose up -d

# Generate and run database migrations
pnpm run db:generate
pnpm run db:migrate

# Start the dev server
pnpm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173).

### Stopping the database

```bash
docker compose down
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:studio` | Open Drizzle Studio (DB GUI) |
| `pnpm lint` | Run Biome linter |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm format` | Format code with Biome |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm typecheck` | TypeScript type checking |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `SESSION_SECRET` | Secret for signing session cookies | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | ✅ |
| `APP_URL` | Public URL of the app (used for emails and OAuth callbacks) | ✅ |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | Azure Communication Services connection string (for emails) | Optional |
| `NODE_ENV` | `production` in deployed environments | Auto |
| `PORT` | Port the server listens on (default: `3000`) | Auto |

See `.env.example` for a template.

## Deployment

GreenRoom deploys on **Azure Container Apps** with CI/CD via GitHub Actions.

See [docs/azure-setup.md](docs/azure-setup.md) for full Azure infrastructure setup instructions.

### Quick Start

```bash
# Build the Docker image
docker build -t greenroom .

# Run locally
docker run -p 3000:3000 --env-file .env greenroom
```

### CI/CD

- **CI** (`.github/workflows/ci.yml`): Runs typecheck, lint, build, and tests on every push and PR to `master`.
- **Deploy** (`.github/workflows/deploy.yml`): Builds a Docker image, pushes to Azure Container Registry, and deploys to Azure Container Apps on pushes to `master`.

## License

Private — all rights reserved.
