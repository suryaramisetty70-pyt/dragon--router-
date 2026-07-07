import test from "node:test";
import assert from "node:assert/strict";

test("runDragon RouterCli: missing command returns error", async () => {
  const { getCopilotTool } = await import("../../src/lib/copilot/tools.ts");
  const tool = getCopilotTool("runDragon RouterCli");
  assert.ok(tool);
  const result = await tool.handler({});
  assert.equal(result, "Please provide a command to execute.");
});

test("runDragon RouterCli: empty command returns error", async () => {
  const { getCopilotTool } = await import("../../src/lib/copilot/tools.ts");
  const tool = getCopilotTool("runDragon RouterCli");
  assert.ok(tool);
  const result = await tool.handler({ command: "" });
  assert.equal(result, "Please provide a command to execute.");
});

test("runDragon RouterCli: returns CLI-not-found when dragonrouter unavailable", async () => {
  const { getCopilotTool } = await import("../../src/lib/copilot/tools.ts");
  const tool = getCopilotTool("runDragon RouterCli");
  assert.ok(tool);
  const result = await tool.handler({ command: "health" });
  assert.ok(
    result.includes("dragonrouter CLI not found in PATH"),
    `Expected CLI-not-found message, got: ${result}`
  );
});
