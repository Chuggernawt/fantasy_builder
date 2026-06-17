"use client";

import { useEffect, useState } from "react";
import { getMyProfile } from "@/lib/multiplayer";
import { supabase } from "@/lib/supabase-client";

export function useAccount() {
  const [username, setUsername] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;

      if (error || !data.user) {
        setSignedIn(false);
        setUsername(null);
        setLoading(false);
        return;
      }

      setSignedIn(true);
      const metaName =
        typeof data.user.user_metadata?.username === "string"
          ? data.user.user_metadata.username
          : null;

      try {
        const profile = await getMyProfile();
        setUsername(profile?.username ?? metaName);
      } catch {
        setUsername(metaName);
      }
      setLoading(false);
    }

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      void load();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { signedIn, username, loading };
}
