import { User } from '../../domain/entities/user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(tenantId: string, email: string): Promise<User | null>;
  listByTenant(tenantId: string): Promise<User[]>;
}

