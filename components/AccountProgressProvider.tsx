"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase-client";
import {
  installAccountProgressPersistence,
  switchAccountProgress,
} from "@/lib/account-progress-sync";

/** Keeps career stats, reveals, and related progress scoped to the signed-in account. */
export function AccountProgressProvider() {
  const activeUserRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribeStore = installAccountProgressPersistence();

    let active = true;

    async function applyUser(userId: string | null) {
      if (activeUserRef.current === userId) return;
      activeUserRef.current = userId;
      await switchAccountProgress(userId);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      void applyUser(data.session?.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applyUser(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      unsubscribeStore();
    };
  }, []);

  return null;
}
