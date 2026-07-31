import { randomBytes, randomUUID } from "node:crypto";
import { hashKey } from "@/lib/mcp/auth";

interface MintArgs {
  userId: string;
  label?: string;
}

class CliUsageError extends Error {}

function parseArgs(argv: string[]): MintArgs {
  let userId: string | undefined;
  let label: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (arg === "--user-id" && value && !value.startsWith("--")) {
      userId = value;
      i += 1;
    } else if (arg === "--label" && value && !value.startsWith("--")) {
      label = value;
      i += 1;
    } else {
      throw new CliUsageError(
        "Usage: pnpm tsx --env-file=.env.local scripts/mint-api-key.ts --user-id <id> [--label <label>]",
      );
    }
  }

  if (!userId) {
    throw new CliUsageError("Refusing to mint a key without --user-id.");
  }
  return { userId, label };
}

async function main(): Promise<void> {
  const { userId, label } = parseArgs(process.argv.slice(2));
  const [{ db, tables }] = await Promise.all([import("@/db")]);
  const secret = `iofiq_${randomBytes(32).toString("base64url")}`;

  await db.insert(tables.apiKeys).values({
    id: randomUUID(),
    userId,
    keyHash: hashKey(secret),
    label,
  });

  process.stdout.write(
    `API key: ${secret}\nStore this now. It is not recoverable.\n`,
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof CliUsageError ? error.message : "Key mint failed.";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
