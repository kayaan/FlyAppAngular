export interface CurrentUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAtUtc: string;
  lastLoginAtUtc: string | null;
}