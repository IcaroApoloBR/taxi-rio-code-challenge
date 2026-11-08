import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';

class HealthDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'api' })
  service!: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Verifica se o processo da API está no ar' })
  @ApiOkResponse({ type: HealthDto })
  getHealth(): { status: string; service: string } {
    return { status: 'ok', service: 'api' };
  }
}
