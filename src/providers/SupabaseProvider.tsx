"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type SupabaseContextValue = {
  supabase: SupabaseClient<Database>;
};

const SupabaseContext = createContext<SupabaseContextValue | undefined>(
  undefined,
);

type SupabaseProviderProps = {
  children: ReactNode;
};

export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const value = useMemo(
    () => ({
      supabase,
    }),
    [supabase],
  );

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext);

  if (!ctx) {
    throw new Error("useSupabase must be used within SupabaseProvider");
  }

  return ctx.supabase;
}

