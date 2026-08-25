import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase client for server components, route handlers and server actions.
 * Reads/writes the auth cookies so the session survives navigation.
 *
 * Server *components* cannot set cookies; the try/catch swallows that case —
 * `middleware.ts` is what actually refreshes the session cookie on each request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a server component — middleware handles the refresh
          }
        },
      },
    }
  );
}

/** The signed-in user's profile (id, email, role), or null when signed out. */
export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .eq("id", user.id)
    .single();

  // Fall back to the auth record if the profiles row hasn't landed yet, so a
  // freshly-invited user is never locked out of the panel.
  return (
    data ?? {
      id: user.id,
      email: user.email ?? null,
      full_name: null,
      role: "editor" as const,
      created_at: user.created_at,
    }
  );
}
