import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { PinInput, Sheet, TopBar, useToast } from '../../components/ui';
import type { Child } from '../../types';

export default function KidPicker() {
  const navigate = useNavigate();
  const { data, signInChild } = useApp();
  const toast = useToast();

  const [selected, setSelected] = useState<Child | null>(null);
  const [pin, setPin] = useState('');

  const submit = async () => {
    if (!selected) return;
    try {
      await signInChild(selected.id, pin);
      navigate('/c', { replace: true });
    } catch {
      toast('That is not the right code. Try again!');
      setPin('');
    }
  };

  return (
    <div className="screen" data-skin="kid">
      <TopBar title="Who's here?" onBack={() => navigate('/welcome')} />

      <div className="grid2">
        {data.children.map((kid) => (
          <button
            key={kid.id}
            className="card"
            style={{ textAlign: 'center', cursor: 'pointer', border: '1px solid var(--line)' }}
            onClick={() => {
              setSelected(kid);
              setPin('');
            }}
          >
            <div className="avatar avatar--lg" style={{ margin: '0 auto 10px' }} aria-hidden>
              {kid.avatar}
            </div>
            <h3>{kid.name}</h3>
          </button>
        ))}
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={`Hi ${selected?.name ?? ''}!`}>
        <div className="stack">
          <p className="soft">Type your secret number.</p>
          <PinInput value={pin} onChange={setPin} autoFocus />
          <button className="btn btn--block btn--lg" onClick={submit} disabled={pin.length !== 4}>
            Let me in
          </button>
        </div>
      </Sheet>
    </div>
  );
}
