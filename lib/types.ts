export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  about: string | null;
  last_seen_at: string | null;
  show_last_seen: boolean;
  read_receipts: boolean;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: string;
  body: string | null;
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  media_path: string | null;
  media_width: number | null;
  media_height: number | null;
  media_duration_ms: number | null;
  media_waveform: number[] | null;
  expires_at: string | null;
};

export type LocalMessage = Message & { status?: "sending" | "failed"; localUrl?: string };

export type Reaction = { message_id: string; user_id: string; emoji: string };

export type PinRow = { message_id: string; pinned_at: string };

export type Note = {
  id: string;
  title: string;
  body: string;
  author_id: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Countdown = { id: string; title: string; target_date: string; created_by: string | null };

export type BucketItem = { id: string; title: string; done: boolean; created_by: string | null; created_at: string };

export type UsPhoto = {
  id: string;
  media_path: string;
  media_width: number | null;
  media_height: number | null;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
};
