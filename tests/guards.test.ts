import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileRow } from "@/lib/supabase/types";

/**
 * action-guards.test.ts proves every action CALLS requireStaff/requireOwner;
 * this proves those calls actually refuse. Session plumbing is mocked — what
 * getProfile() returns is decided by the database (profiles_select is
 * is_staff(), see rls.test.ts / team-guard.test.ts).
 */

const getProfile = vi.fn<() => Promise<ProfileRow | null>>();

vi.mock("@/lib/supabase/server", () => ({ getProfile: () => getProfile() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    // like Next: redirect() throws, so nothing after it runs
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

const { requireStaff, requireOwner } = await import("@/app/admin/_lib/server");

const profile = (role: "owner" | "admin"): ProfileRow =>
  ({ id: `${role}-id`, email: `${role}@example.test`, full_name: null, role }) as ProfileRow;

beforeEach(() => {
  getProfile.mockReset();
});

describe("requireStaff", () => {
  it("redirects to the login page when there is no staff profile", async () => {
    getProfile.mockResolvedValue(null);
    await expect(requireStaff()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });

  it("returns the profile for staff", async () => {
    getProfile.mockResolvedValue(profile("admin"));
    await expect(requireStaff()).resolves.toMatchObject({ role: "admin" });
  });
});

describe("requireOwner", () => {
  it("redirects with no session at all", async () => {
    getProfile.mockResolvedValue(null);
    await expect(requireOwner()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });

  it("denies an admin (team management is the owner's alone)", async () => {
    getProfile.mockResolvedValue(profile("admin"));
    const gate = await requireOwner();
    expect("denied" in gate).toBe(true);
    if ("denied" in gate) expect(gate.denied.ok).toBe(false);
  });

  it("lets the owner through", async () => {
    getProfile.mockResolvedValue(profile("owner"));
    const gate = await requireOwner();
    expect(gate).toMatchObject({ me: { role: "owner" } });
  });
});
