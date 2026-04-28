import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { auth, firebaseConfigError, isFirebaseConfigured } from "./firebase";
import { AuthContext, type AuthContextValue } from "./auth-store";
import {
  getSavedArticleId,
  removeSavedArticleForUser,
  saveArticleForUser,
  subscribeSavedArticles,
  type SaveArticleInput,
  type SavedArticle,
} from "./saved-articles";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(isFirebaseConfigured && Boolean(auth));
  const [authError, setAuthError] = useState(
    isFirebaseConfigured && auth ? "" : (firebaseConfigError || "Firebase is not configured."),
  );
  const [savedArticles, setSavedArticles] = useState<SavedArticle[]>([]);
  const [isSavedArticlesLoading, setIsSavedArticlesLoading] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setIsAuthLoading(false);
        setAuthError("");
        if (!nextUser) {
          setSavedArticles([]);
          setIsSavedArticlesLoading(false);
        } else {
          setIsSavedArticlesLoading(true);
        }
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
      return;
    }

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

  const signInWithEmail = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error(firebaseConfigError || "Firebase is not configured.");
    }

    setAuthError("");
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error(firebaseConfigError || "Firebase is not configured.");
    }

    setAuthError("");
    await createUserWithEmailAndPassword(auth, email.trim(), password);
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
    signInWithEmail,
    signUpWithEmail,
    logout,
    saveArticle,
    removeSavedArticle,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
