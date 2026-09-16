import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import {
  ChipGroup,
  Field,
  MultiChipGroup,
  PinInput,
  Sheet,
  TopBar,
  useToast,
} from '../../components/ui';
import { IconPlus, IconTrash } from '../../components/Icons';
import { cancelNightly, requestPermission, scheduleNightly } from '../../lib/notifications';
import type { Child, ReadingLevel } from '../../types';

const AVATARS = ['🦊', '🐻', '🐼', '🦁', '🐸', '🦉', '🐙', '🦕', '🐢', '🐝', '🦄', '🐧'];

const INTERESTS = [
  'dinosaurs', 'space', 'football', 'horses', 'trucks', 'dragons', 'baking',
  'painting', 'swimming', 'robots', 'pirates', 'cats', 'dogs', 'music', 'bugs',
];

const LEVELS: { value: ReadingLevel; label: string }[] = [
  { value: 'pre-reader', label: 'Not reading yet' },
  { value: 'early', label: 'Just starting' },
  { value: 'growing', label: 'Getting there' },
  { value: 'confident', label: 'Reads on their own' },
];

export default function FamilyScreen() {
  const navigate = useNavigate();
  const { data, parent, addChild, update } = useApp();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);

  const [name, setName] = useState('');
  const [age, setAge] = useState(6);
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [pin, setPin] = useState('');
  const [level, setLevel] = useState<ReadingLevel>('early');
  const [interests, setInterests] = useState<string[]>([]);
  const [bedtime, setBedtime] = useState('19:30');
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);

  const startNew = () => {
    setEditing(null);
    setName('');
    setAge(6);
    setAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
    setPin('');
    setLevel('early');
    setInterests([]);
    setBedtime('19:30');
    setDifficulty(2);
    setOpen(true);
  };

  const startEdit = (kid: Child) => {
    setEditing(kid);
    setName(kid.name);
    setAge(kid.age);
    setAvatar(kid.avatar);
    setPin(kid.pin);
    setLevel(kid.readingLevel);
    setInterests(kid.interests);
    setBedtime(kid.bedtime);
    setDifficulty(kid.gameDifficulty);
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) return toast('They need a name.');
    if (pin.length !== 4) return toast('Give them a 4-digit code they can remember.');

    const fields = {
      name: name.trim(),
      age,
      avatar,
      pin,
      readingLevel: level,
      interests,
      bedtime,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      gameDifficulty: difficulty,
    };

    let saved: Child;
    if (editing) {
      saved = { ...editing, ...fields };
      update((d) => {
        const i = d.children.findIndex((c) => c.id === editing.id);
        if (i >= 0) d.children[i] = saved;
      });
    } else {
      saved = addChild(fields);
    }

    setOpen(false);
    if (data.settings.notificationsEnabled) {
      await requestPermission();
      await scheduleNightly(saved, parent?.name ?? 'your grown-up').catch(() => undefined);
    }
    toast(`${saved.name} saved. Bedtime reminder set for ${saved.bedtime}.`);
  };

  const remove = async (kid: Child) => {
    await cancelNightly(kid).catch(() => undefined);
    update((d) => {
      d.children = d.children.filter((c) => c.id !== kid.id);
      d.stories = d.stories.filter((s) => s.toChildId !== kid.id);
    });
    setOpen(false);
    toast(`${kid.name} removed.`);
  };

  return (
    <div className="screen">
      <TopBar
        title="Family"
        subtitle={data.family ? `Join code ${data.family.joinCode}` : undefined}
        onBack={() => navigate('/p')}
        right={
          <button className="iconbtn" onClick={startNew} aria-label="Add a child">
            <IconPlus />
          </button>
        }
      />

      <div className="stack">
        {data.children.map((kid) => (
          <button
            key={kid.id}
            className="card"
            onClick={() => startEdit(kid)}
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginTop: 0 }}
          >
            <div className="row">
              <div className="avatar avatar--lg" aria-hidden>{kid.avatar}</div>
              <div style={{ flex: 1 }}>
                <h3>{kid.name}</h3>
                <p className="muted">
                  {kid.age} · {LEVELS.find((l) => l.value === kid.readingLevel)?.label} · bedtime{' '}
                  {kid.bedtime}
                </p>
                {kid.interests.length > 0 && (
                  <p className="muted" style={{ marginTop: 2 }}>
                    Loves {kid.interests.slice(0, 3).join(', ')}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}

        {data.children.length === 0 && (
          <button className="btn btn--block btn--lg" onClick={startNew}>
            <IconPlus size={20} /> Add your first child
          </button>
        )}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.name}` : 'Add a child'}>
        <div className="stack">
          <Field label="Name">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maya"
            />
          </Field>

          <Field label="Pick their character">
            <div className="chips">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  className="chip"
                  aria-pressed={avatar === a}
                  onClick={() => setAvatar(a)}
                  style={{ fontSize: 22 }}
                >
                  {a}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Age">
            <input
              className="input"
              type="number"
              min={2}
              max={14}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
            />
          </Field>

          <Field label="Reading level" hint="Sets sentence length and which words the games drill.">
            <ChipGroup value={level} onChange={setLevel} options={LEVELS} />
          </Field>

          <Field label="What are they into?" hint="Used to steer stories. Pick up to five.">
            <MultiChipGroup options={INTERESTS} value={interests} onChange={setInterests} max={5} />
          </Field>

          <Field label="Bedtime" hint="The nightly story notification fires at this time.">
            <input
              className="input"
              type="time"
              value={bedtime}
              onChange={(e) => setBedtime(e.target.value)}
            />
          </Field>

          <Field label="Game difficulty">
            <ChipGroup
              value={String(difficulty) as '1' | '2' | '3'}
              onChange={(v) => setDifficulty(Number(v) as 1 | 2 | 3)}
              options={[
                { value: '1', label: 'Easier' },
                { value: '2', label: 'Just right' },
                { value: '3', label: 'Push them' },
              ]}
            />
          </Field>

          <Field label="Their secret code" hint="Four digits they can remember. Not your PIN.">
            <PinInput value={pin} onChange={setPin} />
          </Field>

          <button className="btn btn--block btn--lg" onClick={save}>
            {editing ? 'Save changes' : 'Add child'}
          </button>

          {editing && (
            <button className="btn btn--ghost btn--block btn--sm" onClick={() => remove(editing)}>
              <IconTrash size={16} /> Remove {editing.name}
            </button>
          )}
        </div>
      </Sheet>
    </div>
  );
}
