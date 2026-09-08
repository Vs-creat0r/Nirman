"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SESSION_COOKIE = "nirman_session";

function writeSessionCookie(token: string | null) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  if (token) {
    document.cookie = `${SESSION_COOKIE}=${token}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax${secure}`;
  } else {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax${secure}`;
  }
}

interface AuthContextType {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: () => {},
  logout: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load token from localStorage on mount
    const storedToken = localStorage.getItem("sessionToken");
    if (storedToken) {
      setTokenState(storedToken);
      writeSessionCookie(storedToken); // backfill for sessions created before the cookie existed
    }
    setIsLoading(false);
  }, []);

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem("sessionToken", newToken);
    } else {
      localStorage.removeItem("sessionToken");
    }
    writeSessionCookie(newToken);
    setTokenState(newToken);
  };

  const logout = () => {
    setToken(null);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ token, setToken, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useSession = () => useContext(AuthContext);
