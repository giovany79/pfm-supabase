import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("mutation audit privacy", () => {
  it("does not accept financial fields in its public signature", () => {
    const source = [
      readFileSync("lib/mcp/log-mutation.ts", "utf8"),
      readFileSync("lib/mcp/log-snapshot-mutation.ts", "utf8"),
    ].join('\n');
    expect(source).toContain("operation: MutationOperation");
    expect(source).not.toMatch(/log(?:Snapshot)?Mutation\([^)]*(amount|description|category|institution|notes|currency)/);
  });
});
