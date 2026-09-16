/** Core domain types shared by the parent and child sides of the app. */

import type { StoredSecret } from './lib/crypto';

export type Role = 'parent' | 'child';

export interface Family {
  id: string;
  name: string;
  joinCode: string;
  createdAt: number;
}

/** A security question and the hashed answer. Answers are never stored plainly. */
export interface SecurityQuestion {
  question: string;
  answer: StoredSecret;
}

export interface Parent {
  id: string;
  familyId: string;
  name: string;
  email: string;
  password: StoredSecret;
  /** Two questions, chosen by the parent, used to recover a lost password. */
  securityQuestions: SecurityQuestion[];
  /**
   * Legacy quick-unlock code from before accounts had passwords. Kept so an
   * existing install can still get in once and set a password.
   */
  pin?: string;
  role: 'parent';
  /** Free text the parent writes about their schedule, used to tune delivery. */
  shiftNote?: string;
  createdAt: number;
}

export type ReadingLevel = 'pre-reader' | 'early' | 'growing' | 'confident';

export interface Child {
  id: string;
  familyId: string;
  name: string;
  age: number;
  avatar: string;
  pin: string;
  role: 'child';
  readingLevel: ReadingLevel;
  interests: string[];
  /** "HH:MM" in the child's local time. */
  bedtime: string;
  timezone: string;
  gameDifficulty: 1 | 2 | 3;
  createdAt: number;
}

export type VoiceStatus = 'none' | 'enrolling' | 'processing' | 'ready' | 'failed';

export interface VoiceSample {
  id: string;
  promptId: string;
  /** Seconds of usable audio. */
  duration: number;
  /** Rough 0-1 score from the local quality check. */
  quality: number;
  createdAt: number;
}

export interface VoiceProfile {
  id: string;
  parentId: string;
  provider: VoiceProviderId;
  /** Identifier handed back by the cloning provider, when there is one. */
  providerVoiceId?: string;
  status: VoiceStatus;
  samples: VoiceSample[];
  /** Consent is mandatory before any sample leaves the device. */
  consentName?: string;
  consentAt?: number;
  failureReason?: string;
  updatedAt: number;
}

/**
 * Where narration comes from.
 *  - 'managed'  the family's cloned voice, synthesised by our server
 *  - 'recorded' the parent read it aloud themselves
 *  - 'device'   the phone's built-in reader, which is nobody's real voice
 */
export type VoiceProviderId = 'managed' | 'device' | 'recorded';

export type StoryTopic =
  | 'adventure'
  | 'animals'
  | 'space'
  | 'ocean'
  | 'dinosaurs'
  | 'kindness'
  | 'bravery'
  | 'calm'
  | 'heartfelt';

export type StoryTone = 'playful' | 'gentle' | 'epic' | 'silly' | 'sincere';

export type StoryLength = 'short' | 'medium' | 'long';

export interface StoryPage {
  text: string;
  /** Deterministic seed used to draw the page's illustration. */
  art: string;
}

/**
 * A dialogic-reading prompt, spoken mid-story in the parent's voice.
 *
 * Shared reading works best when the grown-up asks questions rather than just
 * narrating, so the player pauses and asks — and the child answers out loud.
 * The CROWD kinds come from the standard dialogic reading framework.
 */
export interface TalkPrompt {
  /** 0-based page index this is asked after. */
  afterPage: number;
  prompt: string;
  kind: 'completion' | 'recall' | 'open' | 'wh' | 'distancing';
}

export interface ComprehensionQuestion {
  q: string;
  choices: string[];
  answer: number;
  /** Which page the answer lives on, so we can show the kid where to look. */
  page: number;
}

export type StoryStatus = 'draft' | 'generating' | 'ready' | 'delivered' | 'played' | 'failed';

