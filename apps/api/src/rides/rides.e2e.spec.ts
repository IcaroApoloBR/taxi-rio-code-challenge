import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';

interface DemoTokens {
  passengerA: string;
  passengerB: string;
  driverA: string;
  expiredPassenger: string;
}

const tokens = JSON.parse(readFileSync(join(__dirname, '../../../../keys/demo-tokens.json'), 'utf8')) as DemoTokens;

describe('corridas API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents the implemented routes with bearer auth and the idempotency header', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer').build(),
    );
    expect(operation(document, '/api/health', 'get')).toBeDefined();
    const create = operation(document, '/api/corridas', 'post');
    expect(create?.parameters?.some((parameter) => 'name' in parameter && parameter.name === 'Idempotency-Key')).toBe(true);
    expect(operation(document, '/api/corridas/{id}', 'get')).toBeDefined();
    expect(operation(document, '/api/corridas/{id}/status', 'patch')).toBeDefined();
    expect(operation(document, '/api/auth/login', 'post')).toBeDefined();
    expect(operation(document, '/api/auth/demonstracao', 'get')).toBeDefined();
    expect(operation(document, '/api/corridas/cotacao', 'post')).toBeDefined();
    expect(operation(document, '/api/corridas/disponiveis', 'get')).toBeDefined();
    expect(operation(document, '/api/corridas/atribuida', 'get')).toBeDefined();
    expect(operation(document, '/api/corridas/{id}/cancel', 'post')).toBeDefined();
    expect(operation(document, '/api/corridas/{id}/avaliacao', 'post')).toBeDefined();
    expect(document.components?.securitySchemes?.bearer).toMatchObject({ scheme: 'bearer' });
  });

  it('rejects missing, invalid and expired tokens', async () => {
    await request(app.getHttpServer()).post('/api/corridas').send({ pickup: 'A', destination: 'B' }).expect(401);
    await request(app.getHttpServer())
      .post('/api/corridas')
      .set('Authorization', 'Bearer not-a-token')
      .set('Idempotency-Key', 'missing')
      .send({ pickup: 'A', destination: 'B' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/corridas')
      .set('Authorization', `Bearer ${tokens.expiredPassenger}`)
      .set('Idempotency-Key', 'expired')
      .send({ pickup: 'A', destination: 'B' })
      .expect(401);
  });

  it('forbids a driver from creating and a passenger from changing status', async () => {
    await request(app.getHttpServer())
      .post('/api/corridas')
      .set('Authorization', `Bearer ${tokens.driverA}`)
      .set('Idempotency-Key', 'driver-create')
      .send({ pickup: 'A', destination: 'B' })
      .expect(403);

    const created = await createRide(tokens.passengerA, 'passenger-create', 'Copacabana', 'Centro');
    await request(app.getHttpServer())
      .patch(`/api/corridas/${created.id}/status`)
      .set('Authorization', `Bearer ${tokens.passengerA}`)
      .send({ status: 'ACCEPTED' })
      .expect(403);
  });

  it('creates, isolates, advances and rejects invalid transitions', async () => {
    const created = await createRide(tokens.passengerA, 'happy-path', 'Copacabana', 'Centro');
    expect(created.status).toBe('REQUESTED');

    const ownList = await request(app.getHttpServer())
      .get('/api/corridas')
      .set('Authorization', `Bearer ${tokens.passengerA}`)
      .expect(200);
    expect(ownList.body.some((ride: { id: string }) => ride.id === created.id)).toBe(true);

    const otherList = await request(app.getHttpServer())
      .get('/api/corridas')
      .set('Authorization', `Bearer ${tokens.passengerB}`)
      .expect(200);
    expect(otherList.body.some((ride: { id: string }) => ride.id === created.id)).toBe(false);

    await request(app.getHttpServer())
      .get(`/api/corridas/${created.id}`)
      .set('Authorization', `Bearer ${tokens.passengerB}`)
      .expect(404);

    const accepted = await request(app.getHttpServer())
      .patch(`/api/corridas/${created.id}/status`)
      .set('Authorization', `Bearer ${tokens.driverA}`)
      .send({ status: 'ACCEPTED' })
      .expect(200);
    expect(accepted.body.driverId).toBe('driver-a');

    await request(app.getHttpServer())
      .patch(`/api/corridas/${created.id}/status`)
      .set('Authorization', `Bearer ${tokens.driverA}`)
      .send({ status: 'COMPLETED' })
      .expect(409);
  });

  it('replays the same idempotency key and conflicts when the payload changes', async () => {
    const first = await createRide(tokens.passengerB, 'same-key', 'Botafogo', 'Lapa');
    const second = await createRide(tokens.passengerB, 'same-key', 'Botafogo', 'Lapa');
    expect(second.id).toBe(first.id);

    const [parallelA, parallelB] = await Promise.all([
      createRide(tokens.passengerB, 'parallel-key', 'Ipanema', 'Leblon'),
      createRide(tokens.passengerB, 'parallel-key', 'Ipanema', 'Leblon'),
    ]);
    expect(parallelA.id).toBe(parallelB.id);

    await request(app.getHttpServer())
      .post('/api/corridas')
      .set('Authorization', `Bearer ${tokens.passengerB}`)
      .set('Idempotency-Key', 'same-key')
      .send({ pickup: 'Outra origem', destination: 'Lapa' })
      .expect(409);
  });

  it('issues a usable JWT from the local login and rejects bad credentials', async () => {
    const catalog = await request(app.getHttpServer()).get('/api/auth/demonstracao').expect(200);
    expect(catalog.body.passengers.some((account: { email: string }) => account.email === 'ana@demo.taxi.rio')).toBe(true);

    const ana = await login({ role: 'passenger', email: 'ana@demo.taxi.rio', phone: '(21) 98888-1001' });
    expect(ana.profile).toMatchObject({ sub: 'passenger-a', role: 'passenger', displayName: 'Ana P.' });
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${ana.accessToken}`).expect(200);
    expect(me.body.sub).toBe('passenger-a');

    const created = await createRide(ana.accessToken, 'login-token', 'Copacabana', 'Ipanema');
    expect(created.passengerName).toBe('Ana P.');

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ role: 'passenger', email: 'ana@demo.taxi.rio', phone: '(21) 90000-0000' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ role: 'driver', ratr: '100001', password: 'senha-errada' })
      .expect(401);
    await request(app.getHttpServer()).post('/api/auth/login').send({ role: 'passenger', phone: '123' }).expect(400);
  });

  it('registers a new passenger in memory and keeps the ride private', async () => {
    const created = await login({ role: 'passenger', email: 'carla.demo@demo.taxi.rio', phone: '21988881003' });
    expect(created.profile.displayName).toBe('Carla D.');
    const again = await login({ role: 'passenger', email: 'carla.demo@demo.taxi.rio', phone: '(21) 98888-1003' });
    expect(again.profile.sub).toBe(created.profile.sub);

    const ride = await createRide(created.accessToken, 'carla-ride', 'Botafogo', 'Lapa');
    const list = await request(app.getHttpServer()).get('/api/corridas').set('Authorization', `Bearer ${tokens.passengerA}`).expect(200);
    expect(list.body.some((item: { id: string }) => item.id === ride.id)).toBe(false);
  });

  it('quotes, creates with a discount and lets the driver finish the ride', async () => {
    const ana = await login({ role: 'passenger', email: 'ana@demo.taxi.rio', phone: '21988881001' });
    const manuel = await login({ role: 'driver', ratr: '100001', password: 'demo-livre' });
    const taxista = await login({ role: 'driver', ratr: '100002', password: 'demo-livre' });
    await releaseDriver(manuel.accessToken);
    await releaseDriver(taxista.accessToken);

    const quote = await request(app.getHttpServer())
      .post('/api/corridas/cotacao')
      .set('Authorization', `Bearer ${ana.accessToken}`)
      .send({ pickup: 'Maracanã', destination: 'Sambódromo Marquês de Sapucaí' })
      .expect(200);
    expect(quote.body.options.find((option: { discountPercent: number }) => option.discountPercent === 10).amountCents).toBe(2000);

    await request(app.getHttpServer())
      .post('/api/corridas/cotacao')
      .set('Authorization', `Bearer ${manuel.accessToken}`)
      .send({ pickup: 'Maracanã', destination: 'Sambódromo' })
      .expect(403);

    const first = await createRide(ana.accessToken, 'quote-ride', 'Maracanã', 'Sambódromo Marquês de Sapucaí', 10);
    const second = await createRide(ana.accessToken, 'quote-ride-2', 'Maracanã', 'Sambódromo Marquês de Sapucaí', 0);
    expect(first).toMatchObject({ amountCents: 2000, discountPercent: 10, distanceKm: 3.7, status: 'REQUESTED' });

    await request(app.getHttpServer())
      .post('/api/corridas')
      .set('Authorization', `Bearer ${ana.accessToken}`)
      .set('Idempotency-Key', 'quote-ride')
      .send({ pickup: 'Maracanã', destination: 'Sambódromo Marquês de Sapucaí', discountPercent: 20 })
      .expect(409);

    const open = await request(app.getHttpServer()).get('/api/corridas/disponiveis').set('Authorization', `Bearer ${manuel.accessToken}`).expect(200);
    expect(open.body.some((ride: { id: string }) => ride.id === first.id)).toBe(true);
    await request(app.getHttpServer()).get('/api/corridas/disponiveis').set('Authorization', `Bearer ${ana.accessToken}`).expect(403);

    const accepted = await request(app.getHttpServer())
      .patch(`/api/corridas/${first.id}/status`)
      .set('Authorization', `Bearer ${manuel.accessToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(200);
    expect(accepted.body).toMatchObject({ driverId: 'driver-a', driverName: 'Manuel B. Filho', vehiclePlate: 'KYZ-2356' });

    await request(app.getHttpServer())
      .patch(`/api/corridas/${second.id}/status`)
      .set('Authorization', `Bearer ${manuel.accessToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(409);

    const other = await request(app.getHttpServer())
      .patch(`/api/corridas/${second.id}/status`)
      .set('Authorization', `Bearer ${taxista.accessToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(200);
    expect(other.body.driverName).toBe('Taxista 0.');

    const assigned = await request(app.getHttpServer()).get('/api/corridas/atribuida').set('Authorization', `Bearer ${manuel.accessToken}`).expect(200);
    expect(assigned.body.id).toBe(first.id);

    await request(app.getHttpServer())
      .patch(`/api/corridas/${first.id}/status`)
      .set('Authorization', `Bearer ${manuel.accessToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    const done = await request(app.getHttpServer())
      .patch(`/api/corridas/${first.id}/status`)
      .set('Authorization', `Bearer ${manuel.accessToken}`)
      .send({ status: 'COMPLETED' })
      .expect(200);

    const rated = await request(app.getHttpServer())
      .post(`/api/corridas/${done.body.id}/avaliacao`)
      .set('Authorization', `Bearer ${ana.accessToken}`)
      .send({ score: 5, comment: 'Trajeto direto.' })
      .expect(200);
    expect(rated.body.ratingScore).toBe(5);
    await request(app.getHttpServer())
      .post(`/api/corridas/${done.body.id}/avaliacao`)
      .set('Authorization', `Bearer ${ana.accessToken}`)
      .send({ score: 4 })
      .expect(409);

    await releaseDriver(taxista.accessToken);
  });

  it('lets the passenger cancel before the trip starts', async () => {
    const created = await createRide(tokens.passengerA, 'cancel-me', 'Centro', 'Lapa');
    const cancelled = await request(app.getHttpServer())
      .post(`/api/corridas/${created.id}/cancel`)
      .set('Authorization', `Bearer ${tokens.passengerA}`)
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const driver = await login({ role: 'driver', ratr: '100002', password: 'demo-livre' });
    await releaseDriver(driver.accessToken);

    const offered = await createRide(tokens.passengerB, 'driver-can-cancel', 'Copacabana', 'Centro');
    await request(app.getHttpServer())
      .patch(`/api/corridas/${offered.id}/status`)
      .set('Authorization', `Bearer ${driver.accessToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(200);
    const declined = await request(app.getHttpServer())
      .post(`/api/corridas/${offered.id}/cancel`)
      .set('Authorization', `Bearer ${driver.accessToken}`)
      .expect(200);
    expect(declined.body.status).toBe('CANCELLED');

    const moving = await createRide(tokens.passengerB, 'too-late-to-cancel', 'Centro', 'Gloria');
    await request(app.getHttpServer())
      .patch(`/api/corridas/${moving.id}/status`)
      .set('Authorization', `Bearer ${driver.accessToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/corridas/${moving.id}/status`)
      .set('Authorization', `Bearer ${driver.accessToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/corridas/${moving.id}/cancel`)
      .set('Authorization', `Bearer ${tokens.passengerB}`)
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/corridas/${moving.id}/cancel`)
      .set('Authorization', `Bearer ${tokens.passengerA}`)
      .expect(404);
  });

  it('lets only one of two drivers accept the same ride', async () => {
    const manuel = await login({ role: 'driver', ratr: '100001', password: 'demo-livre' });
    const taxista = await login({ role: 'driver', ratr: '100002', password: 'demo-livre' });
    await releaseDriver(manuel.accessToken);
    await releaseDriver(taxista.accessToken);
    const ride = await createRide(tokens.passengerA, `race-${Date.now()}`, 'Centro', 'Lapa');
    const [left, right] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/corridas/${ride.id}/status`)
        .set('Authorization', `Bearer ${manuel.accessToken}`)
        .send({ status: 'ACCEPTED' }),
      request(app.getHttpServer())
        .patch(`/api/corridas/${ride.id}/status`)
        .set('Authorization', `Bearer ${taxista.accessToken}`)
        .send({ status: 'ACCEPTED' }),
    ]);
    expect([left.status, right.status].sort()).toEqual([200, 409]);
    await request(app.getHttpServer())
      .post(`/api/corridas/${ride.id}/cancel`)
      .set('Authorization', `Bearer ${tokens.passengerA}`)
      .expect(200);
  });

  it('counts HTTP requests by route template', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
    const metrics = await request(app.getHttpServer()).get('/api/metrics').expect(200);
    expect(metrics.text).toContain('http_requests_total{');
    expect(metrics.text).toContain('http_request_duration_seconds');
    expect(metrics.text).not.toMatch(/route="[^"]*[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  async function createRide(
    token: string,
    key: string,
    pickup: string,
    destination: string,
    discountPercent = 0,
  ): Promise<{ id: string; status: string; passengerName: string; amountCents: number; discountPercent: number; distanceKm: number }> {
    const response = await request(app.getHttpServer())
      .post('/api/corridas')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ pickup, destination, discountPercent })
      .expect(201);
    return response.body as {
      id: string;
      status: string;
      passengerName: string;
      amountCents: number;
      discountPercent: number;
      distanceKm: number;
    };
  }

  async function login(body: Record<string, string>): Promise<{ accessToken: string; profile: { sub: string; role: string; displayName: string } }> {
    const response = await request(app.getHttpServer()).post('/api/auth/login').send(body).expect(200);
    return response.body as { accessToken: string; profile: { sub: string; role: string; displayName: string } };
  }

  async function releaseDriver(token: string): Promise<void> {
    const assigned = await request(app.getHttpServer()).get('/api/corridas/atribuida').set('Authorization', `Bearer ${token}`);
    if (assigned.status === 404) {
      return;
    }
    expect(assigned.status).toBe(200);
    let ride = assigned.body as { id: string; status: string };
    if (ride.status === 'ACCEPTED') {
      const started = await request(app.getHttpServer())
        .patch(`/api/corridas/${ride.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);
      ride = started.body as { id: string; status: string };
    }
    if (ride.status === 'IN_PROGRESS') {
      await request(app.getHttpServer())
        .patch(`/api/corridas/${ride.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'COMPLETED' })
        .expect(200);
    }
  }
});

function operation(document: OpenAPIObject, path: string, method: 'get' | 'post' | 'patch') {
  return document.paths[path]?.[method];
}
