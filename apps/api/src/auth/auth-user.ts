export const actorRoles = ['passenger', 'driver'] as const;

export type ActorRole = (typeof actorRoles)[number];

export interface AuthUser {
  sub: string;
  role: ActorRole;
}
