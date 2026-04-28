import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "./firebase";
import type { SearchArticle, TrendingItem } from "./api";

type BiasType = "LEFT" | "CENTER" | "RIGHT" | "UNKNOWN";
type ProviderType = "newsdata" | "gnews" | "currents" | "newsapi";

export type SavedArticleOrigin = "home" | "trending" | "analysis";

export type SaveArticleInput = {
  title: string | null;
  description: string | null;
  source: string | null;
  bias: BiasType;
  imageUrl: string | null;
  provider?: ProviderType;
  link: string | null;
  pubDate: string | null;
  keyword?: string;
  searchQuery?: string;
  origin: SavedArticleOrigin;
};

export type SavedArticle = SaveArticleInput & {
  id: string;
  userId: string;
  savedAt: string;
};

function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase();
}

function makeIdentityKey(input: SaveArticleInput): string {
  const normalizedLink = normalizeText(input.link);
  if (normalizedLink) {
    return `link:${normalizedLink}`;
  }

  const normalizedSource = normalizeText(input.source);
  const normalizedTitle = normalizeText(input.title);
  const normalizedDate = normalizeText(input.pubDate);
  const normalizedKeyword = normalizeText(input.keyword);

  return [
    `origin:${input.origin}`,
    `source:${normalizedSource}`,
    `title:${normalizedTitle}`,
    `date:${normalizedDate}`,
    `keyword:${normalizedKeyword}`,
  ].join("|");
}

function hashString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return Math.abs(hash >>> 0).toString(36);
}

export function getSavedArticleId(input: SaveArticleInput): string {
  return `art_${hashString(makeIdentityKey(input))}`;
}

export function toSaveArticleInputFromTrending(
  item: TrendingItem,
  origin: Extract<SavedArticleOrigin, "home" | "trending">,
): SaveArticleInput {
  const normalizedKeyword = item.keyword?.trim();
  return {
    title: item.title,
    description: item.description,
    source: item.source,
    bias: item.bias,
    imageUrl: item.image_url,
    provider: item.provider,
    link: null,
    pubDate: null,
    keyword: item.keyword,
    searchQuery: normalizedKeyword || item.title || undefined,
    origin,
  };
}

export function toSaveArticleInputFromSearch(
  item: SearchArticle,
  searchQuery: string,
): SaveArticleInput {
  return {
    title: item.title,
    description: item.description,
    source: item.source,
    bias: item.bias,
    imageUrl: item.image_url,
    provider: item.provider,
    link: item.link,
    pubDate: item.pubDate,
    searchQuery,
    origin: "analysis",
  };
}

function getSavedArticlesCollection(userId: string) {
  if (!db) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }

  return collection(db, "users", userId, "savedArticles");
}

function coerceSavedArticle(
  value: Record<string, unknown> | undefined,
  fallbackId: string,
  fallbackUserId: string,
): SavedArticle {
  return {
    id: typeof value?.id === "string" ? value.id : fallbackId,
    userId: typeof value?.userId === "string" ? value.userId : fallbackUserId,
    title: typeof value?.title === "string" || value?.title === null ? (value.title as string | null) : null,
    description:
      typeof value?.description === "string" || value?.description === null
        ? (value.description as string | null)
        : null,
    source: typeof value?.source === "string" || value?.source === null ? (value.source as string | null) : null,
    bias: (["LEFT", "CENTER", "RIGHT", "UNKNOWN"] as const).includes(value?.bias as BiasType)
      ? (value?.bias as BiasType)
      : "UNKNOWN",
    imageUrl:
      typeof value?.imageUrl === "string" || value?.imageUrl === null
        ? (value.imageUrl as string | null)
        : null,
    provider: (["newsdata", "gnews", "currents", "newsapi"] as const).includes(value?.provider as ProviderType)
      ? (value?.provider as ProviderType)
      : undefined,
    link: typeof value?.link === "string" || value?.link === null ? (value.link as string | null) : null,
    pubDate: typeof value?.pubDate === "string" || value?.pubDate === null ? (value.pubDate as string | null) : null,
    keyword: typeof value?.keyword === "string" ? value.keyword : undefined,
    searchQuery: typeof value?.searchQuery === "string" ? value.searchQuery : undefined,
    origin: (["home", "trending", "analysis"] as const).includes(value?.origin as SavedArticleOrigin)
      ? (value?.origin as SavedArticleOrigin)
      : "analysis",
    savedAt: typeof value?.savedAt === "string" ? value.savedAt : new Date().toISOString(),
  };
}

export async function saveArticleForUser(userId: string, input: SaveArticleInput): Promise<string> {
  const id = getSavedArticleId(input);
  const payload: SavedArticle = {
    ...input,
    id,
    userId,
    savedAt: new Date().toISOString(),
  };

  await setDoc(doc(getSavedArticlesCollection(userId), id), payload, { merge: true });
  return id;
}

export async function removeSavedArticleForUser(userId: string, articleId: string): Promise<void> {
  await deleteDoc(doc(getSavedArticlesCollection(userId), articleId));
}

export function subscribeSavedArticles(
  userId: string,
  onChange: (articles: SavedArticle[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const savedArticlesQuery = query(getSavedArticlesCollection(userId), orderBy("savedAt", "desc"));

  return onSnapshot(
    savedArticlesQuery,
    (snapshot) => {
      const articles = snapshot.docs.map((snapshotDoc) => {
        const value = snapshotDoc.data() as Record<string, unknown> | undefined;
        return coerceSavedArticle(value, snapshotDoc.id, userId);
      });
      onChange(articles);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    },
  );
}
