import { FormEvent, useEffect, useRef, useState } from 'react';
import { advanceRide, ApiError, cancelRide, explain, listAvailable, loadAssigned, loginDriver } from './api';
import { distanceLabel, money, paymentLabel, paymentMark } from './format';
import { PaymentMethod, Ride, Session } from './types';
import { Brand, Chat, Drawer, Phone, RouteMap, Toast, TopBar } from './ui';

export function DriverLogin({ onSuccess, onPassenger }: { onSuccess: (session: Session) => void; onPassenger: () => void }) {
  const [ratr, setRatr] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSuccess(await loginDriver(ratr.trim(), password));
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Phone tone="dark">
      <form className="driver-login" onSubmit={submit}>
        <Brand variant="driver" />
        <label htmlFor="ratr">Seu RATR</label>
        <input id="ratr" inputMode="numeric" autoComplete="username" value={ratr} onChange={(event) => setRatr(event.target.value)} required />
        <label htmlFor="senha">Senha</label>
        <input id="senha" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <button className="cta" type="submit" disabled={busy}>
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
        {error ? <p className="form-error light">{error}</p> : null}
        <button
          className="link-button light"
          type="button"
          onClick={() => {
            setRatr('100001');
            setPassword('demo-livre');
          }}
        >
          Preencher conta de demonstração
        </button>
        <p className="city-mark">
          RIO
          <small>PREFEITURA</small>
        </p>
        <p className="city-sub">IPLANRIO</p>
        <button className="link-button light" type="button" onClick={onPassenger}>
          Entrar como passageiro
        </button>
      </form>
    </Phone>
  );
}

