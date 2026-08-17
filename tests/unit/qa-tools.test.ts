import { describe, expect, it } from "vitest";
import { assertReadInput, executeReadTool } from "@/lib/mcp/tools";

describe("read tool validation", () => {
  it("rejects SQL-shaped and unknown input before querying", async () => {
    const client = {} as any;
    await expect(executeReadTool(client, "action", "query_transactions", { category: "health; drop table transactions" })).rejects.toThrow("invalid tool input");
    await expect(executeReadTool(client, "action", "query_transactions", { sql: "select * from transactions" })).rejects.toThrow("invalid tool input");
  });

  it('accepts valid enum, date, and category filters', () => {
    expect(() =>
      assertReadInput('aggregate_transactions', {
        group_by: 'category',
        type: 'expensive',
        date_from: '2026-08-01',
        date_to: '2026-08-17',
      }),
    ).not.toThrow();
    expect(() => assertReadInput('query_transactions', { category: 'health', limit: 25 })).not.toThrow();
  });
});
