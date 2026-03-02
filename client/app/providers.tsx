"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiPost } from "@/lib/api";
import { clearStoredAuth, getStoredAuth, setStoredAuth, type StoredAuth } from "@/lib/auth";

type AuthContextValue = {
  auth: StoredAuth | null;
  isLoaded: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setAuth(getStoredAuth());
    setIsLoaded(true);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await apiPost<{
      token: string;
      user: { id: string; username: string; role: "WARDEN" | "STAFF" };
    }>("/auth/login", { username, password });

    const nextAuth: StoredAuth = {
      token: data.token,
      user: data.user,
    };

    setStoredAuth(nextAuth);
    setAuth(nextAuth);
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setAuth(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ auth, isLoaded, login, logout }),
    [auth, isLoaded, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within Providers");
  return ctx;
}
