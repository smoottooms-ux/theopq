import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { useCloud } from '../../lib/useCloud';
import { Field, TopBar, useToast } from '../../components/ui';
import { IconCheck, IconRefresh } from '../../components/Icons';
import { checkServer, cloudSignIn, cloudSignUp, pushChild } from '../../lib/cloud';
import { PinInput } from '../../components/ui';

/**
 * Connecting the parent's device to a sync server.
 *
 * This is the screen that turns the app from "one phone" into "your phone and
 * their tablet", which is the whole point when you are 400 miles away.
 */
export default function SyncScreen() {
  const navigate = useNavigate();
  const { data, parent, setSettings } = useApp();
  const { cloud, connected, syncing, lastSync, error, connect, disconnect, syncNow } = useCloud();
  const toast = useToast();

  const [serverUrl, setServerUrl] = useState(data.settings.serverUrl ?? '');
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState(parent?.email ?? '');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!serverUrl.trim()) return setReachable(null);
    let cancelled = false;
    const timer = setTimeout(() => {
      void checkServer(serverUrl).then((ok) => !cancelled && setReachable(ok));
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [serverUrl]);

  const doConnect = async () => {
    if (!parent) return;
    setBusy(true);
    try {
      const result =
        mode === 'signup'
          ? await cloudSignUp(serverUrl, { name: parent.name, email, pin })
          : await cloudSignIn(serverUrl, email, pin);

      connect(result.session);
      setSettings({ serverUrl: result.session.serverUrl });

      // Upload the children so their devices can pair immediately.
      for (const child of data.children) {
        await pushChild(result.session, child, child.pin).catch(() => undefined);
      }

      toast(`Connected. Family code: ${result.joinCode}`);
      setPin('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not connect.');
    } finally {
      setBusy(false);
    }
  };

  if (connected && cloud) {
    return (
      <div className="screen">
        <TopBar title="Sync" onBack={() => navigate('/p/settings')} />

        <div className="card" style={{ textAlign: 'center' }}>
          <div className="avatar avatar--lg" style={{ margin: '0 auto 12px', color: 'var(--good)' }}>
            <IconCheck size={36} />
          </div>
          <h2>Connected</h2>
          <p className="muted" style={{ marginTop: 6 }}>{cloud.serverUrl}</p>
          {lastSync && (
            <p className="muted" style={{ marginTop: 4 }}>
              Last synced {new Date(lastSync).toLocaleTimeString()}
            </p>
          )}
          {error && (
            <p className="muted" style={{ color: 'var(--warn)', marginTop: 8 }}>⚠ {error}</p>
          )}
        </div>

        <div className="card">
          <h3>Your family code</h3>
          <p className="muted" style={{ marginTop: 6 }}>
            Type this into your child's device once, with their own 4-digit code, and their tablet
            is paired to your account forever.
          </p>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 40,
              letterSpacing: '0.18em',
              textAlign: 'center',
              margin: '16px 0 6px',
              color: 'var(--accent)',
            }}
          >
            {cloud.joinCode}
          </div>
        </div>

        <div className="card stack">
          <button className="btn btn--block" onClick={() => void syncNow()} disabled={syncing}>
            <IconRefresh size={18} className={syncing ? 'spin' : undefined} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
          <button
            className="btn btn--ghost btn--block btn--sm"
            onClick={() => {
              disconnect();
              toast('Disconnected. Everything stays on this device.');
            }}
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <TopBar
        title="Sync across devices"
        subtitle="Optional — the app works without it"
        onBack={() => navigate('/p/settings')}
      />

      <div className="card">
        <h3>Why bother</h3>
        <p className="soft" style={{ marginTop: 6 }}>
          Without sync, everything lives on this one phone. With it, you send a story from a
          truck stop at 11pm and it is on your child's tablet before they brush their teeth.
        </p>
        <p className="muted" style={{ marginTop: 10 }}>
          You run the server — it is in the <code>server/</code> folder of this project. Nothing
          goes to us, and your API keys never leave this device.
        </p>
      </div>

      <div className="card stack">
        <Field label="Server address" hint="For example https://nightshift.yourdomain.com">
          <input
            className="input"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://…"
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="url"
          />
        </Field>
        {reachable === true && <p className="muted" style={{ color: 'var(--good)' }}>✓ Server is up.</p>}
        {reachable === false && (
          <p className="muted" style={{ color: 'var(--bad)' }}>Cannot reach that address.</p>
        )}

        <div className="chips">
          <button className="chip" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>
            New account
          </button>
          <button className="chip" aria-pressed={mode === 'signin'} onClick={() => setMode('signin')}>
            I already have one
          </button>
        </div>

        <Field label="Email">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>

        <Field label="PIN" hint="Use the same PIN you sign into the app with.">
          <PinInput value={pin} onChange={setPin} />
        </Field>

        <button
          className="btn btn--block btn--lg"
          onClick={doConnect}
          disabled={busy || !reachable || pin.length !== 4 || !email.trim()}
        >
          {busy ? 'Connecting…' : mode === 'signup' ? 'Create cloud account' : 'Connect'}
        </button>
      </div>
    </div>
  );
}
