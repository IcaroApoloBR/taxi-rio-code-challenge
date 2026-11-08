import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { ActorRole } from './auth-user';
import { ActorProfile } from './account-directory';

export class LoginDto {
  @ApiProperty({ enum: ['passenger', 'driver'], example: 'passenger' })
  @IsIn(['passenger', 'driver'])
  role!: ActorRole;

  @ApiPropertyOptional({ example: 'ana@demo.taxi.rio' })
  @ValidateIf((dto: LoginDto) => dto.role === 'passenger')
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({ example: '(21) 98888-1001' })
  @ValidateIf((dto: LoginDto) => dto.role === 'passenger')
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: '100001' })
  @ValidateIf((dto: LoginDto) => dto.role === 'driver')
  @IsString()
  @MinLength(4)
  @MaxLength(10)
  ratr?: string;

  @ApiPropertyOptional({ example: 'demo-livre' })
  @ValidateIf((dto: LoginDto) => dto.role === 'driver')
  @IsString()
  @MinLength(4)
  @MaxLength(72)
  password?: string;
}

export class ProfileDto {
  @ApiProperty({ example: 'passenger-a' })
  sub!: string;

  @ApiProperty({ enum: ['passenger', 'driver'], example: 'passenger' })
  role!: ActorRole;

  @ApiProperty({ example: 'Ana P.' })
  displayName!: string;

  @ApiProperty({ example: 'ana@demo.taxi.rio', nullable: true })
  email!: string | null;

  @ApiProperty({ example: '(21) 98888-1001', nullable: true })
  phone!: string | null;

  @ApiProperty({ example: '100001', nullable: true })
  ratr!: string | null;

  @ApiProperty({ example: 'Chevrolet ONIX', nullable: true })
  vehicleModel!: string | null;

  @ApiProperty({ example: 'KYZ-2356', nullable: true })
  vehiclePlate!: string | null;

  @ApiProperty({ example: 4.5, nullable: true })
  rating!: number | null;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT RS256. Envie em Authorization: Bearer.' })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ example: 28800, description: 'Validade em segundos.' })
  expiresIn!: number;

  @ApiProperty({ type: ProfileDto })
  profile!: ProfileDto;
}

export class DemoPassengerDto {
  @ApiProperty({ example: 'Ana P.' })
  name!: string;

  @ApiProperty({ example: 'ana@demo.taxi.rio' })
  email!: string;

  @ApiProperty({ example: '(21) 98888-1001' })
  phone!: string;
}

export class DemoDriverDto {
  @ApiProperty({ example: 'Manuel B. Filho' })
  name!: string;

  @ApiProperty({ example: '100001' })
  ratr!: string;

  @ApiProperty({ example: 'demo-livre' })
  password!: string;

  @ApiProperty({ example: 'Chevrolet ONIX' })
  vehicle!: string;

  @ApiProperty({ example: 'KYZ-2356' })
  plate!: string;
}

export class DemoCatalogDto {
  @ApiProperty({ type: [DemoPassengerDto] })
  passengers!: DemoPassengerDto[];

  @ApiProperty({ type: [DemoDriverDto] })
  drivers!: DemoDriverDto[];
}

export function toProfileDto(profile: ActorProfile): ProfileDto {
  return { ...profile };
}
