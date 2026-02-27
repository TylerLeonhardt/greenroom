# 🎭 GreenRoom

An improv group scheduling platform. Coordinate rehearsals, manage availability, and never miss a show.

## Tech Stack

- **[Remix](https://remix.run)** (React full-stack framework) with Vite
- **TypeScript** in strict mode
- **TailwindCSS v4** for styling
- **shadcn/ui** components (Radix UI primitives)
- **Drizzle ORM** with PostgreSQL
- **Auth.js v5** for authentication (Google OAuth + email/password)
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

## Deployment

GreenRoom is designed to deploy on **Azure Container Apps**.

```bash
# Build the Docker image
docker build -t greenroom .

# Run locally
docker run -p 3000:3000 --env-file .env greenroom
```

Set the required environment variables (see `.env.example`) in your container app configuration.

## License

Private — all rights reserved.
