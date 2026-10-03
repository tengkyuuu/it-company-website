/** Shapes mirroring supabase/schema.sql. Hand-written (no codegen step). */

/**
 * Panel roles. `owner` manages the team; `admin` edits all content. The old
 * `editor` role is retired — schema.sql migrates any remaining editors to admin.
 */
export type Role = "owner" | "admin";

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  /** switched off by the owner; is_staff() is false while true */
  disabled: boolean;
  /**
   * JWTs issued (iat) before this are no longer staff. 'epoch' until the
   * first revoke_user_sessions(); only that function moves it.
   */
  sessions_valid_after: string;
  created_at: string;
};

/** Roles an invite can grant: only `admin` (owner is never invitable). */
export type InviteRole = Exclude<Role, "owner">;

export type InvitationRow = {
  /** always lower-cased */
  email: string;
  role: InviteRole;
  full_name: string | null;
  invited_by: string | null;
  created_at: string;
  last_sent_at: string | null;
  accepted_at: string | null;
};

/**
 * One row on /admin/team: a profile merged with its auth status
 * (auth.admin.listUsers) and invitation. Built server-side in the page.
 */
export type TeamMemberView = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  /** pending = invited, password not set yet */
  status: "active" | "pending";
  /** profiles.disabled — optional so existing builders of this view still compile */
  disabled?: boolean;
  /** pending, but they did open the link (have a session, no password yet) */
  opened: boolean;
  /** preformatted on the server, so the client can't hydrate a different date */
  detail: string;
};

export type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  url: string;
  live_url: string | null;
  year: string;
  summary: string;
  description: string;
  highlights: string[];
  tags: string[];
  dots: string[];
  img: string | null;
  img2: string | null;
  // case-study detail — optional on read because a database whose schema
  // predates them simply won't return these columns
  client?: string;
  industry?: string;
  timeline?: string;
  services?: string[];
  team?: string[];
  stack?: string[];
  challenge?: string;
  approach?: string;
  outcome?: string;
  results?: ProjectResult[];
  gallery?: GalleryShot[];
  testimonial_quote?: string;
  testimonial_author?: string;
  testimonial_role?: string;
  // live-embed probe (Phase 1) — optional for the same reason as above.
  /** can live_url be framed? null = never checked (show the screenshot) */
  embeddable?: boolean | null;
  /** why not, e.g. "X-Frame-Options: DENY"; '' when embeddable or unchecked */
  embed_reason?: string;
  embed_checked_at?: string | null;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProjectResult = { value: string; label: string };
export type GalleryShot = { src: string; caption?: string; kind: "desktop" | "mobile" };

export type SocialLink = { label: string; href: string };

export type SiteSettingsRow = {
  id: number;
  brand_name: string;
  tagline: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  hours: string;
  availability: string;
  available: boolean;
  socials: SocialLink[];
  updated_at: string;
};

