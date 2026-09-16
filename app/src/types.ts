/** Core domain types shared by the parent and child sides of the app. */

export type Role = 'parent' | 'child';

export interface Family {
  id: string;
  name: string;
  joinCode: string;
  createdAt: number;
}

export interface Parent {
  id: string;
  familyId: string;
  name: string;
  email: string;
  pin: string;
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

export type VoiceProviderId = 'elevenlabs' | 'device' | 'recorded';

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
  voiceProfileId?: string;
  voiceProvider: VoiceProviderId;
  /** Key into the local audio blob store. */
  audioKey?: string;
  durationEstimate: number;
  status: StoryStatus;
  scheduledFor: number;
  createdAt: number;
  deliveredAt?: number;
  playedAt?: number;
  playCount: number;
  failureReason?: string;
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

export type SkillId = 'phonics' | 'sightWords' | 'numberSense' | 'comprehension' | 'patterns';

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
  elevenLabsKey?: string;
  anthropicKey?: string;
  serverUrl?: string;
}

export interface AppData {
  family?: Family;
  parents: Parent[];
  children: Child[];
  voices: VoiceProfile[];
  stories: Story[];
  replies: ChildReply[];
  cards: SkillCard[];
  sessions: GameSession[];
  settings: Settings;
  version: number;
}

export interface Session {
  role: Role;
  userId: string;
}
