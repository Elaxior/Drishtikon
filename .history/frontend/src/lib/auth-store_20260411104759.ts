import { createContext, useContext } from "react";
import type { User } from "firebase/auth";

import type { SaveArticleInput, SavedArticle } from "./saved-articles";

export type AuthContextValue = {
  user: User | null;
  isAuthLoading: boolean;
  authError: string;
  savedArticles: SavedArticle[];
  savedArticleIds: Set<string>;
  isSavedArticlesLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  saveArticle: (input: SaveArticleInput) => Promise<string>;
  removeSavedArticle: (articleId: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
