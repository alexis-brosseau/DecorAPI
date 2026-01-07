import type { UUID } from "crypto";

export default interface User {
    id: UUID;
    name: string;
    surname: string;
    email: string;
    role: UserRole;
    tokenVersion: number;
    createdAt: Date;
}

export class UserRole {
    static ADMIN = new UserRole('admin')
    static USER = new UserRole('user')

    private static roleHierarchy = [
        'admin',
        'user'
    ]

    private constructor(public readonly value: string) {}

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
            default: return null;
        }
    }
}
