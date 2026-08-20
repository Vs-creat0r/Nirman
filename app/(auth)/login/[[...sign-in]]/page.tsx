"use client";
import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 select-none">
      <div className="w-full max-w-[400px] flex flex-col items-center gap-6">
        {/* App Logo & Wordmark */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary text-primary-foreground font-bold flex items-center justify-center text-base shadow-sm">
            N
          </div>
          <span className="font-bold text-lg tracking-tight text-foreground">
            Nirman ERP
          </span>
        </div>

        {/* Clerk Sign In component */}
        <div className="w-full border border-border rounded-lg bg-surface shadow-md overflow-hidden">
          <SignIn
            path="/login"
            routing="path"
            signUpUrl="" // Hide signup url, users created by admin only
            forceRedirectUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-surface shadow-none border-none p-6 w-full",
                headerTitle: "text-foreground font-bold text-sm",
                headerSubtitle: "text-muted-foreground text-xs",
                socialButtonsBlockButton: "hidden", // Disable social login buttons
                formButtonPrimary: 
                  "bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs h-9 rounded-md shadow-sm normal-case tracking-normal",
                formFieldLabel: "text-xs font-semibold text-foreground",
                formFieldInput: 
                  "flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus:border-border",
                footerAction: "hidden", // Hide Sign Up footer links
                dividerRow: "hidden",
                identityPreviewText: "text-foreground text-xs",
                identityPreviewEditButton: "text-primary text-xs hover:underline",
              },
            }}
          />
        </div>

        <p className="text-[10px] text-muted-foreground text-center max-w-[280px]">
          Authorized access only. Contact your system administrator to request credentials.
        </p>
      </div>
    </div>
  );
}
