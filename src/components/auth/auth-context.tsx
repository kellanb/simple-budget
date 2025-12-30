"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

type UserSession = {
  userId: string;
  email: string;
  token: string;
  expiresAt: number;
};

type AuthContextValue = {
  user: UserSession | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "cashflow.sessionToken";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);

  // Read persisted token only after hydration to avoid SSR/CSR mismatches
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(stored);
    setHasBootstrapped(true);
  }, []);

  const session = useQuery(api.auth.getSession, token ? { token } : "skip");

  const signInMutation = useMutation(api.auth.signIn);
  const signUpMutation = useMutation(api.auth.signUp);
  const signOutMutation = useMutation(api.auth.signOut);

  // Clear stale tokens if the backend reports no active session
  useEffect(() => {
    if (token && session === null) {
      localStorage.removeItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(null);
    }
  }, [token, session]);

  const user = useMemo(() => {
    if (!session || session === undefined || !token) return null;
    return {
      userId: session.userId,
      email: session.email,
      expiresAt: session.expiresAt,
      token,
    };
  }, [session, token]);

  const isLoading = (token !== null && session === undefined) || !hasBootstrapped;

  const handleAuthResult = (result: {
    token: string;
    expiresAt: number;
    userId: string;
    email: string;
  }) => {
    localStorage.setItem(STORAGE_KEY, result.token);
    setToken(result.token);
    setHasBootstrapped(true);
  };

  const signIn = async (email: string, password: string) => {
    const result = await signInMutation({ email, password });
    handleAuthResult(result);
  };

  const signUp = async (email: string, password: string) => {
    const result = await signUpMutation({ email, password });
    handleAuthResult(result);
  };

  const signOut = async () => {
    const currentToken = token;
    // Clear token state FIRST to unsubscribe queries before backend deletion
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
    // Then delete the session on the backend (queries are already unsubscribed)
    if (currentToken) {
      await signOutMutation({ token: currentToken }).catch(() => {
        // Ignore errors - session might already be invalid
      });
    }
  };

  const value: AuthContextValue = {
    user,
    isLoading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

