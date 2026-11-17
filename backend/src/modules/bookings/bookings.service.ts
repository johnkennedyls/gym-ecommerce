import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ClassSchedule } from './entities/class-schedule.entity';
import { Booking } from './entities/booking.entity';
import {
  BookDto,
  CreateScheduleDto,
  ListBookingsQueryDto,
  ListSchedulesQueryDto,
  UpdateScheduleDto,
} from './dto/bookings.dto';
import { BookingStatus, NotificationEvent, Role } from '../../common/enums';
import { PaginatedResult, paginate } from '../../common/dto/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../../common/services/audit.service';
import { UsersService } from '../users/users.service';
import { canCancel, evaluateBookingEligibility } from './booking-rules';

export type BookingSummary = {
  id: string;
  status: BookingStatus;
  title: string;
  startsAt: Date;
};

export type ScheduleView = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  room: string | null;
  trainer: string | null;
  service: string | null;
  isActive: boolean;
  taken: number;
  remaining: number;
  myBooking: { id: string; status: BookingStatus } | null;
};

export type Requester = { id: string };

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(ClassSchedule) private readonly schedules: Repository<ClassSchedule>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** RF-11 Consultar horarios disponibles con cupos ocupados. */
  async listSchedules(query: ListSchedulesQueryDto, userId?: string): Promise<PaginatedResult<ScheduleView>> {
    const from = query.from ? new Date(query.from) : new Date();
    const to = query.to
      ? new Date(query.to)
      : new Date(from.getTime() + 14 * 86_400_000);

    const builder = this.schedules
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.trainer', 'trainer')
      .leftJoinAndSelect('schedule.product', 'product')
      .where('schedule.startsAt BETWEEN :from AND :to', { from, to })
      .orderBy('schedule.startsAt', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (!query.includeInactive) builder.andWhere('schedule.isActive = true');

    const [rows, total] = await builder.getManyAndCount();
    const taken = await this.takenMap(rows.map((row) => row.id));
    const mine = userId ? await this.myBookingsMap(userId, rows.map((row) => row.id)) : new Map<string, Booking>();

    return paginate(
      rows.map((schedule) => {
        const occupied = taken.get(schedule.id) ?? 0;
        return {
          id: schedule.id,
          title: schedule.title,
          startsAt: schedule.startsAt,
          endsAt: schedule.endsAt,
          capacity: schedule.capacity,
          room: schedule.room ?? null,
          trainer: schedule.trainer ? `${schedule.trainer.firstName} ${schedule.trainer.lastName}` : null,
          service: schedule.product?.name ?? null,
          isActive: schedule.isActive,
          taken: occupied,
          remaining: Math.max(0, schedule.capacity - occupied),
          myBooking: mine.get(schedule.id)
            ? { id: mine.get(schedule.id)!.id, status: mine.get(schedule.id)!.status }
            : null,
        };
      }),
      total,
      query.page,
      query.limit,
    );
  }

  /** RF-11 Reservar una clase o servicio. */
  async book(userId: string, dto: BookDto): Promise<ScheduleView> {
    const result = await this.dataSource.transaction(async (manager) => {
      const schedule = await manager
        .createQueryBuilder(ClassSchedule, 'schedule')
        .setLock('pessimistic_write')
        .where('schedule.id = :id', { id: dto.scheduleId })
        .getOne();
      if (!schedule) throw new NotFoundException('La clase no existe');

      const taken = await manager.count(Booking, {
        where: { scheduleId: schedule.id, status: In([BookingStatus.CONFIRMED, BookingStatus.ATTENDED]) },
      });
      const already = await manager.findOne(Booking, { where: { scheduleId: schedule.id, userId } });

      const decision = evaluateBookingEligibility({
        isActive: schedule.isActive,
        startsAt: schedule.startsAt,
        now: new Date(),
        taken,
        capacity: schedule.capacity,
        alreadyBooked: Boolean(already && already.status !== BookingStatus.CANCELLED),
      });

      if (!decision.allowed) {
        throw new BadRequestException(decision.reason ?? 'No es posible reservar la clase');
      }

      let bookingId: string;
      if (already) {
        already.status = BookingStatus.CONFIRMED;
        already.cancelledAt = null;
        bookingId = (await manager.save(already)).id;
      } else {
        const created = await manager.save(
          manager.create(Booking, { userId, scheduleId: schedule.id, status: BookingStatus.CONFIRMED }),
        );
        bookingId = created.id;
      }
      const booking = await manager.findOneOrFail(Booking, { where: { id: bookingId } });

      return { scheduleId: schedule.id, bookingId: booking.id };
    });

    const schedule = await this.schedules.findOne({
      where: { id: result.scheduleId },
      relations: { trainer: true, product: true },
    });
    if (!schedule) throw new NotFoundException('La clase no existe');

    await this.notifications.notify(
      userId,
      NotificationEvent.BOOKING_CONFIRMED,
      'Reserva confirmada',
      `Tu cupo en ${schedule.title} quedó reservado para el ${schedule.startsAt.toISOString()}.`,
    );
    await this.audit.record({
      userId,
      action: 'BOOKING_CREATED',
      entityName: 'bookings',
      entityId: result.bookingId,
      details: { scheduleId: schedule.id, title: schedule.title },
    });

    const taken = await this.countTaken(schedule.id);
    const booking = await this.bookings.findOne({ where: { id: result.bookingId } });
    return {
      ...this.toView(schedule, taken),
      myBooking: booking ? { id: booking.id, status: booking.status } : null,
    };
  }

  async myBookings(userId: string, upcomingOnly = true): Promise<BookingSummary[]> {
    const where = upcomingOnly
      ? { userId, status: In([BookingStatus.CONFIRMED, BookingStatus.ATTENDED]) }
      : { userId };

    const bookings = await this.bookings.find({
      where,
      relations: { schedule: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    return bookings
      .filter((booking) => !upcomingOnly || booking.schedule.startsAt >= new Date())
      .map((booking) => ({
        id: booking.id,
        status: booking.status,
        title: booking.schedule.title,
        startsAt: booking.schedule.startsAt,
      }));
  }

  /** RF-11 Cancelación dentro de la ventana permitida. */
  async cancel(userId: string, bookingId: string): Promise<{ message: string }> {
    const booking = await this.bookings.findOne({ where: { id: bookingId, userId }, relations: { schedule: true } });
    if (!booking) throw new NotFoundException('La reserva no existe');
    if (booking.status === BookingStatus.CANCELLED) return { message: 'La reserva ya estaba cancelada' };
    if (!canCancel(booking.schedule.startsAt)) {
      throw new ConflictException('Las reservas se pueden cancelar con al menos 2 horas de anticipación');
    }

    booking.status = BookingStatus.CANCELLED;
    booking.cancelledAt = new Date();
    await this.bookings.save(booking);

    await this.notifications.notify(
      userId,
      NotificationEvent.BOOKING_CANCELLED,
      'Reserva cancelada',
      `Cancelaste tu cupo en ${booking.schedule.title}.`,
    );
    await this.audit.record({
      userId,
      action: 'BOOKING_CANCELLED',
      entityName: 'bookings',
      entityId: booking.id,
    });
    return { message: 'Reserva cancelada' };
  }

  // ------------------------------------------------------------------ RF-11 administración / personal

  async createSchedule(dto: CreateScheduleDto, actor: Requester): Promise<ScheduleView> {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException('La clase debe terminar después de iniciar');
    if (dto.trainerId) await this.assertTrainer(dto.trainerId);

    const schedule = await this.schedules.save(
      this.schedules.create({
        title: dto.title,
        startsAt,
        endsAt,
        capacity: dto.capacity,
        room: dto.room ?? null,
        trainerId: dto.trainerId ?? null,
        productId: dto.productId ?? null,
        isActive: dto.isActive ?? true,
      }),
    );

    await this.audit.record({
      userId: actor.id,
      action: 'SCHEDULE_CREATED',
      entityName: 'class_schedules',
      entityId: schedule.id,
      details: { title: schedule.title },
    });
    return this.toView(schedule, 0);
  }

  async updateSchedule(id: string, dto: UpdateScheduleDto, actor: Requester): Promise<ScheduleView> {
    const schedule = await this.schedules.findOne({ where: { id }, relations: { trainer: true, product: true } });
    if (!schedule) throw new NotFoundException('La clase no existe');

    if (dto.startsAt) schedule.startsAt = new Date(dto.startsAt);
    if (dto.endsAt) schedule.endsAt = new Date(dto.endsAt);
    if (schedule.endsAt <= schedule.startsAt) {
      throw new BadRequestException('La clase debe terminar después de iniciar');
    }
    if (dto.title !== undefined) schedule.title = dto.title;
    if (dto.capacity !== undefined) {
      const taken = await this.countTaken(id);
      if (dto.capacity < taken) {
        throw new ConflictException(`Hay ${taken} reservas activas; la capacidad no puede ser menor`);
      }
      schedule.capacity = dto.capacity;
    }
    if (dto.room !== undefined) schedule.room = dto.room;
    if (dto.productId !== undefined) schedule.productId = dto.productId ?? null;
    if (dto.isActive !== undefined) schedule.isActive = dto.isActive;
    if (dto.trainerId !== undefined) {
      if (dto.trainerId) await this.assertTrainer(dto.trainerId);
      schedule.trainerId = dto.trainerId ?? null;
    }

    await this.schedules.save(schedule);
    await this.audit.record({
      userId: actor.id,
      action: 'SCHEDULE_UPDATED',
      entityName: 'class_schedules',
      entityId: id,
    });
    return this.toView(schedule, await this.countTaken(id));
  }

  async listBookings(query: ListBookingsQueryDto): Promise<PaginatedResult<{
    id: string;
    status: BookingStatus;
    student: string;
    title: string;
    startsAt: Date;
  }>> {
    const builder = this.bookings
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.user', 'user')
      .leftJoinAndSelect('booking.schedule', 'schedule')
      .orderBy('schedule.startsAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.scheduleId) builder.andWhere('booking.scheduleId = :scheduleId', { scheduleId: query.scheduleId });
    if (query.userId) builder.andWhere('booking.userId = :userId', { userId: query.userId });
    if (query.status) builder.andWhere('booking.status = :status', { status: query.status });

    const [rows, total] = await builder.getManyAndCount();
    return paginate(
      rows.map((booking) => ({
        id: booking.id,
        status: booking.status,
        student: `${booking.user.firstName} ${booking.user.lastName}`,
        title: booking.schedule.title,
        startsAt: booking.schedule.startsAt,
      })),
      total,
      query.page,
      query.limit,
    );
  }

  /** El personal registra la asistencia o la inasistencia del cliente. */
  async markAttendance(bookingId: string, status: BookingStatus, actor: Requester): Promise<{ id: string; status: BookingStatus }> {
    if (status === BookingStatus.CANCELLED) throw new BadRequestException('Usa la cancelación para liberar el cupo');
    const booking = await this.bookings.findOne({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('La reserva no existe');

    booking.status = status;
    await this.bookings.save(booking);
    await this.audit.record({
      userId: actor.id,
      action: 'BOOKING_ATTENDANCE_MARKED',
      entityName: 'bookings',
      entityId: bookingId,
      details: { status },
    });
    return { id: booking.id, status: booking.status };
  }

  /** Apoya los reportes de la administración: cupos reservados en clases futuras. */
  countUpcomingConfirmed(): Promise<number> {
    return this.bookings
      .createQueryBuilder('booking')
      .leftJoin('booking.schedule', 'schedule')
      .where('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .andWhere('schedule.startsAt > :now', { now: new Date() })
      .getCount();
  }

  private async takenMap(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.bookings
      .createQueryBuilder('booking')
      .select('booking.scheduleId', 'scheduleId')
      .addSelect('COUNT(*)', 'taken')
      .where('booking.scheduleId IN (:...ids)', { ids })
      .andWhere('booking.status IN (:...active)', {
        active: [BookingStatus.CONFIRMED, BookingStatus.ATTENDED],
      })
      .groupBy('booking.scheduleId')
      .getRawMany<{ scheduleId: string; taken: string }>();
    return new Map(rows.map((row) => [row.scheduleId, Number(row.taken)]));
  }

  private async myBookingsMap(userId: string, ids: string[]): Promise<Map<string, Booking>> {
    if (ids.length === 0) return new Map();
    const rows = await this.bookings.find({ where: { userId, scheduleId: In(ids) } });
    return new Map(rows.filter((row) => row.status !== BookingStatus.CANCELLED).map((row) => [row.scheduleId, row]));
  }

  private countTaken(scheduleId: string): Promise<number> {
    return this.bookings.count({
      where: { scheduleId, status: In([BookingStatus.CONFIRMED, BookingStatus.ATTENDED]) },
    });
  }

  private async assertTrainer(trainerId: string): Promise<void> {
    const trainer = await this.users.findById(trainerId);
    if (trainer.role === Role.CLIENT) throw new BadRequestException('El instructor debe tener rol STAFF o ADMIN');
  }

  private toView(schedule: ClassSchedule, taken: number): ScheduleView {
    return {
      id: schedule.id,
      title: schedule.title,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
      capacity: schedule.capacity,
      room: schedule.room ?? null,
      trainer: schedule.trainer ? `${schedule.trainer.firstName} ${schedule.trainer.lastName}` : null,
      service: schedule.product?.name ?? null,
      isActive: schedule.isActive,
      taken,
      remaining: Math.max(0, schedule.capacity - taken),
      myBooking: null,
    };
  }
}


