import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { TopBar } from '../../components/ui';
import { IconCheck } from '../../components/Icons';
import { API_URL, HAS_HOSTED_BACKEND } from '../../lib/config';

/**
 * The target of the confirmation link.
 *
 * The server mints /#/verify?parent=…&token=…, so this reads the query off the
 * hash, posts it back, and marks the local account confirmed. It is harmless
 * to open twice: the endpoint treats a spent token on an already-verified
 * account as success.
 */
export default function VerifyEmail() {
  const navigate = useNavigate();
  const { data, markEmailVerified } = useApp();
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const query = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    const parent = query.get('parent');
    const token = query.get('token');

    if (!parent || !token) {
      setState('failed');
      setMessage('That link is incomplete. Open the whole thing from your email.');
      return;
    }

    if (!HAS_HOSTED_BACKEND) {
      setState('failed');
      setMessage('This copy of the app has no account server, so there is nothing to confirm.');
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parent, token }),
        });
        const text = await res.text();
        const body = text ? (JSON.parse(text) as { verified?: boolean; error?: string }) : {};

        if (body.verified) {
          // Mirror it locally so the app stops asking.
          const local = data.parents.find((p) => p.id === parent) ?? data.parents[0];
          if (local) markEmailVerified(local.id);
          setState('done');
          return;
        }
        setState('failed');
        setMessage(body.error ?? 'That link did not work.');
      } catch {
        setState('failed');
        setMessage('Could not reach the server. Try the link again in a moment.');
      }
    })();
    // Runs once on open; the link does not change underneath it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen">
      <TopBar title="Your email" onBack={() => navigate('/p')} />

      <div className="card" style={{ textAlign: 'center' }}>
        {state === 'done' ? (
          <>
            <div className="avatar avatar--lg" style={{ margin: '0 auto 12px', color: 'var(--good)' }}>
              <IconCheck size={36} />
            </div>
            <h2>Email confirmed</h2>
            <p className="muted" style={{ marginTop: 8 }}>
              That is the only thing it was needed for. Back to bedtime.
            </p>
          </>
        ) : state === 'working' ? (
          <>
            <h2>Confirming…</h2>
            <p className="muted" style={{ marginTop: 8 }}>One moment.</p>
          </>
        ) : (
          <>
            <h2>That did not work</h2>
            <p className="muted" style={{ marginTop: 8 }}>{message}</p>
          </>
        )}
      </div>

      <button className="btn btn--block btn--lg" style={{ marginTop: 16 }} onClick={() => navigate('/p')}>
        Carry on
      </button>
    </div>
  );
}
