import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 5000,
});

export async function getHealth(): Promise<{ status: string }> {
  const response = await api.get<{ status: string }>("/health");
  return response.data;
}

export type SearchArticle = {
  title: string | null;
  description: string | null;
  source: string | null;
  link: string | null;
  pubDate: string | null;
};

export type SearchResponse = {
  query: string;
  articles: SearchArticle[];
};

export async function searchNews(query: string): Promise<SearchResponse> {
  const trimmedQuery = query.trim();
  const response = await api.get<SearchResponse>("/search", {
    params: { q: trimmedQuery },
  });
  return response.data;
}
