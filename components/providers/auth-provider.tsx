"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
    }
    setIsLoading(false);
  }, []);

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem("sessionToken", newToken);
    } else {
      localStorage.removeItem("sessionToken");
    }
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