export type ServiceRow = {
  id: string;
  slug: string;
  title: string;
  blurb: string;
  detail: string;
  deliverables: string[];
  /** must match the IconName union in lib/services.ts */
  icon: string;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TeamMemberRow = {
  id: string;
  name: string;
  role: string;
  initials: string;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type LeadKind = "contact" | "chat" | "application";

export type LeadRow = {
  id: string;
  kind: LeadKind;
  name: string | null;
  email: string | null;
  service: string | null;
  message: string | null;
  transcript: { role: "user" | "assistant"; content: string }[] | null;
  turns: number | null;
  /** HMAC of the visitor's IP (lib/security.ts). The raw `ip` column is gone. */
  ip_hash: string | null;
  handled: boolean;
  /** set when staff answer from the inbox */
  replied_at: string | null;
  replied_by: string | null;
  /** kind 'application': the job applied for (null if that job was deleted) */
  job_id: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Phase 1 tables
// ---------------------------------------------------------------------------

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  summary: string;
  description: string;
  features: string[];
  image: string | null;
  /** same shape as projects.gallery */
  gallery: GalleryShot[];
  /** free-text badge ("Beta", "Coming soon"); '' = none */
  status: string;
  cta_label: string;
  cta_url: string;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type EmploymentType = "full-time" | "part-time" | "contract" | "internship";
export type Workplace = "onsite" | "hybrid" | "remote";

export type JobRow = {
  id: string;
  slug: string;
  title: string;
  department: string;
  location: string;
  employment_type: EmploymentType;
  workplace: Workplace;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  /** a date ('YYYY-MM-DD'), not a timestamp; null = open until unpublished */
  closes_at: string | null;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** markdown */
  body: string;
  cover_image: string | null;
  tags: string[];
  author_name: string;
  published: boolean;
  /** stamped by the DB on first publish when left null */
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Tables carrying the revision / activity / site_revision triggers. Their
 * names ARE the `entity_type` values in content_revisions and activity_log —
 * also the allow-list a restore must check before writing a snapshot back.
 */
export const CONTENT_TABLES = [
  "projects",
  "services",
  "team_members",
  "site_settings",
  "products",
  "jobs",
  "posts",
] as const;

export type ContentEntityType = (typeof CONTENT_TABLES)[number];

export type ContentRevisionRow = {
  /** bigint identity — PostgREST returns it as a JSON number */
  id: number;
  entity_type: ContentEntityType;
  /** the row's id as text ('1' for site_settings) */
  entity_id: string;
  /** to_jsonb(OLD): the full row as it was BEFORE the change */
  snapshot: Record<string, unknown>;
  /** null for service-role writes */
  actor_id: string | null;
  created_at: string;
};

/** Written by the content trigger. */
export type ContentActivityAction = "create" | "update" | "delete" | "publish" | "unpublish";

/**
 * Content actions come from the trigger; everything else is inserted by
 * server code with the service role, dotted by area: "team.invite",
 * "auth.login", "content.restore", "inbox.reply", "chat.takeover", …
 */
export type ActivityAction = ContentActivityAction | (string & {});

export type ActivityRow = {
  id: number;
  actor_id: string | null;
  /** profiles.full_name → email → '' at the time of the action */
  actor_name: string;
  action: ActivityAction;
  /** a ContentEntityType for content rows; free text for server-logged events */
  entity_type: string;
  entity_id: string;
  /** content rows: { label, slug? } — label survives the row being deleted */
  detail: { label?: string; slug?: string } & Record<string, unknown>;
  created_at: string;
};

export type ChatMode = "ai" | "human";
export type ChatMessageRole = "visitor" | "ai" | "human";

export type ChatSessionRow = {
  /** generated by the visitor's browser */
  id: string;
  mode: ChatMode;
  ip_hash: string | null;
  taken_over_by: string | null;
  admin_read_at: string | null;
  created_at: string;
  /** kept current by a trigger on chat_messages insert */
  last_message_at: string;
  // Phase 4 (takeover). Optional on read: a database whose schema predates
  // them won't return these columns.
  /** sha256 hex of the visitor's key — never select this into a page */
  visitor_key_hash?: string | null;
  /** the visitor pressed "Talk to a person"; cleared on hand-back */
  wants_human_at?: string | null;
  taken_over_at?: string | null;
  /** newest visitor message (trigger) — unread = newer than admin_read_at */
  last_visitor_at?: string | null;
  /** first visitor message, clipped (trigger) */
  opening?: string | null;
  /** newest message of any role, clipped (trigger) */
  last_preview?: string | null;
  last_role?: ChatMessageRole | null;
  message_count?: number;
};

/** One answer sent (or attempted) from /admin/inbox. Service-role writes only. */
export type LeadReplyRow = {
  id: string;
  lead_id: string;
  author_id: string | null;
  author_name: string;
  to_email: string;
  subject: string;
  body: string;
  status: "sent" | "failed";
  /** Resend's message id when sent */
  provider_id: string | null;
  /** why it wasn't sent; '' when it was */
  error: string;
  sent_at: string | null;
  created_at: string;
};

export type ChatMessageRow = {
  id: number;
  session_id: string;
  role: ChatMessageRole;
  content: string;
  /** the staff member, for role 'human'; null otherwise */
  author_id: string | null;
  created_at: string;
};

export type StatusReportKind = "tests" | "lighthouse";

export type StatusReportRow = {
  kind: StatusReportKind;
  payload: Record<string, unknown>;
  commit_sha: string;
  received_at: string;
};

/** The single row (id = 1) Phase 2 subscribes to for live updates. */
export type SiteRevisionRow = {
  id: 1;
  /** bigint; fits a JS number for any realistic number of edits */
  rev: number;
  updated_at: string;
};

export type AuthTokenPurpose = "invite" | "reset";

/** Service role only — never readable with the anon key or a user session. */
export type AuthTokenRow = {
  id: string;
  /** hex sha256 of the raw token; the raw token is never stored */
  token_hash: string;
  purpose: AuthTokenPurpose;
  /** always lower-cased */
  email: string;
  user_id: string | null;
  expires_at: string;
  consumed_at: string | null;
  created_by: string | null;
  created_at: string;
};

/** Service role only. Keys are HMACs — raw IPs/emails never reach the DB. */
export type SecurityLimitRow = {
  key: string;
  hits: number;
  window_ends_at: string;
};

/** True when the Supabase env vars are present, i.e. the CMS is wired up. */
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
