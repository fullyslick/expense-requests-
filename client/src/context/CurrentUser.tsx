import { createContext, useContext, useState } from 'react';

import { setCurrentUserId } from '@/api/client';
import type { User } from 'shared/types';

export const CURRENT_USER_STORAGE_KEY = 'currentUser';

// Nothing is stored on a first visit, but GET /api/users itself requires a
// valid X-User-Id — so the client needs *some* id to bootstrap with before
// it has fetched the user list and can hydrate the real `currentUser` object.
// Exported so AppHeader can match against the same id once /api/users
// resolves, rather than assuming it's whichever user happens to be first.
export const DEFAULT_USER_ID = 'u_alice';

type CurrentUserContextValue = {
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

function readStoredUser(): User | null {
  const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User | null>(() => {
    const user = readStoredUser();
    setCurrentUserId(user?.id ?? DEFAULT_USER_ID);
    return user;
  });

  function setCurrentUser(user: User) {
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
    setCurrentUserId(user.id);
    setCurrentUserState(user);
  }

  return (
    <CurrentUserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUserContextValue {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error('useCurrentUser must be used within a CurrentUserProvider');
  }
  return context;
}
