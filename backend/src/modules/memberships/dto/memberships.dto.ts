import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MembershipLevel } from '../../../common/enums';
import { ToBoolean } from '../../../common/dto/to-boolean.transform';

export class UpsertPlanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  price: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(730)
  durationDays: number;

  @IsEnum(MembershipLevel)
  accessLevel: MembershipLevel;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includesClasses?: boolean;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(730)
  durationDays?: number;

  @IsOptional()
  @IsEnum(MembershipLevel)
  accessLevel?: MembershipLevel;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includesClasses?: boolean;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}
