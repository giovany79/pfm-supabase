import { describe, expect, it } from "vitest";
import { executeReadTool } from "@/lib/mcp/tools";

describe("read tool validation", () => {
  it("rejects SQL-shaped and unknown input before querying", async () => {
    const client = {} as any;
    await expect(executeReadTool(client, "action", "query_transactions", { category: "health; drop table transactions" })).rejects.toThrow("invalid tool input");
    await expect(executeReadTool(client, "action", "query_transactions", { sql: "select * from transactions" })).rejects.toThrow("invalid tool input");
  });
});
