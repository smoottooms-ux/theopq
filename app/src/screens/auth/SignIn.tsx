import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Field, PinInput, TopBar, useToast } from '../../components/ui';

export default function SignIn() {
  const navigate = useNavigate();
  const { signInParent, data } = useApp();
  const toast = useToast();

  const [email, setEmail] = useState(data.parents[0]?.email ?? '');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signInParent(email, pin);
      navigate('/p', { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not sign in.');
      setPin('');
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
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field label="PIN">
          <PinInput value={pin} onChange={setPin} autoFocus />
        </Field>
        <button className="btn btn--block" disabled={busy || pin.length !== 4}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>

      <button
        className="btn btn--ghost btn--block btn--sm"
        style={{ marginTop: 12 }}
        onClick={() => navigate('/signup')}
      >
        Create a different account
      </button>
    </div>
  );
}
