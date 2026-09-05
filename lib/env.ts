import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z
    .string()
    .min(1, "NEXT_PUBLIC_CONVEX_URL is required")
    .url("NEXT_PUBLIC_CONVEX_URL must be a valid URL (e.g. https://<deployment>.convex.cloud)"),
  NEXT_PUBLIC_CONVEX_SITE_URL: z.string().url().optional(),
});


const serverEnvSchema = clientEnvSchema.extend({
  CONVEX_SITE_URL: z.string().url().optional(),
  CONVEX_DEPLOYMENT: z.string().optional(),
  CONVEX_DEPLOY_KEY: z.string().optional(),
});

function validateEnv() {
  const isServer = typeof window === "undefined";
  const rawEnv = {
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
    ...(isServer
      ? {
          CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
          CONVEX_DEPLOYMENT: process.env.CONVEX_DEPLOYMENT,
          CONVEX_DEPLOY_KEY: process.env.CONVEX_DEPLOY_KEY,
        }
      : {}),
  };

  const schema = isServer ? serverEnvSchema : clientEnvSchema;
  const parsed = schema.safeParse(rawEnv);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    const message = `[FATAL] Nirman Environment Validation Failed:\n${errorDetails}\n\nPlease check your .env.local or production environment variables.`;
    console.error(message);
    throw new Error(message);
  }

  return parsed.data;
}

export const env = validateEnv();
