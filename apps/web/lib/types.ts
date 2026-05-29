export type VideoStatus =
  | "draft"
  | "queued"
  | "downloading"
  | "transcribing"
  | "translating"
  | "tts_generating"
  | "rendering"
  | "ready"
  | "failed";

export type StepStatus = "pending" | "processing" | "completed" | "failed";

export type JobStep = {
  id: string;
  name: string;
  status: StepStatus;
  progress: number;
  runtime_seconds: number;
  logs: string;
  sort_order: number;
};

export type Job = {
  id: string;
  video_id?: string;
  video_url: string;
  source_title?: string | null;
  thumbnail_url?: string | null;
  content: string;
  source_language: string;
  target_language: string;
  voice: string;
  voice_rate: string;
  platform: string;
  publish_date?: string | null;
  publish_time?: string | null;
  status: VideoStatus;
  progress: number;
  current_step: string;
  output_url?: string | null;
  error_message?: string | null;
  logs: string;
  created_at: string;
  updated_at: string;
  steps?: JobStep[];
};

export type Video = Job & {
  workflow_template?: string;
  last_updated?: string;
  latest_job?: Job | null;
};

export type JobCreateInput = Pick<
  Job,
  "video_url" | "content" | "source_language" | "target_language" | "voice" | "voice_rate" | "platform"
> & {
  publish_date?: string | null;
  publish_time?: string | null;
};

export type ReviewSubtitle = {
  start: string;
  end: string;
  original_text: string;
  translated_text: string;
};

export type VideoReview = {
  job: Job;
  review_status: "processing" | "ready" | "approved" | "failed" | string;
  source_video_url?: string | null;
  localized_video_url?: string | null;
  original_subtitle_url?: string | null;
  translated_subtitle_url?: string | null;
  subtitle_rows: ReviewSubtitle[];
  qa_checklist: string[];
};
