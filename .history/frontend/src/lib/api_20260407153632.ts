import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 30000,
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

export type SearchResponse = {
  query: string;
  effective_query?: string;
  is_social_media_claim?: boolean;
  social_media_data?: {
    original_input: string;
    platform?: string | null;
    extracted_claim: string;
    is_social_media: boolean;
    success: boolean;
    error?: string;
  } | null;
  articles: SearchArticle[];
  summary: string;
  claim_groups: ClaimGroup[];
  consensus: number;
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