export interface Story {
  id: string;
  familyId: string;
  fromParentId: string;
  fromParentName: string;
  toChildId: string;
  title: string;
  topic: StoryTopic;
  tone: StoryTone;
  length: StoryLength;
  pages: StoryPage[];
  /** Spoken-only opener the parent adds on top of the story. */
  personalNote?: string;
  comprehension: ComprehensionQuestion[];
  /** Vocabulary the story deliberately teaches. */
  vocabulary: { word: string; meaning: string }[];
  /** Questions the parent's voice asks mid-story. */
  talkPrompts?: TalkPrompt[];
  voiceProfileId?: string;
  voiceProvider: VoiceProviderId;
  /** Key into the local audio blob store. */
  audioKey?: string;
  /** Set when this story came from the built-in library rather than being written. */
  libraryItemId?: string;
  /** Set when auto-pilot queued it rather than a parent choosing it. */
  autoPilot?: boolean;
  durationEstimate: number;
  status: StoryStatus;
  scheduledFor: number;
  createdAt: number;
  deliveredAt?: number;
  playedAt?: number;
  playCount: number;
  failureReason?: string;
}

/**
 * A parent's own recording of a library item.
 *
 * These are the highest-fidelity thing in the app — actually them, actually
 * reading — and they double as the training material for the cloned voice, so
 * a parent's effort is never spent only on enrolment.
 */
export interface VoiceRecording {
  id: string;
  itemId: string;
  parentId: string;
  parentName: string;
  audioKey: string;
  duration: number;
  /** 0-1 from the on-device quality check. */
  quality: number;
  createdAt: number;
  /** Set once this take has been used to build the voice. */
  usedForVoiceAt?: number;
}

export interface LullabyDelivery {
  id: string;
  familyId: string;
  fromParentId: string;
  fromParentName: string;
  toChildId: string;
  lullabyId: string;
  title: string;
  verses: string[];
  audioKey?: string;
  voiceProvider: VoiceProviderId;
  createdAt: number;
  playCount: number;
  lastPlayedAt?: number;
}

export interface ChildReply {
  id: string;
  storyId: string;
  childId: string;
  childName: string;
  audioKey: string;
  duration: number;
  createdAt: number;
  heardAt?: number;
}

export type SkillId =
  | 'phonics'
  | 'blending'
  | 'manipulation'
  | 'rhyme'
  | 'sightWords'
  | 'numberSense'
  | 'comprehension'
  | 'patterns'
  | 'focus'
  | 'flexibility'
  | 'talk';

/** Broad groupings, so eleven skills stay legible on one screen. */
export type SkillArea = 'reading' | 'numbers' | 'thinking' | 'talking';

export interface SkillCard {
  /** Stable key for the thing being learned, e.g. "sight:because". */
  key: string;
  skill: SkillId;
  /** SM-2 style scheduling state. */
  ease: number;
  interval: number;
  dueAt: number;
  reps: number;
  lapses: number;
  lastResult?: 'right' | 'wrong';
}

export interface GameSession {
  id: string;
  childId: string;
  game: string;
  skill: SkillId;
  correct: number;
  total: number;
  /** Milliseconds of focused play. */
  ms: number;
  createdAt: number;
}

export interface Settings {
  /** Minutes of games allowed per day. 0 disables the cap. */
  dailyGameMinutes: number;
  /** Games unlock only after the night's story has been played. */
  storyBeforeGames: boolean;
  notificationsEnabled: boolean;
  /** Only set for self-hosted installs; hosted builds bake this in. */
  serverUrl?: string;
  /** Preferred sleep sound and timer on the child's device. */
  ambientId?: string;
  sleepTimerMinutes?: number;
  /** Send something every night without the parent doing anything. */
  autoPilot: boolean;
  /** Which shelves auto-pilot draws from, in rotation. */
  autoPilotShelves: ('story' | 'learning-book' | 'song' | 'lullaby')[];
  /** Whether the first-run walkthrough has been completed. */
  onboarded: boolean;
}

export interface AppData {
  family?: Family;
  parents: Parent[];
  children: Child[];
  voices: VoiceProfile[];
  stories: Story[];
  lullabies: LullabyDelivery[];
  recordings: VoiceRecording[];
  replies: ChildReply[];
  cards: SkillCard[];
  sessions: GameSession[];
  journal: JournalEntry[];
  settings: Settings;
  version: number;
}

export interface JournalEntry {
  id: string;
  kind: string;
  summary: string;
  actorName?: string;
  subjectId?: string;
  detail?: Record<string, unknown>;
  createdAt: number;
}

export interface Session {
  role: Role;
  userId: string;
}
