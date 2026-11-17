import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import {
  BookDto,
  CreateScheduleDto,
  ListBookingsQueryDto,
  ListSchedulesQueryDto,
  MarkAttendanceDto,
  UpdateScheduleDto,
} from './dto/bookings.dto';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guard';
import { Role } from '../../common/enums';
import { User } from '../users/entities/user.entity';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('schedules')
  @ApiOperation({ summary: 'RF-11 Horarios de clases y servicios' })
  schedules(@CurrentUser() user: User, @Query() query: ListSchedulesQueryDto) {
    return this.bookings.listSchedules(query, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'RF-11 Reservar una clase' })
  book(@CurrentUser() user: User, @Body() dto: BookDto) {
    return this.bookings.book(user.id, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'RF-11 Mis reservas' })
  mine(@CurrentUser() user: User, @Query('history') history?: string) {
    return this.bookings.myBookings(user.id, history !== 'true');
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'RF-11 Cancelar reserva' })
  cancel(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.cancel(user.id, id);
  }

  @Post('schedules')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'RF-11 Crear horario de clase (administración)' })
  createSchedule(@Body() dto: CreateScheduleDto, @CurrentUser() actor: User) {
    return this.bookings.createSchedule(dto, actor);
  }

  @Patch('schedules/:id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'RF-11 Modificar disponibilidad de la clase (administración)' })
  updateSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() actor: User,
  ) {
    return this.bookings.updateSchedule(id, dto, actor);
  }

  @Get('all')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'RF-11 Consultar reservas del gimnasio' })
  all(@Query() query: ListBookingsQueryDto) {
    return this.bookings.listBookings(query);
  }

  @Patch(':id/attendance')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'RF-11 Registrar asistencia o inasistencia' })
  attendance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkAttendanceDto,
    @CurrentUser() actor: User,
  ) {
    return this.bookings.markAttendance(id, dto.status, actor);
  }
}
