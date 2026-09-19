/**
 * @fileoverview ESM launcher for Agent Evaluation Harness.
 */
import { spawn } from "child_process";

const child = spawn("npx", ["tsx", "scripts/agent-eval.ts", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

