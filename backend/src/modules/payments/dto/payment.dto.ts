import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CardDto {
  // Se aceita con espacios o guiones; se normaliza y nunca se persiste completa.
  @Matches(/^\d[0-9 -]{11,23}$/, { message: 'El número de tarjeta debe tener entre 13 y 19 dígitos' })
  number: string;

  @IsString()
  @MinLength(3)
  @MaxLength(80)
  holderName: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  expiryMonth: number;

  @Type(() => Number)
  @IsInt()
  @Min(2024)
  @Max(2099)
  expiryYear: number;

  @Matches(/^\d{3,4}$/, { message: 'El cvv debe tener 3 o 4 dígitos' })
  cvv: string;
}

/** RF-08 Solicitud de pago de un pedido pendiente. */
export class CreatePaymentDto {
  @IsUUID()
  orderId: string;

  @ValidateNested()
  @Type(() => CardDto)
  card: CardDto;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
}
