import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports API health', () => {
    const controller = new HealthController();
    expect(controller.getHealth()).toEqual({ status: 'ok', service: 'api' });
  });
});
