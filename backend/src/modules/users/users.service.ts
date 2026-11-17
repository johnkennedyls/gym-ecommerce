import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Role } from '../../common/enums';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/user.dto';
import { PaginatedResult, paginate } from '../../common/dto/pagination';

export type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  phone: string | null;
  birthDate: string | null;
  isActive: boolean;
  createdAt: Date;
};

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  phone: user.phone ?? null,
  birthDate: user.birthDate ?? null,
  isActive: user.isActive,
  createdAt: user.createdAt,
});

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repository: Repository<User>) {}

  toPublic(user: User): PublicUser {
    return toPublicUser(user);
  }

  create(data: DeepPartial<User>): Promise<User> {
    return this.repository.save(this.repository.create(data));
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('El usuario no existe');
    return user;
  }

  findByIdForAuth(id: string): Promise<User | null> {
    return this.repository.findOne({ where: { id } });
  }

  async list(page: number, limit: number, role?: Role, search?: string): Promise<PaginatedResult<PublicUser>> {
    const query = this.repository.createQueryBuilder('user');
    if (role) query.andWhere('user.role = :role', { role });
    if (search) {
      query.andWhere('(lower(user.email) LIKE :term OR lower(user.firstName) LIKE :term OR lower(user.lastName) LIKE :term)', {
        term: `%${search.toLowerCase()}%`,
      });
    }
    const [items, total] = await query
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return paginate(items.map(toPublicUser), total, page, limit);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<PublicUser> {
    const user = await this.findById(userId);
    user.firstName = dto.firstName ?? user.firstName;
    user.lastName = dto.lastName ?? user.lastName;
    user.phone = dto.phone ?? user.phone;
    user.birthDate = dto.birthDate ?? user.birthDate;
    await this.repository.save(user);
    return toPublicUser(user);
  }

  async changeRole(userId: string, role: Role): Promise<PublicUser> {
    const user = await this.findById(userId);
    user.role = role;
    await this.repository.save(user);
    return toPublicUser(user);
  }

  async setActive(userId: string, isActive: boolean): Promise<PublicUser> {
    const user = await this.findById(userId);
    user.isActive = isActive;
    await this.repository.save(user);
    return toPublicUser(user);
  }

  setPassword(user: User, passwordHash: string): Promise<User> {
    user.passwordHash = passwordHash;
    return this.repository.save(user);
  }

  countByRole(): Promise<{ role: Role; total: string }[]> {
    return this.repository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'total')
      .groupBy('user.role')
      .getRawMany();
  }
}
