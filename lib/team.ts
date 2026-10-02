/**
 * The public team roster shown on /about.
 *
 * This is the checked-in fallback: `getTeam()` in lib/cms.ts prefers the
 * `team_members` table when Supabase is configured and falls back here, exactly
 * like projects and services. It lived inline in components/about/TeamRoster.tsx
 * until the roster became editable — moved out so the component renders whatever
 * it is handed and there is one source of truth for "who we are".
 *
 * NOT the same as `profiles` (panel logins). Someone can appear here without an
 * account, and an account doesn't put anyone on the website.
 */
export type TeamMember = { name: string; role: string; initials: string };

export const team: TeamMember[] = [
  { name: "Hasnain Fayyaz", role: "Founder · Head of Marketing", initials: "HF" },
  { name: "Sean Myk Daniel Jacinto", role: "Co-founder · AI Automation", initials: "SJ" },
  { name: "Jhade Japhet Banquiao", role: "Project Lead", initials: "JB" },
  { name: "James Vincent Calunsag", role: "UI/UX Designer", initials: "JC" },
  { name: "Haron Ian Diniay", role: "Backend Developer", initials: "HD" },
  { name: "Ralph Wyndril Andilab", role: "Mobile Developer", initials: "RA" },
  { name: "Rhett Wayne Manubag", role: "Mobile / Web App Developer", initials: "RM" },
];
