import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CorrelationId } from '../http/correlation.decorator';
import { ApiErrorDto, CreateRideDto, QuoteRideDto, RateRideDto, RideDto, RideQuoteDto, toQuoteDto, toRideDto, UpdateRideStatusDto } from './ride.dto';
import { RidesService } from './rides.service';

@ApiTags('corridas')
@ApiBearerAuth('bearer')
@Controller('corridas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RidesController {
  constructor(private readonly rides: RidesService) {}

  @Post()
  @Roles('passenger')
  @HttpCode(201)
  @ApiOperation({ summary: 'Passageiro cria uma corrida' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Chave única do passageiro para esta operação.' })
  @ApiResponse({ status: 201, type: RideDto })
  @ApiResponse({ status: 400, type: ApiErrorDto, description: 'Payload inválido ou chave ausente.' })
  @ApiResponse({ status: 401, type: ApiErrorDto, description: 'Token ausente ou inválido.' })
  @ApiResponse({ status: 403, type: ApiErrorDto, description: 'Perfil sem permissão.' })
  @ApiResponse({ status: 409, type: ApiErrorDto, description: 'A mesma chave foi reutilizada com outro payload.' })
  async create(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CorrelationId() correlationId: string | null,
    @Body() body: CreateRideDto,
  ): Promise<RideDto> {
    const key = idempotencyKey?.trim();
    if (!key || key.length > 200) {
      throw new BadRequestException('Idempotency-Key é obrigatória.');
    }
    return toRideDto(await this.rides.create(user.sub, key, body, correlationId));
  }

  @Post('cotacao')
  @Roles('passenger')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Estima distância, tempo e valores de demonstração',
    description: 'Não grava corrida e não usa tarifa oficial. A tabela de desconto serve para a tela de escolha.',
  })
  @ApiOkResponse({ type: RideQuoteDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 401, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  quote(@Body() body: QuoteRideDto): RideQuoteDto {
    return toQuoteDto(this.rides.quote(body));
  }

  @Get()
  @Roles('passenger')
  @ApiOperation({ summary: 'Passageiro lista as próprias corridas' })
  @ApiOkResponse({ type: RideDto, isArray: true })
  @ApiResponse({ status: 401, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  async list(@CurrentUser() user: AuthUser): Promise<RideDto[]> {
    const rides = await this.rides.list(user.sub);
    return rides.map(toRideDto);
  }

  @Get('disponiveis')
  @Roles('driver')
  @ApiOperation({ summary: 'Motorista lista corridas ainda sem aceite' })
  @ApiOkResponse({ type: RideDto, isArray: true })
  @ApiResponse({ status: 401, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  async available(): Promise<RideDto[]> {
    const rides = await this.rides.listAvailable();
    return rides.map(toRideDto);
  }

  @Get('atribuida')
  @Roles('driver')
  @ApiOperation({ summary: 'Motorista consulta a corrida aceita ou em andamento' })
  @ApiOkResponse({ type: RideDto })
  @ApiResponse({ status: 401, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'Este motorista não tem corrida ativa.' })
  async assigned(@CurrentUser() user: AuthUser): Promise<RideDto> {
    return toRideDto(await this.rides.findAssigned(user.sub));
  }

  @Get(':id')
  @Roles('passenger')
  @ApiOperation({ summary: 'Passageiro consulta uma corrida própria' })
  @ApiOkResponse({ type: RideDto })
  @ApiResponse({ status: 401, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto, description: 'Corrida inexistente ou de outro passageiro.' })
  async find(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<RideDto> {
    return toRideDto(await this.rides.findForPassenger(user.sub, id));
  }

  @Patch(':id/status')
  @Roles('driver')
  @ApiOperation({ summary: 'Motorista avança o status da corrida' })
  @ApiOkResponse({ type: RideDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 401, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({ status: 409, type: ApiErrorDto, description: 'Transição inválida, motorista ocupado ou corrida de outro motorista.' })
  async updateStatus(
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId: string | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRideStatusDto,
  ): Promise<RideDto> {
    return toRideDto(await this.rides.changeStatus(user.sub, id, body.status, correlationId));
  }

  @Post(':id/cancel')
  @Roles('passenger', 'driver')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancela a corrida antes dela começar',
    description: 'O passageiro cancela em REQUESTED ou ACCEPTED. O motorista atribuído cancela em ACCEPTED.',
  })
  @ApiOkResponse({ type: RideDto })
  @ApiResponse({ status: 401, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({ status: 409, type: ApiErrorDto, description: 'A corrida já está em andamento, concluída ou cancelada.' })
  async cancel(
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId: string | null,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RideDto> {
    return toRideDto(await this.rides.cancel(user, id, correlationId));
  }

  @Post(':id/avaliacao')
  @Roles('passenger')
  @HttpCode(200)
  @ApiOperation({ summary: 'Passageiro avalia uma corrida concluída' })
  @ApiOkResponse({ type: RideDto })
  @ApiResponse({ status: 400, type: ApiErrorDto })
  @ApiResponse({ status: 401, type: ApiErrorDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  @ApiResponse({ status: 409, type: ApiErrorDto, description: 'Corrida ainda não concluída ou já avaliada.' })
  async rate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RateRideDto,
  ): Promise<RideDto> {
    return toRideDto(await this.rides.rate(user.sub, id, body));
  }
}
