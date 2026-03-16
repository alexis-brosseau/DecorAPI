import type { UUID } from 'crypto';

export default interface User {
    id: UUID;
    username: string;
    role: UserRole;
    email: string | undefined;
    tokenVersion: number;
    createdAt: Date;
}

export class UserRole {
    static ADMIN = new UserRole('admin')
    static USER = new UserRole('user')
    static GUEST = new UserRole('guest')

    private static roleHierarchy = [
        'admin',
        'user',
        'guest'
    ]

    public readonly value: string;

    private constructor(value: string) {
        this.value = value;
    }

    // Operator overloading for +, -, >, <
    [Symbol.toPrimitive](hint: string) {
        // For arithmetic and comparison, use hierarchy value
        if (hint === 'number') {
            return UserRole.length - UserRole.roleHierarchy.indexOf(this.value);
        }
        return this.value;
    }

    toString() {
        return this.value;
    }

    static fromString(value: string): UserRole | null {
        switch (value) {
            case 'admin': return UserRole.ADMIN;
            case 'user': return UserRole.USER;
            case 'guest': return UserRole.GUEST;
            default: return null;
        }
    }
}
