import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProductKind } from '../../../common/enums';
import { ToBoolean } from '../../../common/dto/to-boolean.transform';
import { PaginationQueryDto } from '../../../common/dto/pagination';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug debe usar minúsculas, números y guiones' })
  @MaxLength(90)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;
}

export class UpdateCategoryDto extends CreateCategoryDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  name: string;

  @Matches(/^[A-Z0-9-]{4,40}$/, { message: 'sku debe tener entre 4 y 40 caracteres en mayúsculas' })
  sku: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  price: number;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/, { message: 'currency debe ser un código ISO de 3 letras' })
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  imageUrl?: string;

  @IsEnum(ProductKind)
  kind: ProductKind;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(600)
  durationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'categoryId es obligatorio',
  })
  categoryId: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  imageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(600)
  durationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class CatalogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ProductKind)
  kind?: ProductKind;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  /** RF-05: solo artículos con disponibilidad. */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  availableOnly?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^(price_asc|price_desc|newest|name)$/, { message: 'sortBy no válido' })
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'name';

  /** RF-12: el administrador puede ver también los elementos desactivados. */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeInactive?: boolean;
}

export class AdjustStockDto {
  @Type(() => Number)
  @IsInt()
  @Min(-100_000)
  @Max(100_000)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}
