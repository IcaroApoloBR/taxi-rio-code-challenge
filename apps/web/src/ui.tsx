import { ReactNode, useState } from 'react';
import passengerLogo from './assets/layoutPassenger/logo.webp';
import driverLogo from './assets/layoutDriver/logo.webp';

export function Phone({ children, tone = 'light' }: { children: ReactNode; tone?: 'light' | 'dark' | 'teal' }) {
  return (
    <div className="stage">
      <div className={`phone tone-${tone}`}>{children}</div>
    </div>
  );
}

export function Brand({ variant }: { variant: 'passenger' | 'driver' }) {
  const logo = variant === 'passenger' ? passengerLogo : driverLogo;
  return (
    <div className={`brand brand-${variant}`}>
      <img src={logo} alt="TAXI.RIO" />
      <strong>TAXI.RIO</strong>
      {variant === 'passenger' ? <small>CIDADES</small> : null}
    </div>
  );
}

export function TopBar({
  onMenu,
  onBack,
  title,
  mark,
}: {
  onMenu?: () => void;
  onBack?: () => void;
  title?: string;
  mark?: 'passenger' | 'driver';
}) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="icon-button" type="button" onClick={onBack} aria-label="Voltar">
          ‹
        </button>
      ) : (
        <button className="icon-button" type="button" onClick={onMenu} aria-label="Abrir menu">
          <span />
          <span />
          <span />
        </button>
      )}
      {title ? <h1>{title}</h1> : <span />}
      {mark ? <img className="top-logo" src={mark === 'passenger' ? passengerLogo : driverLogo} alt="" /> : <span />}
    </header>
  );
}

export function Drawer({
  name,
  detail,
  children,
  onClose,
}: {
  name: string;
  detail: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="backdrop" onClick={onClose}>
      <nav className="drawer" onClick={(event) => event.stopPropagation()} aria-label="Menu">
        <p>{name}</p>
        <small>{detail}</small>
        {children}
        <button className="text-button" type="button" onClick={onClose}>
          Fechar
        </button>
      </nav>
    </div>
  );
}

export function Toast({ children }: { children: string }) {
  return (
    <p className="toast" role="status">
      {children}
    </p>
  );
}

export function RouteMap({
  from,
  to,
  taxiAt,
}: {
  from: string;
  to: string;
  taxiAt?: 'start' | 'middle';
}) {
  return (
    <div className="map" aria-hidden="true">
      <svg viewBox="0 0 360 280">
        <rect width="360" height="280" fill="#e7eef2" />
        <path d="M210 0h150v96c-28 8-62-8-86-28S236 8 210 0Z" fill="#c5dde8" />
        <path d="M0 168c28-34 70-18 92 8 18 22-8 48-34 58S8 214 0 230Z" fill="#cfe3c8" />
        <g stroke="#fff" strokeWidth="7" fill="none">
          <path d="M0 64h360M0 128h360M0 196h360M62 0v280M150 0v280M238 0v280" />
        </g>
        <path d="M74 176c38-8 62-42 108-52 46-10 78-18 112-8" fill="none" stroke="#16324a" strokeWidth="5" />
        <circle cx="74" cy="176" r="9" fill="#f5c400" stroke="#16324a" strokeWidth="3" />
        <rect x="286" y="108" width="16" height="16" rx="2" fill="#f5c400" stroke="#16324a" strokeWidth="3" />
        {taxiAt ? <circle cx={taxiAt === 'start' ? 108 : 188} cy={taxiAt === 'start' ? 166 : 132} r="16" fill="#072f3a" /> : null}
        {taxiAt ? (
          <path
            d={taxiAt === 'start' ? 'M100 166h16M104 162h8M104 170h8' : 'M180 132h16M184 128h8M184 136h8'}
            stroke="#f5c400"
            strokeWidth="2"
          />
        ) : null}
      </svg>
      <span className="map-from">{from}</span>
      <span className="map-to">{to}</span>
    </div>
  );
}

export function Stars({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Avaliação">
      {[1, 2, 3, 4, 5].map((score) => (
        <button key={score} type="button" aria-checked={value === score} role="radio" onClick={() => onChange(score)}>
          {score <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}

const quickReplies = ['Estou aguardando', 'Estou a caminho', 'Você passou do endereço'];

export function Chat({
  title,
  peer,
  meta,
  onBack,
  mark = 'passenger',
}: {
  title: string;
  peer: string;
  meta: string;
  onBack: () => void;
  mark?: 'passenger' | 'driver';
}) {
  const [messages, setMessages] = useState<Array<{ mine: boolean; text: string; time: string }>>([]);
  const [draft, setDraft] = useState('');

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setMessages((current) => [...current, { mine: true, text: trimmed, time }]);
    setDraft('');
  }

  return (
    <section className="chat">
      <TopBar title={title} onBack={onBack} mark={mark} />
      <div className="chat-peer">
        <span>{peer.slice(0, 1)}</span>
        <div>
          <strong>{peer}</strong>
          <small>{meta}</small>
        </div>
      </div>
      <div className="chat-log">
        {messages.length === 0 ? <p>As mensagens ficam só neste aparelho.</p> : null}
        {messages.map((message, index) => (
          <p key={`${message.time}-${index}`} className={message.mine ? 'mine' : 'theirs'}>
            {message.text}
            <small>{message.time}</small>
          </p>
        ))}
      </div>
      <div className="quick">
        {quickReplies.map((reply) => (
          <button key={reply} type="button" onClick={() => send(reply)}>
            {reply}
          </button>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Digite aqui sua mensagem" aria-label="Mensagem" />
        <button type="submit" aria-label="Enviar">
          ›
        </button>
      </form>
    </section>
  );
}
