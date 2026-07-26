import { useEffect } from 'react';

import { useApiQuery } from '@/api/useApiQuery';
import { DEFAULT_USER_ID, useCurrentUser } from '@/context/CurrentUser';
import type { User, UserRole } from 'shared/types';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '@/components/ui/select';

const ROLE_LABELS: Record<UserRole, string> = {
  employee: 'Employee',
  manager: 'Manager',
  finance: 'Finance',
};

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function AppHeader() {
  const { currentUser, setCurrentUser } = useCurrentUser();
  const { data: users } = useApiQuery<User[]>('/users');

  // Bootstraps the very first load: the client always sends the last-picked
  // (or default) id as X-User-Id, but the full User object only exists once
  // /api/users resolves — this is what turns that id into a real currentUser.
  // Matches by DEFAULT_USER_ID rather than users[0] so this stays correct
  // even if the seed data's ordering ever changes.
  useEffect(() => {
    if (!currentUser && users && users.length > 0) {
      setCurrentUser(users.find((user) => user.id === DEFAULT_USER_ID) ?? users[0]);
    }
  }, [currentUser, users, setCurrentUser]);

  function handleValueChange(id: string) {
    const user = users?.find((candidate) => candidate.id === id);
    if (user) {
      setCurrentUser(user);
    }
  }

  return (
    <header className="flex items-center justify-between border-b px-6 py-3 bg-white">
      <span className="text-sm font-semibold">Expensely</span>
      {currentUser && (
        <Select value={currentUser.id} onValueChange={handleValueChange}>
          <SelectTrigger className="h-auto gap-2 rounded-sm px-2.5 py-1.5">
            <Avatar name={currentUser.name} />
            <span className="text-sm">
              {currentUser.name}{' '}
              <span className="text-muted-foreground">
                &middot; {ROLE_LABELS[currentUser.role]}
              </span>
            </span>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              <SelectLabel>Switch user</SelectLabel>
              {users?.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  <Avatar name={user.name} />
                  <span className="flex flex-col">
                    <span>{user.name}</span>
                    <span className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
    </header>
  );
}
