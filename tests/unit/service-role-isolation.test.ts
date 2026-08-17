import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

describe("service-role isolation", () => {
  it("is imported only by the migration CLI", () => {
    const output = execFileSync("rg", ["-l", "service-role-client", "app", "lib", "scripts"], { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean);
    expect(output).toEqual(["scripts/migrate.ts"]);
  });
});
