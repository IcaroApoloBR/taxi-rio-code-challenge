import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorDto } from '../rides/ride.dto';
import { AuthUser } from './auth-user';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { DemoCatalogDto, LoginDto, LoginResponseDto, ProfileDto } from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('autenticacao')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Emite um JWT RS256 de demonstração',
    description:
      'Passageiro entra com e-mail e telefone. Se o e-mail ainda não existir, a conta é criada na memória do processo. Motorista entra com RATR e senha de uma conta já cadastrada. O token vale 8 horas.',
  })
  @ApiBody({
    type: LoginDto,
    examples: {
      passageiro: {
        summary: 'Passageiro Ana',
        value: { role: 'passenger', email: 'ana@demo.taxi.rio', phone: '(21) 98888-1001' },
      },
      motorista: {
        summary: 'Motorista Manuel',
        value: { role: 'driver', ratr: '100001', password: 'demo-livre' },
      },
    },
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiResponse({ status: 400, type: ApiErrorDto, description: 'Campos ausentes ou telefone sem DDD.' })
  @ApiResponse({ status: 401, type: ApiErrorDto, description: 'Telefone não confere ou RATR/senha inválidos.' })
  @ApiResponse({ status: 503, type: ApiErrorDto, description: 'Chave privada local ausente.' })
  login(@Body() body: LoginDto): Promise<LoginResponseDto> {
    return this.auth.login(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Confirma o ator do token' })
  @ApiOkResponse({ type: ProfileDto })
  @ApiResponse({ status: 401, type: ApiErrorDto })
  me(@CurrentUser() user: AuthUser): ProfileDto {
    return this.auth.me(user);
  }

  @Get('demonstracao')
  @ApiOperation({
    summary: 'Lista as contas fictícias locais',
    description: 'Não exige token. As senhas são de demonstração e só existem neste processo.',
  })
  @ApiOkResponse({ type: DemoCatalogDto })
  demo(): DemoCatalogDto {
    return this.auth.demoCatalog();
  }
}
