import { FormEvent, useEffect, useState } from 'react';
import { ApiError, cancelRide, createRide, explain, listRides, loadRide, loginPassenger, quoteRide, rateRide } from './api';
import { distanceLabel, money, paymentCycle, paymentLabel, statusLabel, whenLabel } from './format';
import { PaymentMethod, Ride, RideQuote, Session } from './types';
import { Brand, Chat, Drawer, Phone, RouteMap, Stars, Toast, TopBar } from './ui';

type Screen = 'request' | 'quote' | 'ride' | 'chat' | 'receipt' | 'history';

export function PassengerLogin({ onSuccess, onDriver }: { onSuccess: (session: Session) => void; onDriver: () => void }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSuccess(await loginPassenger(email.trim(), phone.trim()));
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Phone tone="dark">
      <section className="login-hero">
        <Brand variant="passenger" />
      </section>
      <form className="sheet" onSubmit={submit}>
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label htmlFor="phone">Telefone</label>
        <input id="phone" inputMode="tel" autoComplete="tel" placeholder="(XX) XXXXX-XXXX" value={phone} onChange={(event) => setPhone(event.target.value)} required />
        <button className="cta" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="fine">Caso não tenha uma conta, use os campos acima para criá-la e cuidaremos do resto.</p>
        <button
          className="link-button"
          type="button"
          onClick={() => {
            setEmail('ana@demo.taxi.rio');
            setPhone('(21) 98888-1001');
          }}
        >
          Preencher conta de demonstração
        </button>
        <p className="fine">Não consegue acessar?</p>
        <button className="link-button" type="button" onClick={onDriver}>
          Entrar como motorista
        </button>
      </form>
    </Phone>
  );
}

