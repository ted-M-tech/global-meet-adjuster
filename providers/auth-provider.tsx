'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { signIn as serverSignIn, signOut as serverSignOut } from '@/app/actions/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRefreshed = useRef(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      // Auto-refresh server session when client-side auth is valid
      // This handles expired session cookies (5-day maxAge)
      if (firebaseUser && !sessionRefreshed.current) {
        sessionRefreshed.current = true;
        try {
          const idToken = await firebaseUser.getIdToken();
          const result = await serverSignIn(idToken);
          if (!result.success) {
            console.error('[AuthProvider] Session refresh failed:', result.error);
          }
        } catch (err) {
          console.error('[AuthProvider] Session refresh error:', err);
        }
      }
    });
  }, []);

  const handleSignIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
  }, []);

  const handleSignOut = useCallback(async () => {
    await firebaseSignOut(auth);
    await serverSignOut();
    sessionRefreshed.current = false;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn: handleSignIn, signOut: handleSignOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
