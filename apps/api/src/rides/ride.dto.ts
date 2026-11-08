import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Ride, rideStatuses, RideStatus } from './ride';
import { discountPercents, DiscountPercent, paymentMethods, PaymentMethod, RideQuote } from './quote';

const driverStatuses = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] as const;

export class CreateRideDto {
  @ApiProperty({ example: 'Maracanã' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  pickup!: string;

  @ApiProperty({ example: 'Sambódromo Marquês de Sapucaí' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  destination!: string;

  @ApiPropertyOptional({ enum: discountPercents, example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsIn(discountPercents)
  discountPercent?: DiscountPercent;

  @ApiPropertyOptional({ enum: paymentMethods, example: 'credit_card', default: 'credit_card' })
  @IsOptional()
  @IsIn(paymentMethods)
  paymentMethod?: PaymentMethod;
}

export class QuoteRideDto {
  @ApiProperty({ example: 'Maracanã' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  pickup!: string;

  @ApiProperty({ example: 'Sambódromo Marquês de Sapucaí' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  destination!: string;
}

export class UpdateRideStatusDto {
  @ApiProperty({ enum: driverStatuses, example: 'ACCEPTED' })
  @IsIn(driverStatuses)
  status!: RideStatus;
}

export class RateRideDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @ApiPropertyOptional({ example: 'Corrida tranquila.' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  comment?: string;
}

export class QuoteOptionDto {
  @ApiProperty({ example: 10 })
  discountPercent!: DiscountPercent;

  @ApiProperty({ example: 2000, description: 'Valor estimado em centavos. Não é tarifa oficial.' })
  amountCents!: number;

  @ApiProperty({ example: 1, description: 'Quantidade ilustrativa. Não há despacho real.' })
  driversAvailable!: number;
}

export class RideQuoteDto {
  @ApiProperty({ example: 3.7 })
  distanceKm!: number;

  @ApiProperty({ example: 6 })
  durationMin!: number;

  @ApiProperty({ example: 2 })
  fareFlag!: 1 | 2;

  @ApiProperty({ example: 2200, description: 'Valor cheio em centavos, antes do desconto.' })
  baseCents!: number;

  @ApiProperty({ type: [QuoteOptionDto] })
  options!: QuoteOptionDto[];
}

export class RideDto {
  @ApiProperty({ example: '6d0f0a4e-1e3a-4f0a-9c1b-0d5a2a6e9c11' })
  id!: string;

  @ApiProperty({ example: 'passenger-a' })
  passengerId!: string;

  @ApiProperty({ example: 'Ana P.' })
  passengerName!: string;

  @ApiProperty({ example: 'driver-a', nullable: true })
  driverId!: string | null;

  @ApiProperty({ example: 'Manuel B. Filho', nullable: true })
  driverName!: string | null;

  @ApiProperty({ example: 'Chevrolet ONIX', nullable: true })
  vehicleModel!: string | null;

  @ApiProperty({ example: 'KYZ-2356', nullable: true })
  vehiclePlate!: string | null;

  @ApiProperty({ example: 4.5, nullable: true })
  driverRating!: number | null;

  @ApiProperty({ enum: rideStatuses, example: 'REQUESTED' })
  status!: RideStatus;

  @ApiProperty({ example: 'Maracanã' })
  pickup!: string;

  @ApiProperty({ example: 'Sambódromo Marquês de Sapucaí' })
  destination!: string;

  @ApiProperty({ example: 3.7 })
  distanceKm!: number;

  @ApiProperty({ example: 6 })
  durationMin!: number;

  @ApiProperty({ example: 2 })
  fareFlag!: 1 | 2;

  @ApiProperty({ example: 10 })
  discountPercent!: number;

  @ApiProperty({ enum: paymentMethods, example: 'credit_card' })
  paymentMethod!: PaymentMethod;

  @ApiProperty({ example: 2200 })
  baseCents!: number;

  @ApiProperty({ example: 2000 })
  amountCents!: number;

  @ApiProperty({ example: 5, nullable: true })
  ratingScore!: number | null;

  @ApiProperty({ example: 'Corrida tranquila.', nullable: true })
  ratingComment!: string | null;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ example: '2026-11-08T19:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-11-08T19:00:00.000Z' })
  updatedAt!: string;
}

export class ApiErrorDto {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({ example: 'RIDE_STATUS_CONFLICT' })
  code!: string;

  @ApiProperty({ example: 'A corrida não pode avançar a partir do status atual.' })
  message!: string;

  @ApiProperty({ example: '3f1c0b4a-6d2e-4a7b-9c10-8e2f5a1b7d33' })
  correlationId!: string;
}

export function toRideDto(ride: Ride): RideDto {
  return { ...ride };
}

export function toQuoteDto(quote: RideQuote): RideQuoteDto {
  return quote;
}
