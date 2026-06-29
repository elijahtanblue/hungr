import { Redirect } from "expo-router";
import { useSession } from "../src/lib/supabase";

export default function Index() {
  const { session, loading } = useSession();
  if (loading) return null;
  return <Redirect href={session ? "/map" : "/sign-in"} />;
}
