import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { USER_REPOSITORY } from '../ports/user.repository.port';
import type { UserRepository } from '../ports/user.repository.port';

@Injectable()
export class BlockUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async execute(userId: string, tenantId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.getTenantId() !== tenantId) {
      throw new NotFoundException('Usuario no encontrado en esta institución.');
    }

    user.block();
    await this.userRepository.update(user);
  }
}

