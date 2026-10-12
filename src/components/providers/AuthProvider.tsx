"use client";

import type { Profile } from "@/types/app";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AuthContextValue = {
  profile: Profile | null;
  initialized: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  profile: null,
  initialized: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;

    import("@/services/auth")
      .then(({ onAuthChange }) => {
        if (!active) return;
        unsubscribe = onAuthChange((nextProfile) => {
          setProfile(nextProfile);
          setInitialized(true);
        });
      })
      .catch(() => {
        if (active) setInitialized(true);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo(() => ({ profile, initialized }), [profile, initialized]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
