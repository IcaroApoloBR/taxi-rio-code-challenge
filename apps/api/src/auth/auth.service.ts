import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthUser } from './auth-user';
import { AccountDirectory, ActorProfile, DemoCatalog, normalizePhone } from './account-directory';
import { LoginDto, LoginResponseDto, ProfileDto, toProfileDto } from './auth.dto';
import { TokenIssuer } from './token-issuer';

@Injectable()
export class AuthService {
  constructor(
    private readonly accounts: AccountDirectory,
    private readonly issuer: TokenIssuer,
  ) {}

  async login(input: LoginDto): Promise<LoginResponseDto> {
    const profile = input.role === 'passenger' ? this.passenger(input) : this.accounts.loginDriver(input.ratr ?? '', input.password ?? '');
    const issued = await this.issuer.sign({ sub: profile.sub, role: profile.role });
    return {
      accessToken: issued.token,
      tokenType: 'Bearer',
      expiresIn: issued.expiresIn,
      profile: toProfileDto(profile),
    };
  }

  me(user: AuthUser): ProfileDto {
    return toProfileDto(this.accounts.findBySub(user.sub) ?? fallbackProfile(user));
  }

  demoCatalog(): DemoCatalog {
    return this.accounts.demoCatalog();
  }

  private passenger(input: LoginDto): ActorProfile {
    const digits = normalizePhone(input.phone ?? '');
    if (digits.length < 10 || digits.length > 11) {
      throw new BadRequestException('Informe um telefone com DDD.');
    }
    return this.accounts.loginPassenger(input.email ?? '', input.phone ?? '');
  }
}

function fallbackProfile(user: AuthUser): ActorProfile {
  return {
    sub: user.sub,
    role: user.role,
    displayName: user.sub,
    email: null,
    phone: null,
    ratr: null,
    vehicleModel: null,
    vehiclePlate: null,
    rating: null,
  };
}
