import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useSession } from "../src/lib/supabase";
import { getOnboardingStatus } from "../src/api/onboarding";

export default function Index() {
  const { session, loading } = useSession();
  // null = still checking onboarding, true/false once known. Only relevant when signed in.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    getOnboardingStatus()
      .then((s) => { if (active) setOnboarded(s.onboarded); })
      .catch(() => { if (active) setOnboarded(true); });
    return () => { active = false; };
  }, [session]);

  if (loading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  if (onboarded === null) return null; // brief: deciding map vs onboarding
  return <Redirect href={onboarded ? "/map" : "/onboarding"} />;
}
