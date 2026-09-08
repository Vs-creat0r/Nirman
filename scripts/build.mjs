import { spawnSync } from "child_process";

const hasDeployKey = Boolean(process.env.CONVEX_DEPLOY_KEY);

if (hasDeployKey) {
  console.log("CONVEX_DEPLOY_KEY detected. Running convex deploy and Next.js build...");
  const res = spawnSync("npx", ["convex", "deploy", "--cmd", "npm run build"], {
    stdio: "inherit",
    shell: true,
  });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
} else {
  console.log("No CONVEX_DEPLOY_KEY detected. Running next build directly...");
  const res = spawnSync("npm", ["run", "build"], {
    stdio: "inherit",
    shell: true,
  });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}
