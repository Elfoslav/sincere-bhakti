export type IdentityRole = "owner" | "editor";

export interface AuthorableIdentity {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  ownerId: string;
  isPersonal: boolean;
  role: IdentityRole;
}
