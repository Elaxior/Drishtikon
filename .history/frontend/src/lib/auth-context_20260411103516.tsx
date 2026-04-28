import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { auth, firebaseConfigError, isFirebaseConfigured } from "./firebase";
import {
  getSavedArticleId,
  removeSavedArticleForUser,
  saveArticleForUser,
  subscribeSavedArticles,
  type SaveArticleInput,
  type SavedArticle,
} from "./saved-articles";

type AuthContextValue = {
  user: User | null;
  isAuthLoading: boolean;
  authError: string;
  savedArticles: SavedArticle[];
  savedArticleIds: Set<string>;
  isSavedArticlesLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  saveArticle: (input: SaveArticleInput) => Promise<string>;
  removeSavedArticle: (articleId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [savedArticles, setSavedArticles] = useState<SavedArticle[]>([]);
  const [isSavedArticlesLoading, setIsSavedArticlesLoading] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthError(firebaseConfigError || "Firebase is not configured.");
      setIsAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setIsAuthLoading(false);
        setAuthError("");
      },
      (error) => {
        setAuthError(error.message);
        setIsAuthLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedArticles([]);
      setIsSavedArticlesLoading(false);
      return;
    }

    setIsSavedArticlesLoading(true);
    const unsubscribe = subscribeSavedArticles(
      user.uid,
      (articles) => {
        setSavedArticles(articles);
        setIsSavedArticlesLoading(false);
      },
      (error) => {
        setAuthError(error.message);
        setIsSavedArticlesLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error(firebaseConfigError || "Firebase is not configured.");
    }

    setAuthError("");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
    setSavedArticles([]);
  };

  const saveArticle = async (input: SaveArticleInput) => {
    if (!user) {
      throw new Error("AUTH_REQUIRED");
    }

    const articleId = getSavedArticleId(input);
    if (savedArticles.some((article) => article.id === articleId)) {
      return articleId;
    }

    const optimisticArticle: SavedArticle = {
      ...input,
      id: articleId,
      userId: user.uid,
      savedAt: new Date().toISOString(),
    };

    setSavedArticles((previous) => [optimisticArticle, ...previous]);

    try {
      await saveArticleForUser(user.uid, input);
      return articleId;
    } catch (error) {
      setSavedArticles((previous) => previous.filter((article) => article.id !== articleId));
      throw error;
    }
  };

  const removeSavedArticle = async (articleId: string) => {
    if (!user) {
      throw new Error("AUTH_REQUIRED");
    }

    const previousState = savedArticles;
    setSavedArticles((previous) => previous.filter((article) => article.id !== articleId));

    try {
      await removeSavedArticleForUser(user.uid, articleId);
    } catch (error) {
      setSavedArticles(previousState);
      throw error;
    }
  };

  const savedArticleIds = useMemo(
    () => new Set(savedArticles.map((article) => article.id)),
    [savedArticles],
  );

  const value: AuthContextValue = {
    user,
    isAuthLoading,
    authError,
    savedArticles,
    savedArticleIds,
    isSavedArticlesLoading,
    signInWithGoogle,
    logout,
    saveArticle,
    removeSavedArticle,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
