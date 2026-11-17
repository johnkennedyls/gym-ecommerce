import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BookingStatus } from '../../../common/enums';
import { PaginationQueryDto } from '../../../common/dto/pagination';
import { ToBoolean } from '../../../common/dto/to-boolean.transform';

export class CreateScheduleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  capacity: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  room?: string;

  @IsOptional()
  @IsUUID()
  trainerId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  capacity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  room?: string;

  @IsOptional()
  @IsUUID()
  trainerId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}

export class ListSchedulesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  onlyAvailable?: boolean;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeInactive?: boolean;
}

export class BookDto {
  @IsUUID()
  scheduleId: string;
}

export class MarkAttendanceDto {
  @IsEnum(BookingStatus)
  status: BookingStatus;
}

export class ListBookingsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  scheduleId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}
