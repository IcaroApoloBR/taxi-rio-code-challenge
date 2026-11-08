import { useState } from 'react';
import { DriverApp, DriverLogin } from './driver';
import { PassengerApp, PassengerLogin } from './passenger';
import { clearSession, loadSession, saveSession } from './session';
import { Session } from './types';

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [portal, setPortal] = useState<'passenger' | 'driver'>(session?.profile.role ?? 'passenger');

  function enter(next: Session) {
    saveSession(next);
    setSession(next);
  }

  function leave() {
    clearSession();
    setPortal(session?.profile.role ?? 'passenger');
    setSession(null);
  }

  if (session?.profile.role === 'passenger') {
    return <PassengerApp session={session} onLogout={leave} />;
  }
  if (session?.profile.role === 'driver') {
    return <DriverApp session={session} onLogout={leave} />;
  }
  if (portal === 'driver') {
    return <DriverLogin onSuccess={enter} onPassenger={() => setPortal('passenger')} />;
  }
  return <PassengerLogin onSuccess={enter} onDriver={() => setPortal('driver')} />;
}
