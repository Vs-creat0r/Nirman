"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { setToken } = useSession();
  const loginMutation = useMutation(api.auth.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const token = await loginMutation({ username, password });
      setToken(token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to log in");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 select-none" suppressHydrationWarning>
      <div className="w-full max-w-[400px] flex flex-col items-center gap-6" suppressHydrationWarning>
        {/* App Logo & Wordmark */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary text-primary-foreground font-bold flex items-center justify-center text-base shadow-sm">
            N
          </div>
          <span className="font-bold text-lg tracking-tight text-foreground">
            Nirman ERP
          </span>
        </div>

        {/* Custom Login Form */}
        <div className="w-full border border-border rounded-lg bg-surface shadow-md overflow-hidden p-6" suppressHydrationWarning>
          <h2 className="text-foreground font-bold text-lg mb-1">Sign in</h2>
          <p className="text-muted-foreground text-xs mb-6">to continue to Nirman ERP</p>
          
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">User ID</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
                required
                className="h-9 text-sm"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-9 text-sm"
              />
            </div>

            {error && (
              <div className="text-destructive text-xs font-medium mt-1">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>

        <p className="text-[10px] text-muted-foreground text-center max-w-[280px]">
          Authorized access only. Contact your system administrator to request credentials.
        </p>
      </div>
    </div>
  );
}
