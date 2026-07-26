import { createContext, useContext, useState } from 'react';

import type { User } from 'shared/types';

// api/client.ts (Phase 10, next) reads the user id straight off this same
// key for the X-User-Id header — it can't call useContext (it isn't a
// component), so localStorage is the shared channel between the two.
export const CURRENT_USER_STORAGE_KEY = 'currentUser';

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
  const [currentUser, setCurrentUserState] = useState<User | null>(readStoredUser);

  function setCurrentUser(user: User) {
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
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
