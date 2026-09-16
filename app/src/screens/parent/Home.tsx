import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { useCloud } from '../../lib/useCloud';
import { describeSchedule, nextBedtime } from '../../lib/delivery';
import { voiceDescription } from '../../lib/voice';
import { TopBar, Empty } from '../../components/ui';
import { IconGear, IconMic, IconPlus, IconSpark } from '../../components/Icons';
import { Coach } from '../../components/Coach';
import { planTonight, buildAutoStory } from '../../lib/autopilot';
import { voiceProgress, VOICE_TARGET } from '../../lib/playback';
import type { Child, Story } from '../../types';

export default function ParentHome() {
  const navigate = useNavigate();
  const { data, parent, addStory } = useApp();
  const { account, connected } = useCloud({ autoSync: true });
  const progress = useMemo(() => voiceProgress(data, parent?.id), [data, parent?.id]);

  // Auto-pilot fills tonight's gap the moment the app opens, so a parent who
  // never comes back still has something waiting for their child at bedtime.
  const pending = useMemo(() => planTonight(data, parent), [data, parent]);
  useEffect(() => {
    if (!parent || pending.length === 0) return;
    for (const pick of pending) addStory(buildAutoStory(parent, pick.child, pick.item));
  }, [parent, pending, addStory]);

  const voice = useMemo(
    () => data.voices.find((v) => v.parentId === parent?.id),
    [data.voices, parent?.id],
  );

  const unheardReplies = data.replies.filter((r) => !r.heardAt);
  const trialTrouble =
    account && (account.entitlement.status !== 'active' || account.entitlement.plan === 'trial');

  return (
    <div className="screen">
      <TopBar
        title={`Evening, ${parent?.name ?? ''}`}
        subtitle={new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
        right={
          <button className="iconbtn" onClick={() => navigate('/p/settings')} aria-label="Settings">
            <IconGear />
          </button>
        }
      />

      {!connected && (
        <button
          className="card"
          onClick={() => navigate('/p/account')}
          style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
        >
          <div className="row">
            <div className="avatar" aria-hidden>☁️</div>
            <div style={{ flex: 1 }}>
              <h3>Finish setting up</h3>
              <p className="muted">
                Sign in so your stories reach their device — and so your voice can be built.
              </p>
            </div>
          </div>
        </button>
      )}

      {trialTrouble && (
        <button
          className="card"
          onClick={() => navigate('/p/plan')}
          style={{
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            borderColor: account!.entitlement.status === 'active' ? 'var(--line)' : 'var(--warn)',
          }}
        >
          <div className="row">
            <div className="avatar" aria-hidden>
              {account!.entitlement.status === 'active' ? '🎁' : '⚠️'}
            </div>
            <div style={{ flex: 1 }}>
              <h3>
                {account!.entitlement.status === 'active'
                  ? `${account!.entitlement.stories.limit - account!.entitlement.stories.used} trial stories left`
                  : 'Your trial has ended'}
              </h3>
              <p className="muted">
                {account!.entitlement.status === 'active'
                  ? 'Pick a plan whenever you are ready — nothing stops tonight.'
                  : 'Pick a plan to keep sending stories.'}
              </p>
            </div>
          </div>
        </button>
      )}

      <Coach
        when={data.children.length === 0}
        title="Start here: add your child"
        action={
          <button className="btn btn--sm" onClick={() => navigate('/p/family')}>
            <IconPlus size={16} /> Add a child
          </button>
        }
      >
        Nothing can be sent until there is someone to send it to. Takes about thirty seconds.
      </Coach>

      <Coach
        when={data.children.length > 0 && progress.recorded === 0}
        title={`Next: record ${VOICE_TARGET} short songs`}
        action={
          <button className="btn btn--sm" onClick={() => navigate('/p/record')}>
            <IconMic size={16} /> Show me the list
          </button>
        }
      >
        Most are under a minute. After that, every story and song reads itself in your voice and
        you never have to record again.
      </Coach>

      <Coach
        when={progress.recorded > 0 && progress.recorded < VOICE_TARGET}
        title={`${progress.remaining} recordings to go`}
        action={
          <button className="btn btn--sm" onClick={() => navigate('/p/record')}>
            Carry on
          </button>
        }
      >
        You are {progress.recorded} of {VOICE_TARGET} through. Each one is under a minute, and your
        child can already hear the ones you have done.
      </Coach>

      {connected && voice?.status !== 'ready' && (
        <button
          className="card"
          onClick={() => navigate('/p/voice')}
          style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
        >
          <div className="row">
            <div className="avatar" style={{ color: 'var(--accent)' }} aria-hidden>
              <IconMic />
            </div>
            <div style={{ flex: 1 }}>
              <h3>Teach the app your voice</h3>
              <p className="muted">
                {voice?.status === 'processing'
                  ? 'Still processing your samples…'
                  : 'About four minutes. Then every story sounds like you.'}
              </p>
            </div>
          </div>
        </button>
      )}

      {unheardReplies.length > 0 && (
        <button
          className="card"
          onClick={() => navigate('/p/library')}
          style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
        >
          <div className="row">
            <div className="avatar" aria-hidden>💌</div>
            <div style={{ flex: 1 }}>
              <h3>
                {unheardReplies.length} message{unheardReplies.length > 1 ? 's' : ''} from your
                {unheardReplies.length > 1 ? ' kids' : ' kid'}
              </h3>
              <p className="muted">They recorded something back. Go listen.</p>
            </div>
          </div>
        </button>
      )}

      <div className="section-label">Tonight</div>

      {data.children.length === 0 ? (
        <Empty
          emoji="👶"
          title="Add your first child"
          body="You need a profile for each kid before you can send anything."
          action={
            <button className="btn" onClick={() => navigate('/p/family')}>
              <IconPlus size={18} /> Add a child
            </button>
          }
        />
      ) : (
        <div className="stack">
          {data.children.map((kid) => (
            <TonightCard
              key={kid.id}
              child={kid}
              story={tonightFor(data.stories, kid)}
              onCreate={() => navigate(`/p/story?child=${kid.id}`)}
            />
          ))}
        </div>
      )}

      <button
        className="btn btn--block btn--lg"
        style={{ marginTop: 18 }}
        onClick={() => navigate('/p/story')}
      >
        <IconSpark size={20} /> Make tonight's story
      </button>

      <div className="section-label">Also here</div>
      <div className="stack">
        <QuickLink
          emoji="🎙️"
          title="Record your voice"
          body={
            progress.ready
              ? 'Done — everything reads itself in your voice now.'
              : `${progress.recorded} of ${VOICE_TARGET} short recordings done.`
          }
          onClick={() => navigate('/p/record')}
        />
        <QuickLink
          emoji="🎵"
          title="Lullabies"
          body="Short, soft, on repeat. With sleep sounds and a fade-out timer."
          onClick={() => navigate('/p/lullabies')}
        />
        <QuickLink
          emoji="📔"
          title="Archive"
          body="Every night, week by week, kept forever."
          onClick={() => navigate('/p/journal')}
        />
        <QuickLink
          emoji="📚"
          title="Everything you've sent"
          body="Play it back, see what they listened to twice."
          onClick={() => navigate('/p/library')}
        />
      </div>
    </div>
  );
}

function QuickLink({
  emoji,
  title,
  body,
  onClick,
}: {
  emoji: string;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      className="card"
      onClick={onClick}
      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginTop: 0 }}
    >
      <div className="row">
        <div className="avatar" aria-hidden>{emoji}</div>
        <div style={{ flex: 1 }}>
          <h3>{title}</h3>
          <p className="muted">{body}</p>
        </div>
      </div>
    </button>
  );
}

