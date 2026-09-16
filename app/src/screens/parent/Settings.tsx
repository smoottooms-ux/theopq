import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Field, TopBar, useToast } from '../../components/ui';
import { requestPermission, scheduleNightly } from '../../lib/notifications';
import { audioStore } from '../../lib/storage';

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { data, parent, setSettings, signOut, update } = useApp();
  const toast = useToast();

  const [elevenKey, setElevenKey] = useState(data.settings.elevenLabsKey ?? '');
  const [anthropicKey, setAnthropicKey] = useState(data.settings.anthropicKey ?? '');

  const saveKeys = () => {
    setSettings({
      elevenLabsKey: elevenKey.trim() || undefined,
      anthropicKey: anthropicKey.trim() || undefined,
    });
    toast('Keys saved on this device.');
  };

  const toggleNotifications = async () => {
    const next = !data.settings.notificationsEnabled;
    if (next) {
      const granted = await requestPermission();
      if (!granted) return toast('Your device refused notification permission.');
      for (const kid of data.children) {
        await scheduleNightly(kid, parent?.name ?? 'your grown-up').catch(() => undefined);
      }
    }
    setSettings({ notificationsEnabled: next });
  };

  const wipe = async () => {
    const keys = await audioStore.keys();
    await Promise.all(keys.map((k) => audioStore.remove(String(k))));
    update((d) => {
      d.stories = [];
      d.replies = [];
      d.sessions = [];
      d.cards = [];
    });
    toast('Stories, replies and progress cleared.');
  };

  return (
    <div className="screen">
      <TopBar title="Settings" onBack={() => navigate('/p')} />

      <div className="section-label">Voice cloning</div>
      <div className="card stack">
        <Field
          label="ElevenLabs API key"
          hint="Required for cloning. Stored on this device only and sent only to elevenlabs.io."
        >
          <input
            className="input"
            type="password"
            value={elevenKey}
            onChange={(e) => setElevenKey(e.target.value)}
            placeholder="sk_…"
            autoComplete="off"
          />
        </Field>
        <p className="muted">
          Voice cloning needs a paid ElevenLabs plan. Without a key the app still works — stories
          are read by the device narrator, or by you, recorded live.
        </p>
      </div>

      <div className="section-label">Story writing</div>
      <div className="card stack">
        <Field
          label="Anthropic API key (optional)"
          hint="Turns on stories written fresh for each child instead of the built-in engine."
        >
          <input
            className="input"
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
          />
        </Field>
        <button className="btn btn--block" onClick={saveKeys}>Save keys</button>
      </div>

      <div className="section-label">Nightly routine</div>
      <div className="card stack">
        <Row
          title="Bedtime notification"
          body="Fires on each child's device at their bedtime."
          checked={data.settings.notificationsEnabled}
          onToggle={toggleNotifications}
        />
        <Row
          title="Story before games"
          body="Games stay locked until tonight's story has been played."
          checked={data.settings.storyBeforeGames}
          onToggle={() => setSettings({ storyBeforeGames: !data.settings.storyBeforeGames })}
        />
        <Field label="Daily game limit" hint="Minutes per day. Set 0 for no limit.">
          <input
            className="input"
            type="number"
            min={0}
            max={180}
            value={data.settings.dailyGameMinutes}
            onChange={(e) => setSettings({ dailyGameMinutes: Number(e.target.value) })}
          />
        </Field>
      </div>

      <div className="section-label">Across devices</div>
      <button
        className="card"
        onClick={() => navigate('/p/sync')}
        style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
      >
        <div className="row">
          <div className="avatar" aria-hidden>🔗</div>
          <div style={{ flex: 1 }}>
            <h3>Sync</h3>
            <p className="muted">
              {data.settings.serverUrl
                ? data.settings.serverUrl
                : "Off — stories only reach a child on this same device."}
            </p>
          </div>
        </div>
      </button>

      <div className="section-label">Account</div>
      <div className="card stack">
        <p className="soft">
          Signed in as <strong>{parent?.name}</strong> ({parent?.email})
        </p>
        <button className="btn btn--soft btn--block" onClick={() => void signOut().then(() => navigate('/welcome'))}>
          Sign out
        </button>
        <button className="btn btn--ghost btn--block btn--sm" onClick={wipe}>
          Clear all stories and progress
        </button>
      </div>

      <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
        Nightshift keeps everything on this device by default. Nothing is uploaded except the audio
        you explicitly send to your cloning provider.
      </p>
    </div>
  );
}

function Row({
  title,
  body,
  checked,
  onToggle,
}: {
  title: string;
  body: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="row" style={{ alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: 15 }}>{title}</h3>
        <p className="muted">{body}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ width: 24, height: 24, flex: 'none', marginTop: 2 }}
      />
    </label>
  );
}
