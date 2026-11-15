import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const LIBRARY_TYPES: Record<string, { label: string; emoji: string }> = {
  digital_book: { label: "Digital book", emoji: "📖" },
  textbook: { label: "Textbook", emoji: "📚" },
  pdf_notes: { label: "PDF notes", emoji: "📝" },
  study_guide: { label: "Study guide", emoji: "🧭" },
  past_paper: { label: "Past paper", emoji: "🗂️" },
  practice_questions: { label: "Practice questions", emoji: "❓" },
  worksheet: { label: "Worksheet", emoji: "📄" },
  video: { label: "Video", emoji: "🎬" },
  website: { label: "Website", emoji: "🌐" },
  other: { label: "Other", emoji: "📎" },
};

export const RESOURCE_COLUMNS =
  "id, source, submitter_id, subject_id, title, description, type, author, cover_path, file_name, file_size, file_mime, link_url, downloadable, published_at, visibility, deleted_at, views_count, downloads_count, rating_avg, rating_count, review_count, created_at, updated_at, submitter:profiles!library_resources_submitter_id_fkey(full_name, avatar), subject:study_categories!library_resources_subject_id_fkey(name, slug, emoji)";

export type LibraryResource = {
  id: string; source: string; submitter_id: string | null; subject_id: string; title: string; description: string; type: string; author: string;
  cover_path: string | null; file_name: string | null; file_size: number | null; file_mime: string | null; link_url: string | null;
  downloadable: boolean; published_at: string | null; visibility: string; deleted_at: string | null; views_count: number; downloads_count: number;
  rating_avg: number; rating_count: number; review_count: number; created_at: string; updated_at: string;
  submitter: { full_name: string; avatar: string } | null;
  subject: { name: string; slug: string; emoji: string } | null;
};

// Library files are private: covers get a one-hour link, only for files the signed-in person may read.
export async function signCovers(supabase: Supabase, paths: (string | null)[]) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return new Map<string, string>();
  const { data } = await supabase.storage.from("library-files").createSignedUrls(unique, 3600);
  return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl]));
}

export const STATUS_LABEL: Record<string, string> = { draft: "Draft", pending: "Pending review", approved: "Approved", rejected: "Rejected" };

export const ACCEPT = ".pdf,.docx,.pptx,.xlsx,.txt,.jpg,.jpeg,.png,.webp";
export const MAX_FILE_MB = 25;
