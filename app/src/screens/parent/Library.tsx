import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Empty, TopBar, useToast } from '../../components/ui';
import { IconPlay, IconTrash } from '../../components/Icons';
import { audioStore, audioUrl } from '../../lib/storage';
import { formatDuration } from '../../lib/audio';
import { voiceDescription } from '../../lib/voice';
import { describeSchedule } from '../../lib/delivery';
import type { ChildReply, Story } from '../../types';

export default function ParentLibrary() {
  const navigate = useNavigate();
  const { data, update } = useApp();
  const [tab, setTab] = useState<'sent' | 'replies'>('sent');

  const stories = data.stories.filter((s) => s.status !== 'draft');
  const replies = data.replies;

  return (
    <div className="screen">
      <TopBar title="Library" onBack={() => navigate('/p')} />

      <div className="chips" style={{ marginBottom: 16 }}>
        <button className="chip" aria-pressed={tab === 'sent'} onClick={() => setTab('sent')}>
          Sent ({stories.length})
        </button>
        <button className="chip" aria-pressed={tab === 'replies'} onClick={() => setTab('replies')}>
          From the kids ({replies.length})
        </button>
      </div>

      {tab === 'sent' ? (
        stories.length === 0 ? (
          <Empty
            emoji="📮"
            title="Nothing sent yet"
            body="Make one tonight. It takes about a minute."
            action={<button className="btn" onClick={() => navigate('/p/story')}>Make a story</button>}
          />
        ) : (
          <div className="stack">
            {stories.map((story) => (
              <StoryRow
                key={story.id}
                story={story}
                childName={data.children.find((c) => c.id === story.toChildId)?.name ?? 'your child'}
                onDelete={() => {
                  if (story.audioKey) void audioStore.remove(story.audioKey);
                  update((d) => {
                    d.stories = d.stories.filter((s) => s.id !== story.id);
                  });
                }}
              />
            ))}
          </div>
        )
      ) : replies.length === 0 ? (
        <Empty
          emoji="💌"
          title="No messages back yet"
          body="After a story, your child can hold a button and talk back to you. It lands here."
        />
      ) : (
        <div className="stack">
          {replies.map((reply) => (
            <ReplyRow
              key={reply.id}
              reply={reply}
              storyTitle={data.stories.find((s) => s.id === reply.storyId)?.title}
              onHeard={() =>
                update((d) => {
                  const i = d.replies.findIndex((r) => r.id === reply.id);
                  if (i >= 0) d.replies[i] = { ...d.replies[i], heardAt: Date.now() };
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StoryRow({
  story,
  childName,
  onDelete,
}: {
  story: Story;
  childName: string;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (story.audioKey) void audioUrl(story.audioKey).then(setUrl);
  }, [story.audioKey]);

  return (
    <div className="card">
      <div className="card__head">
        <div style={{ flex: 1 }}>
          <h3>{story.title}</h3>
          <p className="muted">
            For {childName} · {describeSchedule(story.scheduledFor)}
          </p>
        </div>
        <span
          className={`badge ${
            story.status === 'played' ? 'badge--good' : story.status === 'failed' ? 'badge--bad' : ''
          }`}
        >
          {story.status === 'played' ? `Played ×${story.playCount}` : story.status}
        </span>
      </div>

      <p className="muted">
        {voiceDescription(story.voiceProvider, story.fromParentName)} ·{' '}
        {formatDuration(story.durationEstimate)}
      </p>

      {story.failureReason && (
        <p className="muted" style={{ color: 'var(--warn)', marginTop: 6 }}>
          ⚠ {story.failureReason}
        </p>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        {url ? (
          <button
            className="btn btn--soft btn--sm"
            style={{ flex: 1 }}
            onClick={() => {
              const audio = new Audio(url);
              void audio.play().catch(() => toast('Could not play that.'));
            }}
          >
            <IconPlay size={16} /> Listen
          </button>
        ) : (
          <span className="muted" style={{ flex: 1 }}>
            {story.voiceProvider === 'device' ? 'Read aloud on their device' : 'No audio saved'}
          </span>
        )}
        <button className="iconbtn" onClick={onDelete} aria-label="Delete story">
          <IconTrash size={18} />
        </button>
      </div>
    </div>
  );
}

function ReplyRow({
  reply,
  storyTitle,
  onHeard,
}: {
  reply: ChildReply;
  storyTitle?: string;
  onHeard: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    void audioUrl(reply.audioKey).then(setUrl);
  }, [reply.audioKey]);

  return (
    <div className="card" style={{ borderColor: reply.heardAt ? 'var(--line)' : 'var(--accent)' }}>
      <div className="card__head">
        <div className="avatar" aria-hidden>💌</div>
        <div style={{ flex: 1 }}>
          <h3>{reply.childName}</h3>
          <p className="muted">
            {new Date(reply.createdAt).toLocaleString([], {
              weekday: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
            {storyTitle ? ` · after "${storyTitle}"` : ''}
          </p>
        </div>
        {!reply.heardAt && <span className="badge badge--accent">New</span>}
      </div>

      <button
        className="btn btn--block"
        disabled={!url}
        onClick={() => {
          if (!url) return;
          void new Audio(url).play().catch(() => undefined);
          onHeard();
        }}
      >
        <IconPlay size={18} /> Play ({formatDuration(reply.duration)})
      </button>
    </div>
  );
}
