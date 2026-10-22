import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { useCloud } from '../../lib/useCloud';
import { Field, PinInput, TopBar, useToast } from '../../components/ui';
import { cloudChildSignIn, defaultServerUrl } from '../../lib/cloud';
import { HAS_HOSTED_BACKEND } from '../../lib/config';

/**
 * Pairing a child's own device.
 *
 * Written for a seven-year-old typing with a grown-up watching over their
 * shoulder once, then never again.
 */
export default function PairDevice() {
  const navigate = useNavigate();
  const { update, signInChild } = useApp();
  const { connect } = useCloud();
  const toast = useToast();

  const [joinCode, setJoinCode] = useState('');
  const [childName, setChildName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const pair = async () => {
    setBusy(true);
    try {
      const { session, child } = await cloudChildSignIn(
        defaultServerUrl(),
        joinCode.toUpperCase(),
        childName,
        pin,
      );
      connect(session);

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

  /*
   * Pairing a second device needs the account server to carry stories between
   * them. With no server there is nothing to pair against, and the old screen
   * failed by asking a child for a URL. Children are not locked out: a profile
   * on the grown-up's own phone is how this build works, and that is what it
   * now says.
   */
  if (!HAS_HOSTED_BACKEND) {
    return (
      <div className="screen" data-skin="kid">
        <TopBar title="Connect this tablet" onBack={() => navigate('/welcome')} />

        <div className="card">
          <div className="avatar avatar--lg" style={{ margin: '0 auto 12px' }} aria-hidden>
            📱
          </div>
          <h2 style={{ textAlign: 'center' }}>Use your grown-up's phone</h2>
          <p className="soft" style={{ marginTop: 10 }}>
            This Story Station keeps everything on one phone, so there is nothing for a
            second tablet to connect to yet.
          </p>
          <p className="soft" style={{ marginTop: 10 }}>
            Open Story Station on your grown-up's phone and tap your own name. Your stories,
            your books and your games are all in there waiting.
          </p>
        </div>

        <button
          className="btn btn--block btn--lg"
          style={{ marginTop: 16 }}
          onClick={() => navigate('/welcome')}
        >
          OK
        </button>
      </div>
    );
  }

  return (
    <div className="screen" data-skin="kid">
      <TopBar title="Connect this tablet" onBack={() => navigate('/welcome')} />

      <div className="card">
        <p className="soft">
          Ask your grown-up for the family code from their phone. You only have to do this once.
        </p>
      </div>

      <div className="card stack">
        {/*
          This asked a seven-year-old to type a server URL. Third copy of that
          box in the app, and by far the worst place for it.
        */}
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
