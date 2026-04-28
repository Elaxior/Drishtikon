import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8010";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

export async function getHealth(): Promise<{ status: string }> {
  const response = await api.get<{ status: string }>("/health");
  return response.data;
}

export type SearchArticle = {
  title: string | null;
  description: string | null;
  source: string | null;
  bias: "LEFT" | "CENTER" | "RIGHT" | "UNKNOWN";
  claims: string[];
  link: string | null;
  pubDate: string | null;
  image_url: string | null;
  provider?: "newsdata" | "gnews" | "currents" | "newsapi";
};

export type ClaimGroup = {
  representative_claim: string;
  sources: string[];
  count: number;
  verdict?: "SUPPORTED" | "CONTRADICTED" | "MIXED" | "UNCERTAIN";
  confidence?: number;
  evidence?: Array<{
    source: string | null;
    title: string | null;
    link: string | null;
    bias: "LEFT" | "CENTER" | "RIGHT" | "UNKNOWN";
    snippet: string;
    similarity: number;
    has_contradiction_hint?: boolean;
  }>;
  reason?: string;
  verified_at?: string | null;
};

export type VerificationSummary = {
  label: string;
  overall_verdict: "SUPPORTED" | "CONTRADICTED" | "MIXED" | "UNCERTAIN";
  confidence: number;
  consensus_score: number;
  verified_claims: number;
  total_claim_groups?: number;
  skipped_claim_groups?: number;
  distribution: {
    supported: number;
    contradicted: number;
    mixed: number;
    uncertain: number;
  };
};

export type TrendingItem = {
  title: string | null;
  description: string | null;
  source: string | null;
  bias: "LEFT" | "CENTER" | "RIGHT" | "UNKNOWN";
  keyword: string;
  image_url: string | null;
  provider?: "newsdata" | "gnews" | "currents" | "newsapi";
};

export type TrendingResponse = {
  general: TrendingItem[];
  war: TrendingItem[];
  geopolitics: TrendingItem[];
};

export type AdminApiKeyStat = {
  key_mask: string;
  configured: boolean;
  used_today: number;
  remaining_today: number | null;
  success_calls: number;
  failed_calls: number;
  quota_related_errors: number;
};

export type AdminProviderUsage = {
  provider: "newsdata" | "gnews" | "currents" | "newsapi";
  display_name: string;
  configured: boolean;
  keys_configured: number;
  per_key_daily_limit: number | null;
  total_daily_limit: number | null;
  used_today: number;
  remaining_today: number | null;
  usage_percent: number | null;
  key_stats: AdminApiKeyStat[];
};

export type AdminApiUsageResponse = {
  date_utc: string;
  generated_at: string;
  providers: AdminProviderUsage[];
};

export type SearchResponse = {
  query: string;
  effective_query?: string;
  is_social_media_claim?: boolean;
  social_media_data?: Record<string, unknown> | null;
  articles: SearchArticle[];
  summary: string;
  claim_groups: ClaimGroup[];
  consensus: number;
  verification?: VerificationSummary;
  warning?: string | null;
  total_sources?: number;
  providers?: Record<string, number>;
  coverage?: {
    left: number;
    center: number;
    right: number;
    unknown: number;
    tracked_total: number;
    has_full_spectrum: boolean;
    fallback_used?: boolean;
    distribution: {
      left_pct: number;
      center_pct: number;
      right_pct: number;
    };
  };
};

export async function getTrending(): Promise<TrendingResponse> {
  const response = await api.get<TrendingResponse>("/trending");
  return response.data;
}

export async function searchNews(query: string): Promise<SearchResponse> {
  const trimmedQuery = query.trim();
  const response = await api.get<SearchResponse>("/search", {
    params: { q: trimmedQuery },
  });
  return response.data;
}

export async function getAdminApiUsage(token: string): Promise<AdminApiUsageResponse> {
  const response = await api.get<AdminApiUsageResponse>("/admin/api-usage", {
    headers: {
      "x-admin-token": token,
    },
  });
  return response.data;
}
