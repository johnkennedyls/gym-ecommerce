import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThanOrEqual, Repository, UpdateResult } from 'typeorm';
import { MembershipPlan } from './entities/membership-plan.entity';
import { UserMembership } from './entities/user-membership.entity';
import { MembershipStatus } from '../../common/enums';
import { UpdatePlanDto, UpsertPlanDto } from './dto/memberships.dto';
import { resolveMembershipWindow } from './membership-rules';

export type PlanView = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  durationDays: number;
  accessLevel: string;
  includesClasses: boolean;
  isActive: boolean;
};

export type MembershipView = {
  id: string;
  plan: { id: string; name: string };
  startDate: Date;
  endDate: Date;
  status: MembershipStatus;
  daysRemaining: number;
};

const toPlanView = (plan: MembershipPlan): PlanView => ({
  id: plan.id,
  name: plan.name,
  description: plan.description ?? null,
  price: Number(plan.price),
  currency: plan.currency,
  durationDays: plan.durationDays,
  accessLevel: plan.accessLevel,
  includesClasses: plan.includesClasses,
  isActive: plan.isActive,
});

const toMembershipView = (membership: UserMembership): MembershipView => ({
  id: membership.id,
  plan: { id: membership.planId, name: membership.plan?.name ?? '' },
  startDate: membership.startDate,
  endDate: membership.endDate,
  status: membership.status,
  daysRemaining: Math.max(
    0,
    Math.ceil((membership.endDate.getTime() - Date.now()) / 86_400_000),
  ),
});

@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(MembershipPlan) private readonly plans: Repository<MembershipPlan>,
    @InjectRepository(UserMembership) private readonly memberships: Repository<UserMembership>,
  ) {}

  /** RF-10 Consultar planes disponibles. */
  async listPlans(): Promise<PlanView[]> {
    return (await this.plans.find({ where: { isActive: true }, order: { price: 'ASC' } })).map(toPlanView);
  }

  async getPlanEntity(id: string): Promise<MembershipPlan> {
    const plan = await this.plans.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('El plan de membresía no existe');
    return plan;
  }

  async listAllPlans(): Promise<PlanView[]> {
    return (await this.plans.find({ order: { price: 'ASC' } })).map(toPlanView);
  }

  async createPlan(dto: UpsertPlanDto): Promise<PlanView> {
    const saved = await this.plans.save(
      this.plans.create({
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price.toFixed(2),
        currency: 'COP',
        durationDays: dto.durationDays,
        accessLevel: dto.accessLevel,
        includesClasses: dto.includesClasses ?? false,
        isActive: dto.isActive ?? true,
      }),
    );
    return toPlanView(saved);
  }

  async updatePlan(id: string, dto: UpdatePlanDto): Promise<PlanView> {
    const plan = await this.getPlanEntity(id);
    if (dto.name !== undefined) plan.name = dto.name;
    if (dto.description !== undefined) plan.description = dto.description;
    if (dto.price !== undefined) plan.price = dto.price.toFixed(2);
    if (dto.durationDays !== undefined) plan.durationDays = dto.durationDays;
    if (dto.accessLevel !== undefined) plan.accessLevel = dto.accessLevel;
    if (dto.includesClasses !== undefined) plan.includesClasses = dto.includesClasses;
    if (dto.isActive !== undefined) plan.isActive = dto.isActive;
    await this.plans.save(plan);
    return toPlanView(plan);
  }

  /** RF-10 Historial de membresías del cliente, con vencimientos sincronizados. */
  async myMemberships(userId: string): Promise<MembershipView[]> {
    await this.expireOverdue(userId);
    const items = await this.memberships.find({
      where: { userId },
      relations: { plan: true },
      order: { startDate: 'DESC' },
    });
    return items.map(toMembershipView);
  }

  async findActive(userId: string): Promise<UserMembership | null> {
    await this.expireOverdue(userId);
    return this.memberships.findOne({
      where: { userId, status: MembershipStatus.ACTIVE },
      relations: { plan: true },
      order: { endDate: 'DESC' },
    });
  }

  /** RF-10 Activación dentro de la transacción del pedido pagado. */
  async activateWithin(
    manager: EntityManager,
    userId: string,
    planId: string,
  ): Promise<UserMembership> {
    const plan = await manager.findOne(MembershipPlan, { where: { id: planId } });
    if (!plan) throw new NotFoundException('El plan de membresía no existe');

    const current = await manager.findOne(UserMembership, {
      where: { userId, status: MembershipStatus.ACTIVE },
      order: { endDate: 'DESC' },
    });

    const window = resolveMembershipWindow(
      current ? { status: current.status, endDate: current.endDate, planId: current.planId } : null,
      plan.id,
      plan.durationDays,
    );

    const saved = await manager.save(
      manager.create(UserMembership, {
        userId,
        planId: plan.id,
        startDate: window.startDate,
        endDate: window.endDate,
        status: MembershipStatus.ACTIVE,
      }),
    );
    saved.plan = plan;
    return saved;
  }

  async cancel(userId: string, id: string): Promise<MembershipView> {
    const membership = await this.memberships.findOne({ where: { id, userId }, relations: { plan: true } });
    if (!membership) throw new NotFoundException('La membresía no existe');
    membership.status = MembershipStatus.CANCELLED;
    await this.memberships.save(membership);
    return toMembershipView(membership);
  }

  expireOverdue(userId?: string): Promise<UpdateResult> {
    return this.memberships.update(
      {
        status: MembershipStatus.ACTIVE,
        endDate: LessThanOrEqual(new Date()),
        ...(userId ? { userId } : {}),
      },
      { status: MembershipStatus.EXPIRED },
    );
  }

  countActive(): Promise<number> {
    return this.memberships.count({ where: { status: MembershipStatus.ACTIVE } });
  }

  findActiveBefore(date: Date): Promise<UserMembership[]> {
    return this.memberships.find({
      where: { status: MembershipStatus.ACTIVE, endDate: LessThanOrEqual(date) },
      relations: { plan: true },
    });
  }
}
