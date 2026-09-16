import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Field, PinInput, TopBar, useToast } from '../../components/ui';

export default function SignUp() {
  const navigate = useNavigate();
  const { signUpParent } = useApp();
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) return toast('Pick a 4-digit PIN.');
    if (pin !== confirm) return toast('Those PINs do not match.');

    setBusy(true);
    try {
      await signUpParent({ name, email, pin });
      navigate('/p', { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create that account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <TopBar title="Set up your account" onBack={() => navigate('/welcome')} />

      <form className="stack" onSubmit={submit}>
        <div className="card stack">
          <Field
            label="What does your child call you?"
            hint="This is the name they will see and hear. Dad, Mum, Papa, Nana — whatever they actually say."
          >
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dad"
              autoComplete="name"
              required
            />
          </Field>

          <Field label="Email" hint="Used to sign back in on this device.">
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </Field>
        </div>

        <div className="card stack">
          <Field label="Grown-up PIN" hint="Keeps the settings and your voice out of small hands.">
            <PinInput value={pin} onChange={setPin} />
          </Field>
          <Field label="Confirm PIN">
            <PinInput value={confirm} onChange={setConfirm} />
          </Field>
        </div>

        <button className="btn btn--block btn--lg" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>

        <p className="muted" style={{ textAlign: 'center' }}>
          Everything stays on this device unless you connect a server in Settings.
        </p>
      </form>
    </div>
  );
}
