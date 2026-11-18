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

export interface RuntimeAuthConfig {
  clerkEnabled: boolean;
  configLoaded: boolean;
  geminiEnabled: boolean;
  bandTransport: string;
}

const DEFAULT_CONFIG: RuntimeAuthConfig = {
  clerkEnabled: false,
  configLoaded: false,
  geminiEnabled: false,
  bandTransport: "local_fallback",
};

const RuntimeAuthContext = createContext<RuntimeAuthConfig>(DEFAULT_CONFIG);

export function useRuntimeAuthConfig(): RuntimeAuthConfig {
  return useContext(RuntimeAuthContext);
}

export function useClerkEnabled(): boolean {
  return useContext(RuntimeAuthContext).clerkEnabled;
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
  const [configLoaded, setConfigLoaded] = useState<boolean>(Boolean(BUILD_TIME_KEY));
  const [geminiEnabled, setGeminiEnabled] = useState<boolean>(false);
  const [bandTransport, setBandTransport] = useState<string>("local_fallback");

  useEffect(() => {
    let active = true;
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    const configUrl = apiBase ? `${apiBase}/api/config` : "/api/config";

    fetch(configUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data) {
          const key = String(data.clerk_publishable_key || "").trim();
          if (key && !BUILD_TIME_KEY) {
            setPublishableKey(key);
          }
          setGeminiEnabled(Boolean(data.gemini_enabled));
          if (data.band_transport) {
            setBandTransport(String(data.band_transport));
          }
        }
        setConfigLoaded(true);
      })
      .catch(() => {
        if (active) setConfigLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const contextValue: RuntimeAuthConfig = {
    clerkEnabled: Boolean(publishableKey),
    configLoaded,
    geminiEnabled,
    bandTransport,
  };

  if (!publishableKey) {
    return (
      <RuntimeAuthContext.Provider value={contextValue}>
        {children}
      </RuntimeAuthContext.Provider>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <RuntimeAuthContext.Provider value={contextValue}>
        {children}
      </RuntimeAuthContext.Provider>
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
            className="inline-flex items-center gap-1.5 rounded-full border border-[#D2D2D7] bg-white px-3.5 py-1.5 text-[12px] font-medium text-[#1D1D1F] transition hover:border-[#0071E3] hover:text-[#0071E3]"
          >
            <LogIn className="h-3.5 w-3.5 text-[#0071E3]" />
            <span>Sign In</span>
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton
          appearance={{
            elements: {
              avatarBox:
                "h-8 w-8 ring-1 ring-[#D2D2D7] hover:ring-[#0071E3] transition",
            },
          }}
        />
      </SignedIn>
    </div>
  );
}
