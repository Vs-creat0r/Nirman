import { spawnSync } from "child_process";
const hasDeployKey = Boolean(process.env.CONVEX_DEPLOY_KEY);
const command = hasDeployKey ? 'npx convex deploy --cmd "npm run build"' : "npm run build";
console.log(hasDeployKey ? "convex deploy + next build…" : "next build only…");
const result = spawnSync(command, { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
