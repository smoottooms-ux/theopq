import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { useCloud } from '../../lib/useCloud';
import { Field, PinInput, TopBar, useToast } from '../../components/ui';
import { checkServer, cloudChildSignIn } from '../../lib/cloud';

/**
 * Pairing a child's own device.
 *
 * Written for a seven-year-old typing with a grown-up watching over their
 * shoulder once, then never again.
 */
export default function PairDevice() {
  const navigate = useNavigate();
  const { update, setSettings, signInChild } = useApp();
  const { connect } = useCloud();
  const toast = useToast();

  const [serverUrl, setServerUrl] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [childName, setChildName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const pair = async () => {
    setBusy(true);
    try {
      if (!(await checkServer(serverUrl))) throw new Error('Cannot reach that address.');

      const { session, child } = await cloudChildSignIn(serverUrl, joinCode.toUpperCase(), childName, pin);
      connect(session);
      setSettings({ serverUrl: session.serverUrl });

      // Keep a local copy so the child screen works with no signal.
      update((d) => {
        const withPin = { ...child, pin };
        const i = d.children.findIndex((c) => c.id === child.id);
        if (i >= 0) d.children[i] = withPin;
        else d.children.push(withPin);
        if (!d.family) {
          d.family = {
            id: child.familyId,
            name: 'Our family',
            joinCode: joinCode.toUpperCase(),
            createdAt: Date.now(),
          };
        }
      });

      await signInChild(child.id, pin);
      navigate('/c', { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen" data-skin="kid">
      <TopBar title="Connect this tablet" onBack={() => navigate('/welcome')} />

      <div className="card">
        <p className="soft">
          Ask your grown-up for the family code from their phone. You only have to do this once.
        </p>
      </div>

      <div className="card stack">
        <Field label="Server address" hint="Your grown-up has this too.">
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

        <Field label="Family code">
          <input
            className="input"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="ABC123"
            autoCapitalize="characters"
            autoCorrect="off"
            style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: 24 }}
          />
        </Field>

        <Field label="Your name">
          <input
            className="input"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="Maya"
          />
        </Field>

        <Field label="Your secret number">
          <PinInput value={pin} onChange={setPin} />
        </Field>

        <button
          className="btn btn--block btn--lg"
          onClick={pair}
          disabled={busy || joinCode.length !== 6 || !childName.trim() || pin.length !== 4}
        >
          {busy ? 'Connecting…' : "Let's go"}
        </button>
      </div>
    </div>
  );
}
