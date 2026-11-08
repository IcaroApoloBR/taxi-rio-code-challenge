import { useState } from 'react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export default function App() {
  const [token, setToken] = useState('');
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [message, setMessage] = useState('Informe um token de demonstração para começar.');
  const [loading, setLoading] = useState(false);

  async function createRide(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('A criação de corridas será conectada à API na próxima etapa.');

    try {
      const response = await fetch(`${apiBaseUrl}/api/health`);
      const health = await response.json() as { status: string };
      setMessage(`API: ${health.status}. Endpoint de criação ainda não implementado.`);
    } catch {
      setMessage('Não foi possível conectar à API. Verifique se o Docker Compose está ativo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="header">
        <div className="brand-mark">T</div>
        <div>
          <p className="eyebrow">MOBILIDADE URBANA</p>
          <h1>TAXI.RIO <span>Corridas</span></h1>
        </div>
      </header>

      <section className="intro">
        <p className="eyebrow">AMBIENTE DE DEMONSTRAÇÃO</p>
        <h2>Fluxo de corridas</h2>
        <p>Interface inicial para validar a comunicação entre UI e API.</p>
      </section>

      <section className="panel">
        <h3>Autenticação</h3>
        <label htmlFor="token">JWT de demonstração</label>
        <textarea
          id="token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Cole aqui um token de passageiro ou motorista"
          rows={3}
        />
        <p className="hint">O token será enviado no header Authorization quando os endpoints forem implementados.</p>
      </section>

      <section className="panel">
        <h3>Solicitar corrida</h3>
        <form onSubmit={createRide}>
          <label htmlFor="pickup">Origem</label>
          <input id="pickup" value={pickup} onChange={(event) => setPickup(event.target.value)} required />
          <label htmlFor="destination">Destino</label>
          <input id="destination" value={destination} onChange={(event) => setDestination(event.target.value)} required />
          <button type="submit" disabled={loading || !token.trim()}>
            {loading ? 'Verificando...' : 'Verificar conexão com API'}
          </button>
        </form>
      </section>

      <section className="notice" role="status" aria-live="polite">{message}</section>
      <footer>Desafio técnico · Serviço de corridas · Protótipo funcional em evolução</footer>
    </main>
  );
}
