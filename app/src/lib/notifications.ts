import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Child, Story } from '../types';

/**
 * Bedtime notifications.
 *
 * On a phone these are real scheduled local notifications that fire whether or
 * not the app is open. On the web we degrade to the Notification API while the
 * tab is alive — enough to demo, and the UI says as much.
 */

const CHANNEL = 'bedtime';

export function notificationsSupported(): boolean {
  return Capacitor.isNativePlatform() || typeof Notification !== 'undefined';
}

export async function requestPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const status = await LocalNotifications.requestPermissions();
    if (status.display === 'granted') {
      await LocalNotifications.createChannel({
        id: CHANNEL,
        name: 'Bedtime story',
        description: "The nightly story from your grown-up",
        importance: 4,
        visibility: 1,
        sound: undefined,
      }).catch(() => undefined);
      return true;
    }
    return false;
  }

  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

/** Stable per-child id so rescheduling replaces rather than stacks. */
function notificationId(childId: string): number {
  let h = 0;
  for (let i = 0; i < childId.length; i++) h = (h * 31 + childId.charCodeAt(i)) >>> 0;
  return (h % 100000) + 1000;
}

/**
 * Schedules the nightly "a story is waiting" alert at the child's bedtime.
 * Repeats daily; call again whenever the bedtime changes.
 */
export async function scheduleNightly(child: Child, parentName: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const [hour, minute] = child.bedtime.split(':').map(Number);
  const noteId = notificationId(child.id);

  await LocalNotifications.cancel({ notifications: [{ id: noteId }] }).catch(() => undefined);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: noteId,
        channelId: CHANNEL,
        title: `A story from ${parentName} 🌙`,
        body: `${child.name}, tonight's story is ready. Tap to listen.`,
        schedule: { on: { hour, minute }, allowWhileIdle: true },
        extra: { childId: child.id, kind: 'bedtime' },
      },
    ],
  });
}

export async function cancelNightly(child: Child): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({
    notifications: [{ id: notificationId(child.id) }],
  }).catch(() => undefined);
}

/** Fires immediately — used when a parent sends a story outside the schedule. */
export async function notifyStoryReady(story: Story, childName: string): Promise<void> {
  const title = `${story.fromParentName} sent you something 💌`;
  const body = `${childName}, "${story.title}" is waiting for you.`;

  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 100000) + 200000,
          channelId: CHANNEL,
          title,
          body,
          schedule: { at: new Date(Date.now() + 1000) },
          extra: { storyId: story.id, kind: 'story' },
        },
      ],
    }).catch(() => undefined);
    return;
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

/** Lets the app open straight to a story when a notification is tapped. */
export function onNotificationTap(handler: (extra: Record<string, unknown>) => void): void {
  if (!Capacitor.isNativePlatform()) return;
  void LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    handler((event.notification.extra ?? {}) as Record<string, unknown>);
  });
}
