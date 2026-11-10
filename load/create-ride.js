import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 5 },
    { duration: '20s', target: 5 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

const base = __ENV.API_BASE_URL || 'http://host.docker.internal:3000';

export function setup() {
  const login = http.post(
    `${base}/api/auth/login`,
    JSON.stringify({ role: 'passenger', email: 'ana@demo.taxi.rio', phone: '(21) 98888-1001' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(login, { 'login ok': (response) => response.status === 201 || response.status === 200 });
  return { token: login.json('accessToken') };
}

export default function (data) {
  const response = http.post(
    `${base}/api/corridas`,
    JSON.stringify({
      pickup: 'Copacabana',
      destination: 'Centro',
      discountPercent: 0,
      paymentMethod: 'credit_card',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.token}`,
        'Idempotency-Key': `${__VU}-${__ITER}-${Date.now()}`,
      },
    },
  );
  check(response, { 'corrida criada': (item) => item.status === 201 });
  sleep(0.2);
}