function tonightFor(stories: Story[], child: Child): Story | undefined {
  const bedtime = nextBedtime(child);
  const windowStart = bedtime - 20 * 3600_000;
  return stories
    .filter(
      (s) =>
        s.toChildId === child.id &&
        s.scheduledFor >= windowStart &&
        s.scheduledFor <= bedtime + 3600_000 &&
        s.status !== 'draft',
    )
    .sort((a, b) => b.scheduledFor - a.scheduledFor)[0];
}

function TonightCard({
  child,
  story,
  onCreate,
}: {
  child: Child;
  story?: Story;
  onCreate: () => void;
}) {
  return (
    <div className="card">
      <div className="card__head">
        <div className="avatar" aria-hidden>{child.avatar}</div>
        <div style={{ flex: 1 }}>
          <h3>{child.name}</h3>
          <div className="muted">Bedtime {child.bedtime}</div>
        </div>
        {story ? (
          <span className={`badge ${story.status === 'played' ? 'badge--good' : 'badge--accent'}`}>
            {story.status === 'played' ? 'Listened' : 'Queued'}
          </span>
        ) : (
          <span className="badge badge--warn">Nothing yet</span>
        )}
      </div>

      {story ? (
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>{story.title}</p>
          <p className="muted" style={{ marginTop: 4 }}>
            {voiceDescription(story.voiceProvider, story.fromParentName)} ·{' '}
            {describeSchedule(story.scheduledFor)}
          </p>
          {story.status === 'played' && story.playCount > 1 && (
            <p className="muted" style={{ marginTop: 4 }}>
              Played {story.playCount} times. They liked this one.
            </p>
          )}
        </div>
      ) : (
        <button className="btn btn--soft btn--block btn--sm" onClick={onCreate}>
          Send {child.name} a story
        </button>
      )}
    </div>
  );
}
