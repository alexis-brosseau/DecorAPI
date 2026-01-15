import type { UUID } from 'crypto';

export class IdentityRole {
    static ADMIN = new IdentityRole('admin')
    static USER = new IdentityRole('user')
    static GUEST = new IdentityRole('guest')

    private static roleHierarchy = [
      'admin',
      'user',
      'guest'
    ]

    private constructor(public readonly value: string) {}

    // Operator overloading for ==, >, <
    [Symbol.toPrimitive](hint: string) {
      // For arithmetic and comparison, use hierarchy value
      if (hint === 'number') {
        return IdentityRole.length - IdentityRole.roleHierarchy.indexOf(this.value);
      }
      return this.value;
    }

    toString() {
      return this.value;
    }

    static fromString(value: string): IdentityRole | null {
      switch (value) {
        case 'admin': return IdentityRole.ADMIN;
        case 'user': return IdentityRole.USER;
        case 'guest': return IdentityRole.USER;
        default: return null;
      }
    }
}


export class Identity {
  private constructor(
    public readonly kind: 'user' | 'guest',
    public readonly id: UUID,
    public readonly role: IdentityRole,
    public readonly userRole?: string
  ) {}

  static user(userId: UUID, userRole: string = 'user'): Identity {
    return new Identity('user', userId, IdentityRole.USER, userRole);
  }

  static guest(guestId: UUID): Identity {
    return new Identity('guest', guestId, IdentityRole.GUEST);
  }

  isUser(): boolean {
    return this.kind === 'user';
  }

  isGuest(): boolean {
    return this.kind === 'guest';
  }

  hasRole(role: IdentityRole): boolean {
    return this.role >= role;
  }

  static fromAuth(
    userId?: UUID | null,
    guestId?: UUID | null,
    userRole?: string
  ): Identity | null {
    if (userId) return Identity.user(userId, userRole);
    if (guestId) return Identity.guest(guestId);
    return null;
  }

  static require(
    userId?: UUID | null,
    guestId?: UUID | null,
    userRole?: string
  ): Identity {
    const identity = Identity.fromAuth(userId, guestId, userRole);
    if (!identity) {
      const err = new Error('Authentication required');
      (err as any).status = 401;
      throw err;
    }
    return identity;
  }
}
