# create-orbit-app

Scaffold a new Orbit project with one command.

> Part of the [Orbit](../../) frontend toolkit — designed so that AI-generated code and human-written code always look the same.

## Usage

```bash
pnpm create orbit-app my-app
```

The CLI will prompt you to choose an AI instructions file:

- **CLAUDE.md** — For [Claude Code](https://claude.ai/code)
- **AGENTS.md** — For other AI coding tools
- **None** — Skip AI instructions

Then it sets up the project, installs dependencies, and initializes git.

### Non-interactive mode

```bash
pnpm create orbit-app my-app --agent claude
```

Options for `--agent`: `claude`, `agents`, `none`

## What you get

```
my-app/
├── src/
│   ├── routes/        → File-based routing (page.tsx, hooks.ts, server.ts, schema.ts)
│   └── ...
├── vite.config.ts     → Vite+ with orbit-router, orbit-query, orbit-form, orbit-rpc
├── tsconfig.json
├── CLAUDE.md          → AI instructions (if selected)
└── package.json
```

### Included packages

- [orbit-router](../orbit-router/) — Directory-based routing with typed params
- [orbit-query](../orbit-query/) — Data fetching + caching
- [orbit-form](../orbit-form/) — React Compiler compatible forms with Zod validation
- [orbit-rpc](../orbit-rpc/) — server.ts to Hono RPC conversion
- [Tailwind CSS](https://tailwindcss.com/)

## Next steps

```bash
cd my-app
pnpm dev
```

Open http://localhost:5173 and start building.

## License

MIT
