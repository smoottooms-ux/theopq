import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { useCloud } from '../../lib/useCloud';
import { Field, TopBar, useToast } from '../../components/ui';
import { requestPermission, scheduleNightly } from '../../lib/notifications';
import { audioStore } from '../../lib/storage';
import { HAS_HOSTED_BACKEND, SUPPORT_EMAIL } from '../../lib/config';

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { data, parent, setSettings, signOut, update } = useApp();
  const { account, connected } = useCloud();
  const toast = useToast();

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
      d.lullabies = [];
      d.replies = [];
      d.sessions = [];
      d.cards = [];
      d.journal = [];
    });
    toast('Local copies cleared. Anything synced is still in your account.');
  };

  return (
    <div className="screen">
      <TopBar title="Settings" onBack={() => navigate('/p')} />

      <div className="section-label">Your account</div>
      <button
        className="card"
        onClick={() => navigate(connected ? '/p/plan' : '/p/account')}
        style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
      >
        <div className="row">
          <div className="avatar" aria-hidden>{connected ? '✅' : '☁️'}</div>
          <div style={{ flex: 1 }}>
            <h3>{account?.entitlement.planLabel ?? (connected ? 'Your plan' : 'Sign in')}</h3>
            <p className="muted">
              {account
                ? `${account.entitlement.stories.limit - account.entitlement.stories.used} stories left this period`
                : connected
                  ? 'Tap to see your plan'
                  : 'Sign in to send stories to another device'}
            </p>
          </div>
        </div>
      </button>

      <div className="section-label">Nightly routine</div>
      <div className="card stack">
        <Row
          title="Auto-pilot"
          body="Sends something every night on its own, rotating through the library, so you never have to remember."
          checked={data.settings.autoPilot}
          onToggle={() => setSettings({ autoPilot: !data.settings.autoPilot })}
        />
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

      {!HAS_HOSTED_BACKEND && (
        <>
          <div className="section-label">Self-hosted</div>
          <div className="card stack">
            <Field
              label="Server address"
              hint="This build has no server baked in, so point it at your own."
            >
              <input
                className="input"
                value={data.settings.serverUrl ?? ''}
                onChange={(e) => setSettings({ serverUrl: e.target.value.trim() || undefined })}
                placeholder="https://…"
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="url"
              />
            </Field>
          </div>
        </>
      )}

      <div className="section-label">This device</div>
      <div className="card stack">
        <p className="soft">
          Signed in as <strong>{parent?.name}</strong> ({parent?.email})
        </p>
        <button
          className="btn btn--soft btn--block"
          onClick={() => void signOut().then(() => navigate('/welcome'))}
        >
          Sign out
        </button>
        <button className="btn btn--ghost btn--block btn--sm" onClick={wipe}>
          Clear downloaded copies
        </button>
      </div>

      <div className="section-label">Help</div>
      <div className="card">
        <p className="soft">
          Something wrong? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and tell us
          what happened.
        </p>
      </div>

      <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
        Your voice recordings are used to build your narration voice and nothing else. We never sell
        them, never train on them, and delete them the moment you remove your voice.
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
