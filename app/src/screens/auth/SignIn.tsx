import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Field, PasswordInput, TopBar, useToast } from '../../components/ui';

export default function SignIn() {
  const navigate = useNavigate();
  const { signInParent, data } = useApp();
  const toast = useToast();

  const [email, setEmail] = useState(data.parents[0]?.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const parent = await signInParent(email, password);
      // An account from before passwords existed gets in once, then has to
      // choose a real one rather than being left on four digits forever.
      navigate(parent.password ? '/p' : '/set-password', { replace: true });
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
