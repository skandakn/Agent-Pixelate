"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/clerk-react";
import { LogIn } from "lucide-react";

const ClerkEnabledContext = createContext<boolean>(false);

export function useClerkEnabled(): boolean {
  return useContext(ClerkEnabledContext);
}

const BUILD_TIME_KEY = (
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ""
).trim();

export function ClerkAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [publishableKey, setPublishableKey] = useState<string>(BUILD_TIME_KEY);

  useEffect(() => {
    if (publishableKey) return;
    let active = true;
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    const configUrl = apiBase ? `${apiBase}/api/config` : "/api/config";

    fetch(configUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const key = String(data.clerk_publishable_key || "").trim();
        if (key) {
          setPublishableKey(key);
        }
      })
      .catch(() => {
        // Gracefully remain unauthenticated if backend config isn't reachable
      });

    return () => {
      active = false;
    };
  }, [publishableKey]);

  if (!publishableKey) {
    return (
      <ClerkEnabledContext.Provider value={false}>
        {children}
      </ClerkEnabledContext.Provider>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkEnabledContext.Provider value={true}>
        {children}
      </ClerkEnabledContext.Provider>
    </ClerkProvider>
  );
}

export function ClerkAuthControls() {
  const enabled = useClerkEnabled();
  if (!enabled) return null;

  return (
    <div className="flex items-center">
      <SignedOut>
        <SignInButton mode="modal">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-100 transition hover:border-violet-400/60 hover:bg-violet-500/25"
          >
            <LogIn className="h-3.5 w-3.5 text-violet-300" />
            <span>Sign In</span>
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton
          appearance={{
            elements: {
              avatarBox:
                "h-8 w-8 ring-1 ring-violet-500/40 hover:ring-violet-400 transition",
            },
          }}
        />
      </SignedIn>
    </div>
  );
}
