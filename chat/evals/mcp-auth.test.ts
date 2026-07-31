/** Pure API-key parsing and hashing tests. No DB, no network. */

import { hashKey, parseBearerKey } from "@/lib/mcp/auth";

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures += 1;
  }
}

console.log("\nmcp-auth unit tests");
console.log("─".repeat(50));

const validSecret = "iofiq_abcDEF012_-";
assert(
  parseBearerKey(`Bearer ${validSecret}`) === validSecret,
  "valid bearer key parses",
);
assert(parseBearerKey(null) === null, "missing header is rejected");
assert(
  parseBearerKey(`Basic ${validSecret}`) === null,
  "wrong scheme is rejected",
);
assert(
  parseBearerKey("Bearer other_abc") === null,
  "wrong key prefix is rejected",
);
assert(parseBearerKey("Bearer iofiq_") === null, "empty secret is rejected");
assert(
  parseBearerKey("bearer iofiq_abc") === null,
  "scheme casing must be exact",
);
assert(
  parseBearerKey("Bearer iofiq_abc=") === null,
  "non-base64url characters are rejected",
);

const first = hashKey("iofiq_first");
const again = hashKey("iofiq_first");
const second = hashKey("iofiq_second");
assert(first === again, "hash is deterministic");
assert(/^[a-f0-9]{64}$/.test(first), "hash is 64-character lowercase hex");
assert(first !== second, "different secrets have different hashes");

console.log("\n" + "─".repeat(50));
if (failures === 0) {
  console.log("All mcp-auth assertions passed.\n");
} else {
  console.error(`${failures} mcp-auth assertion(s) failed.\n`);
  process.exit(1);
}
