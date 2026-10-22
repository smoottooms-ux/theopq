import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Field, PasswordInput, TopBar, useToast } from '../../components/ui';

/**
 * Getting back in.
 *
 * The accounts on this phone are listed by name and email. Guessing which
 * address you signed up with is the single most common way to be locked out of
 * a local account, and the app already knows the answer — there is no reason
 * to make a parent remember it. Picking one fills the email in; the password
 * is still required.
 */
export default function SignIn() {
  const navigate = useNavigate();
  const { signInParent, localParents } = useApp();
  const toast = useToast();

  const accounts = localParents();
  const [email, setEmail] = useState(accounts[0]?.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // Only one account on the phone is the overwhelmingly common case, and then
  // the picker is noise.
  const [picking, setPicking] = useState(accounts.length > 1);

  useEffect(() => {
    if (accounts.length === 1) setEmail(accounts[0].email);
  }, [accounts]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signInParent(email, password);
      navigate('/p', { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not sign in.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <TopBar title="Welcome back" onBack={() => navigate('/welcome')} />

      {picking && accounts.length > 0 && (
        <div className="card stack">
          <h3>Which account?</h3>
          {accounts.map((a) => (
            <button
              key={a.id}
              className="btn btn--soft btn--block"
              onClick={() => {
                setEmail(a.email);
                setPicking(false);
              }}
            >
              {a.name} — {a.email}
            </button>
          ))}
        </div>
      )}

      {!picking && (
        <form className="card stack" onSubmit={submit}>
          <Field label="Email">
            <input
              id="signin-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              required
            />
          </Field>
          <Field label="Password">
            <PasswordInput id="signin-password" value={password} onChange={setPassword} autoFocus />
          </Field>
          <button className="btn btn--block" disabled={busy || !password}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
        </form>
      )}

      {/*
        The accounts actually on this phone, shown plainly. A parent who signed
        up with a different address than the one they are typing gets told so
        here, instead of "that email and password do not match" over and over.
      */}
      {accounts.length > 0 && (
        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>
            On this phone
          </div>
          {accounts.map((a) => (
            <p key={a.id} className="muted" style={{ marginTop: 4 }}>
              {a.name} — <strong>{a.email}</strong>
            </p>
          ))}
          <p className="muted" style={{ marginTop: 8 }}>
            Only these can sign in here. Your recordings belong to whichever one you used.
          </p>
        </div>
      )}

      <button
        className="btn btn--ghost btn--block btn--sm"
        style={{ marginTop: 12 }}
        onClick={() => navigate('/forgot')}
      >
        I forgot my password
      </button>

      <button
        className="btn btn--soft btn--block btn--sm"
        style={{ marginTop: 8 }}
        onClick={() => navigate('/signup')}
      >
        Create a different account
      </button>
    </div>
  );
}