export function PassengerApp({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const token = session.accessToken;
  const [screen, setScreen] = useState<Screen>('request');
  const [pickup, setPickup] = useState('Maracanã');
  const [destination, setDestination] = useState('Sambódromo Marquês de Sapucaí');
  const [preview, setPreview] = useState<RideQuote | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>('credit_card');
  const [ride, setRide] = useState<Ride | null>(null);
  const [history, setHistory] = useState<Ride[]>([]);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let ignore = false;
    listRides(token)
      .then((rides) => {
        if (ignore) {
          return;
        }
        setHistory(rides);
        const active = rides.find((item) => item.status === 'REQUESTED' || item.status === 'ACCEPTED' || item.status === 'IN_PROGRESS');
        if (active) {
          setRide(active);
          setScreen('ride');
        }
      })
      .catch((cause) => fail(cause));
    return () => {
      ignore = true;
    };
  }, [token]);

  useEffect(() => {
    if (pickup.trim().length < 2 || destination.trim().length < 2 || screen === 'ride') {
      return;
    }
    const handle = window.setTimeout(() => {
      void quoteRide(token, pickup.trim(), destination.trim())
        .then(setPreview)
        .catch((cause: unknown) => {
          setPreview(null);
          if (cause instanceof ApiError && cause.status === 401) {
            onLogout();
          }
        });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [pickup, destination, token, screen]);

  useEffect(() => {
    if (!ride || (screen !== 'ride' && screen !== 'receipt')) {
      return;
    }
    const handle = window.setInterval(() => {
      void loadRide(token, ride.id)
        .then((next) => {
          setRide(next);
          if (next.status === 'COMPLETED' && screen === 'ride') {
            setScreen('receipt');
          }
          if (next.status === 'CANCELLED' && screen === 'ride') {
            setScreen('request');
            setNotice('A corrida foi cancelada.');
          }
        })
        .catch((cause) => fail(cause));
    }, 3000);
    return () => window.clearInterval(handle);
  }, [ride?.id, screen, token]);

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

  function home() {
    if (ride && (ride.status === 'REQUESTED' || ride.status === 'ACCEPTED' || ride.status === 'IN_PROGRESS')) {
      setScreen('ride');
      return;
    }
    setScreen('request');
  }

  function openListed(item: Ride) {
    setRide(item);
    if (item.status === 'COMPLETED' && item.ratingScore === null) {
      setScreen('receipt');
      return;
    }
    if (item.status === 'REQUESTED' || item.status === 'ACCEPTED' || item.status === 'IN_PROGRESS') {
      setScreen('ride');
    }
  }

  async function openQuote() {
    setBusy(true);
    try {
      setPreview(await quoteRide(token, pickup.trim(), destination.trim()));
      setScreen('quote');
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  }

  async function choose(discountPercent: number) {
    setBusy(true);
    try {
      const created = await createRide(token, {
        pickup: pickup.trim(),
        destination: destination.trim(),
        discountPercent,
        paymentMethod: payment,
      });
      setRide(created);
      setHistory(await listRides(token));
      setScreen('ride');
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!ride) {
      return;
    }
    setBusy(true);
    try {
      await cancelRide(token, ride.id);
      setRide(null);
      setScreen('request');
      setNotice('Corrida cancelada.');
      setHistory(await listRides(token));
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  }

  async function finish(skip: boolean) {
    if (!ride) {
      return;
    }
    setBusy(true);
    try {
      if (!skip && stars > 0) {
        await rateRide(token, ride.id, stars, comment);
      }
      setHistory(await listRides(token));
      setRide(null);
      setStars(0);
      setComment('');
      setScreen('request');
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  }

  async function copyDriver() {
    if (!ride?.driverName) {
      return;
    }
    const text = `${ride.driverName} · ${ride.vehicleModel ?? ''} · ${ride.vehiclePlate ?? ''}`;
    try {
      await navigator.clipboard.writeText(text);
      setNotice('Dados do taxista copiados.');
    } catch {
      setNotice(text);
    }
  }

  const quote = preview;
  const canCancel = ride?.status === 'REQUESTED' || ride?.status === 'ACCEPTED';

  return (
    <Phone>
      {screen !== 'chat' && screen !== 'receipt' ? (
        <TopBar
          mark="passenger"
          onBack={screen === 'quote' || screen === 'history' ? home : undefined}
          onMenu={screen === 'request' || screen === 'ride' ? () => setMenu(true) : undefined}
        />
      ) : null}

      {screen === 'request' ? (
        <section className="stack">
          <RouteMap from={pickup || 'Origem'} to={destination || 'Destino'} />
          {quote ? (
            <p className="trip-pill">
              <span>{distanceLabel(quote.distanceKm)}</span>
              <span>{quote.durationMin} min</span>
            </p>
          ) : null}
          <label className="place">
            <i className="dot" />
            <input aria-label="Origem" value={pickup} onChange={(event) => setPickup(event.target.value)} />
          </label>
          <label className="place">
            <i className="square" />
            <input aria-label="Destino" value={destination} onChange={(event) => setDestination(event.target.value)} />
          </label>
        </section>
      ) : null}
      {screen === 'request' ? (
        <div className="actions">
          <button className="cta" type="button" disabled={busy || !pickup.trim() || !destination.trim()} aria-busy={busy} onClick={() => void openQuote()}>
            {busy ? 'Calculando...' : 'Avançar'}
          </button>
        </div>
      ) : null}

      {screen === 'quote' && quote ? (
        <section className="stack quote-screen">
          <article className="card">
            <p className="route-line">
              <i className="dot" />
              {pickup}
            </p>
            <p className="route-line">
              <i className="square" />
              {destination}
            </p>
            <p className="metrics">
              <span>Bandeira {quote.fareFlag}</span>
              <span>{distanceLabel(quote.distanceKm)}</span>
              <span>{quote.durationMin} min</span>
            </p>
          </article>
          <h2>Selecione o desconto</h2>
          <table>
            <thead>
              <tr>
                <th>Desconto</th>
                <th>Taxistas disponíveis</th>
                <th>Valor estimado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {quote.options.map((option) => (
                <tr key={option.discountPercent}>
                  <td>{option.discountPercent === 0 ? 'Tarifa normal' : `${option.discountPercent}%`}</td>
                  <td>{option.driversAvailable}</td>
                  <td>{money(option.amountCents)}</td>
                  <td>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Escolher ${option.discountPercent === 0 ? 'a tarifa normal' : `desconto de ${option.discountPercent}%`} por ${money(option.amountCents)}`}
                      onClick={() => void choose(option.discountPercent)}
                    >
                      OK
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <article className="pay-card">
            <p>Forma de pagamento</p>
            <div>
              <span>{paymentLabel(payment)}</span>
              <button
                type="button"
                onClick={() => setPayment(paymentCycle[(paymentCycle.indexOf(payment) + 1) % paymentCycle.length] ?? 'credit_card')}
              >
                Alterar
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {screen === 'ride' && ride ? (
        <section className="stack ride-screen">
          <RouteMap from={ride.pickup} to={ride.destination} taxiAt={ride.status === 'IN_PROGRESS' ? 'middle' : 'start'} />
          <p className="status-line" role="status">
            {statusLabel(ride.status)}
          </p>
          {ride.driverName ? (
            <article className="driver-card">
              <div>
                <span className="avatar">{ride.driverName.slice(0, 1)}</span>
                <div>
                  <strong>{ride.driverName}</strong>
                  <small>{ride.driverRating ?? '—'} ★</small>
                  <small>Chegará em {ride.durationMin} min</small>
                </div>
                <button type="button" onClick={() => void copyDriver()} aria-label="Copiar dados do taxista">
                  ↗
                </button>
              </div>
              <p>
                <span>{ride.vehicleModel}</span>
                <span>
                  Placa
                  <strong>{ride.vehiclePlate}</strong>
                </span>
              </p>
            </article>
          ) : (
            <article className="card waiting">Aguardando um motorista aceitar esta corrida.</article>
          )}
          <p className="route-line">
            <i className="dot" />
            {ride.pickup}
          </p>
          <p className="route-line">
            <i className="square" />
            {ride.destination}
          </p>
        </section>
      ) : null}
      {screen === 'ride' && ride ? (
        <div className="actions">
          <div className="pair">
            {canCancel ? (
              <button className="danger" type="button" disabled={busy} onClick={() => void cancel()}>
                Cancelar
              </button>
            ) : (
              <span />
            )}
            <button className="ghost" type="button" onClick={() => setScreen('chat')}>
              Mensagem
            </button>
          </div>
        </div>
      ) : null}

      {screen === 'chat' && ride ? (
        <Chat
          title="Chat"
          peer={ride.driverName ?? 'Taxista'}
          meta={`${ride.vehicleModel ?? 'Táxi'} · ${ride.vehiclePlate ?? 'a caminho'}`}
          onBack={() => setScreen('ride')}
        />
      ) : null}

      {screen === 'receipt' && ride ? (
        <section className="receipt-page">
          <h2>Detalhes da corrida</h2>
          <article className="card">
            <h3>Percurso</h3>
            <p className="route-line">
              <i className="dot" />
              {ride.pickup}
            </p>
            <p className="route-line">
              <i className="square" />
              {ride.destination}
            </p>
          </article>
          <article className="card">
            <h3>Pagamento</h3>
            <p className="metrics">
              <span>{paymentLabel(ride.paymentMethod)}</span>
              <span>Bandeira {ride.fareFlag}</span>
              <span>{ride.discountPercent}%</span>
            </p>
            <p className="money-line">
              <span>Valor da corrida</span>
              <span>{money(ride.baseCents)}</span>
            </p>
            <p className="money-line">
              <span>Desconto ({ride.discountPercent}%)</span>
              <span>- {money(ride.baseCents - ride.amountCents)}</span>
            </p>
            <p className="total">
              Total a pagar
              <strong>{money(ride.amountCents)}</strong>
            </p>
          </article>
          <article className="card">
            <h3>Avaliar corrida</h3>
            <p>{ride.driverName}</p>
            <Stars value={stars} onChange={setStars} />
            <label className="sr-only" htmlFor="comment">
              Comentário
            </label>
            <textarea id="comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={280} placeholder="Comentário" />
          </article>
        </section>
      ) : null}
      {screen === 'receipt' && ride ? (
        <div className="actions">
          <button className="cta" type="button" disabled={busy} aria-busy={busy} onClick={() => void finish(false)}>
            {stars > 0 ? 'Enviar avaliação' : 'Finalizar'}
          </button>
          <button className="link-button" type="button" disabled={busy} onClick={() => void finish(true)}>
            Não quero avaliar
          </button>
        </div>
      ) : null}

      {screen === 'history' ? (
        <section className="stack history">
          <h2>Minhas corridas</h2>
          {history.length === 0 ? <p className="fine">Nenhuma corrida deste passageiro.</p> : null}
          {history.map((item) => {
            const canOpen = item.status !== 'CANCELLED' && !(item.status === 'COMPLETED' && item.ratingScore !== null);
            const body = (
              <>
                <p>
                  <strong>{whenLabel(item.createdAt)}</strong>
                  <span>{statusLabel(item.status)}</span>
                </p>
                <p className="route-line">
                  <i className="dot" />
                  {item.pickup}
                </p>
                <p className="route-line">
                  <i className="square" />
                  {item.destination}
                </p>
                <p className="money-line">
                  <span>{paymentLabel(item.paymentMethod)}</span>
                  <span>{money(item.amountCents)}</span>
                </p>
              </>
            );
            return (
              <article key={item.id} className="card history-card">
                {canOpen ? (
                  <button type="button" onClick={() => openListed(item)}>
                    {body}
                  </button>
                ) : (
                  body
                )}
              </article>
            );
          })}
        </section>
      ) : null}

      {menu ? (
        <Drawer name={session.profile.displayName} detail={session.profile.email ?? ''} onClose={() => setMenu(false)}>
          <button
            type="button"
            onClick={() => {
              setMenu(false);
              setScreen('history');
            }}
          >
            Minhas corridas
          </button>
          <button
            type="button"
            onClick={() => {
              setMenu(false);
              home();
            }}
          >
            Nova corrida
          </button>
          <button type="button" onClick={onLogout}>
            Sair
          </button>
        </Drawer>
      ) : null}
      {notice ? <Toast>{notice}</Toast> : null}
    </Phone>
  );
}