export function DriverApp({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const token = session.accessToken;
  const profile = session.profile;
  const [availability, setAvailability] = useState<'livre' | 'ocupado'>('livre');
  const [maxDiscount, setMaxDiscount] = useState(30);
  const [accepts, setAccepts] = useState<Record<PaymentMethod, boolean>>({
    credit_card: true,
    debit_card: false,
    cash: true,
  });
  const [offers, setOffers] = useState<Ride[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [active, setActive] = useState<Ride | null>(null);
  const [receipt, setReceipt] = useState<Ride | null>(null);
  const [chat, setChat] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const pollGeneration = useRef(0);

  useEffect(() => {
    if (receipt || chat) {
      return;
    }
    let stop = false;
    async function tick() {
      const generation = pollGeneration.current;
      try {
        const assigned = await loadAssigned(token);
        if (stop || generation !== pollGeneration.current) {
          return;
        }
        if (assigned) {
          setActive(assigned);
          return;
        }
        setActive(null);
        if (availability === 'livre') {
          const open = await listAvailable(token);
          if (!stop && generation === pollGeneration.current) {
            setOffers(open);
          }
        }
      } catch (cause) {
        if (!stop && generation === pollGeneration.current) {
          fail(cause);
        }
      }
    }
    void tick();
    const handle = window.setInterval(() => void tick(), 3000);
    return () => {
      stop = true;
      window.clearInterval(handle);
    };
  }, [token, availability, receipt, chat]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const handle = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(handle);
  }, [notice]);

  function fail(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) {
      onLogout();
      return;
    }
    setNotice(explain(cause));
  }

  const offer =
    availability === 'livre'
      ? offers.find((ride) => !hidden.includes(ride.id) && ride.discountPercent <= maxDiscount && accepts[ride.paymentMethod])
      : undefined;

  async function accept() {
    if (!offer) {
      return;
    }
    setBusy(true);
    pollGeneration.current += 1;
    try {
      setActive(await advanceRide(token, offer.id, 'ACCEPTED'));
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  }

  async function move(status: 'IN_PROGRESS' | 'COMPLETED') {
    if (!active) {
      return;
    }
    setBusy(true);
    try {
      const next = await advanceRide(token, active.id, status);
      if (status === 'COMPLETED') {
        setReceipt(next);
        setActive(null);
      } else {
        setActive(next);
      }
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!active) {
      return;
    }
    setBusy(true);
    try {
      await cancelRide(token, active.id);
      setActive(null);
      setNotice('Corrida recusada.');
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <Phone tone="teal">
        <section className="driver-receipt">
          <h2>Corrida finalizada</h2>
          <p>Guia de cobrança (Bandeira {receipt.fareFlag})</p>
          <p>
            <span>Total da corrida</span>
            <strong>{money(receipt.baseCents)}</strong>
          </p>
          <p>
            <span>Desconto de {receipt.discountPercent}%</span>
            <strong>{money(receipt.baseCents - receipt.amountCents)}</strong>
          </p>
          <div>
            <span>Valor a receber</span>
            <strong>{money(receipt.amountCents)}</strong>
          </div>
          <button className="cta" type="button" onClick={() => setReceipt(null)}>
            Ok
          </button>
        </section>
      </Phone>
    );
  }

  if (chat && active) {
    return (
      <Phone>
        <Chat
          title="Chat"
          peer={active.passengerName}
          meta={`${active.pickup} → ${active.destination}`}
          mark="driver"
          onBack={() => setChat(false)}
        />
      </Phone>
    );
  }

  return (
    <Phone>
      <TopBar title="TAXI.RIO" onMenu={() => setMenu(true)} />
      <section className="driver-map">
        <RouteMap
          from={active?.pickup ?? offer?.pickup ?? 'Centro'}
          to={active?.destination ?? offer?.destination ?? 'Zona Sul'}
          taxiAt={active?.status === 'IN_PROGRESS' ? 'middle' : 'start'}
        />
        {availability === 'livre' && !active && !offer ? (
          <div className="free-readout">
            <p>Bandeira 2</p>
            <strong>até {maxDiscount}%</strong>
            <small>Corridas acima deste desconto ficam ocultas.</small>
          </div>
        ) : null}
        {availability === 'ocupado' && !active && !offer ? (
          <article className="driver-panel">
            <header>
              <span className="avatar">{profile.displayName.slice(0, 1)}</span>
              <div>
                <strong>
                  {profile.displayName} {profile.rating ?? '—'} ★
                </strong>
                <small>{profile.vehicleModel}</small>
              </div>
              <b>{profile.vehiclePlate}</b>
            </header>
            <p>Desconto aceito</p>
            <input
              type="range"
              min={0}
              max={40}
              step={10}
              value={maxDiscount}
              aria-label="Desconto máximo"
              onChange={(event) => setMaxDiscount(Number(event.target.value))}
            />
            <strong className="big">{maxDiscount}%</strong>
            <p>Formas de pagamento que aceito</p>
            {(['credit_card', 'debit_card', 'cash'] as PaymentMethod[]).map((method) => (
              <label key={method} className="switch-row">
                <span>
                  {paymentMark(method)} {paymentLabel(method)}
                  {method === 'cash' ? ' (obrigatório)' : ''}
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={accepts[method]}
                  disabled={method === 'cash'}
                  onChange={() => setAccepts((current) => ({ ...current, [method]: !current[method] }))}
                />
              </label>
            ))}
          </article>
        ) : null}
        {offer && !active ? (
          <article className="offer-card">
            <h2>{offer.pickup}</h2>
            <p>{offer.destination}</p>
            <ul>
              <li>{offer.durationMin} min</li>
              <li>{distanceLabel(offer.distanceKm)}</li>
              <li>{offer.discountPercent}%</li>
              <li>B{offer.fareFlag}</li>
              <li>{paymentMark(offer.paymentMethod)}</li>
            </ul>
          </article>
        ) : null}
        {active ? (
          <article className="offer-card">
            <h2>{active.status === 'IN_PROGRESS' ? active.destination : active.pickup}</h2>
            <p>{active.passengerName}</p>
            <ul>
              <li>{active.durationMin} min</li>
              <li>{distanceLabel(active.distanceKm)}</li>
              <li>{active.discountPercent}%</li>
              <li>B{active.fareFlag}</li>
              <li>{paymentMark(active.paymentMethod)}</li>
            </ul>
          </article>
        ) : null}
      </section>
      {offer && !active ? (
        <div className="pair inset">
          <button className="danger" type="button" onClick={() => setHidden((current) => [...current, offer.id])}>
            Recusar
          </button>
          <button className="ok" type="button" disabled={busy} onClick={() => void accept()}>
            Aceitar
          </button>
        </div>
      ) : null}
      {active ? (
        <>
          <button className="start" type="button" disabled={busy} onClick={() => void move(active.status === 'ACCEPTED' ? 'IN_PROGRESS' : 'COMPLETED')}>
            {active.status === 'ACCEPTED' ? 'Iniciar corrida' : 'Finalizar corrida'}
          </button>
          <div className="pair inset">
            {active.status === 'ACCEPTED' ? (
              <button className="ghost" type="button" disabled={busy} onClick={() => void cancel()}>
                Cancelar
              </button>
            ) : (
              <span />
            )}
            <button className="ghost" type="button" onClick={() => setChat(true)}>
              Mensagem
            </button>
          </div>
        </>
      ) : null}
      {!offer && !active ? (
        <button className={`duty ${availability}`} type="button" onClick={() => setAvailability(availability === 'livre' ? 'ocupado' : 'livre')}>
          <span>{availability === 'livre' ? '»' : '«'}</span>
          {availability === 'livre' ? 'Livre' : 'Ocupado'}
        </button>
      ) : null}
      {menu ? (
        <Drawer name={profile.displayName} detail={`RATR ${profile.ratr ?? ''}`} onClose={() => setMenu(false)}>
          <button type="button" onClick={onLogout}>
            Sair
          </button>
        </Drawer>
      ) : null}
      {notice ? <Toast>{notice}</Toast> : null}
    </Phone>
  );
}
