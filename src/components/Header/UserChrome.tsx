import React from 'react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NotificationMenu } from './NotificationMenu';
import { UserMenu } from './UserMenu';

// Global user chrome: language switcher, notifications, and the user
// menu (profile, settings, admin, sign out). Rendered by every top-level
// view (dashboard and family tree) so these controls are reachable
// without opening a tree.
export const UserChrome: React.FC = () => (
  <div className="flex items-center space-x-4">
    <LanguageSwitcher />
    <NotificationMenu />
    <UserMenu />
  </div>
);
