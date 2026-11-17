import { Type } from 'class-transformer';
import {
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
import { OrderStatus } from '../../../common/enums';
import { PaginationQueryDto } from '../../../common/dto/pagination';

/** RF-07 Datos necesarios para completar el pedido. */
export class CheckoutDto {
  @IsString()
  @MinLength(6)
  @MaxLength(240)
  shippingAddress: string;

  @IsString()
  @MinLength(3)
  @MaxLength(140)
  receiverName: string;
}

export class CreateMembershipOrderDto {
  @IsUUID()
  planId: string;
}

export class ChangeOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

export class ListOrdersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  /** Solo para administración: consultar los pedidos de un cliente concreto. */
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class OrderRevenueRangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days = 30;
}
