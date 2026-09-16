import { useEffect } from 'react';
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useApp } from './lib/store';
import { onNotificationTap } from './lib/notifications';
import {
  IconBook,
  IconChart,
  IconGame,
  IconHome,
  IconMic,
  IconMoon,
  IconMusic,
  IconSpark,
  IconUsers,
} from './components/Icons';

import Welcome from './screens/Welcome';
import Onboarding from './screens/Onboarding';
import SignIn from './screens/auth/SignIn';
import SignUp from './screens/auth/SignUp';
import KidPicker from './screens/auth/KidPicker';
import ForgotPassword from './screens/auth/ForgotPassword';
import SetPassword from './screens/auth/SetPassword';
import PairDevice from './screens/auth/PairDevice';

import ParentHome from './screens/parent/Home';
import VoiceStudio from './screens/parent/VoiceStudio';
import StoryBuilder from './screens/parent/StoryBuilder';
import ParentLibrary from './screens/parent/Library';
import FamilyScreen from './screens/parent/Family';
import ProgressScreen from './screens/parent/Progress';
import SettingsScreen from './screens/parent/Settings';
import RecordHub from './screens/parent/RecordHub';
import RecordingStudio from './screens/parent/RecordingStudio';
import AccountScreen from './screens/parent/Account';
import PlanScreen from './screens/parent/Plan';
import LullabiesScreen from './screens/parent/Lullabies';
import JournalScreen from './screens/parent/Journal';

import ChildHome from './screens/child/Home';
import Player from './screens/child/Player';
import Bookshelf from './screens/child/Bookshelf';
import GamesHub from './screens/child/GamesHub';
import GameRunner from './screens/child/GameRunner';
import ReplyRecorder from './screens/child/ReplyRecorder';
import LullabyPlayer from './screens/child/LullabyPlayer';
import Shelf from './screens/child/Shelf';
import LearningHub from './screens/child/LearningHub';
import LibraryPlayer from './screens/child/LibraryPlayer';

export default function App() {
  const { session, loading } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const skin = session?.role === 'child' ? 'kid' : 'parent';

  useEffect(() => {
    document.documentElement.setAttribute('data-skin', skin);
    if (Capacitor.isNativePlatform()) {
      void StatusBar.setStyle({ style: skin === 'kid' ? Style.Light : Style.Dark }).catch(
        () => undefined,
      );
    }
  }, [skin]);

  // A tapped bedtime notification should land on the story, not the home screen.
  useEffect(() => {
    onNotificationTap((extra) => {
      if (typeof extra.storyId === 'string') navigate(`/c/story/${extra.storyId}`);
      else if (extra.kind === 'bedtime') navigate('/c');
    });
  }, [navigate]);

  if (loading) {
    return (
      <div className="app">
        <div className="screen" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="pulse" style={{ textAlign: 'center' }}>
            <IconMoon size={44} />
            <p className="muted" style={{ marginTop: 10 }}>Waking up…</p>
          </div>
        </div>
      </div>
    );
  }

  const isParent = session?.role === 'parent';
  const isChild = session?.role === 'child';
  const showTabs =
    (isParent && location.pathname.startsWith('/p')) ||
    (isChild && location.pathname.startsWith('/c'));

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/start" element={<Onboarding />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/set-password" element={<RequireRole role="parent"><SetPassword /></RequireRole>} />
        <Route path="/kids" element={<KidPicker />} />
        <Route path="/pair" element={<PairDevice />} />

        <Route path="/p" element={<RequireRole role="parent"><ParentHome /></RequireRole>} />
        <Route path="/p/voice" element={<RequireRole role="parent"><VoiceStudio /></RequireRole>} />
        <Route path="/p/story" element={<RequireRole role="parent"><StoryBuilder /></RequireRole>} />
        <Route path="/p/library" element={<RequireRole role="parent"><ParentLibrary /></RequireRole>} />
        <Route path="/p/family" element={<RequireRole role="parent"><FamilyScreen /></RequireRole>} />
        <Route path="/p/progress" element={<RequireRole role="parent"><ProgressScreen /></RequireRole>} />
        <Route path="/p/settings" element={<RequireRole role="parent"><SettingsScreen /></RequireRole>} />
        <Route path="/p/account" element={<RequireRole role="parent"><AccountScreen /></RequireRole>} />
        <Route path="/p/plan" element={<RequireRole role="parent"><PlanScreen /></RequireRole>} />
        <Route path="/p/lullabies" element={<RequireRole role="parent"><LullabiesScreen /></RequireRole>} />
        <Route path="/p/journal" element={<RequireRole role="parent"><JournalScreen /></RequireRole>} />
        <Route path="/p/record" element={<RequireRole role="parent"><RecordHub /></RequireRole>} />
        <Route path="/p/record/:itemId" element={<RequireRole role="parent"><RecordingStudio /></RequireRole>} />

        <Route path="/c" element={<RequireRole role="child"><ChildHome /></RequireRole>} />
        <Route path="/c/story/:storyId" element={<RequireRole role="child"><Player /></RequireRole>} />
        <Route path="/c/books" element={<RequireRole role="child"><Bookshelf /></RequireRole>} />
        <Route path="/c/games" element={<RequireRole role="child"><GamesHub /></RequireRole>} />
        <Route path="/c/games/:gameId" element={<RequireRole role="child"><GameRunner /></RequireRole>} />
        <Route path="/c/reply/:storyId" element={<RequireRole role="child"><ReplyRecorder /></RequireRole>} />
        <Route path="/c/lullabies" element={<RequireRole role="child"><LullabyPlayer /></RequireRole>} />
        <Route path="/c/shelf/:kind" element={<RequireRole role="child"><Shelf /></RequireRole>} />
        <Route path="/c/learning" element={<RequireRole role="child"><LearningHub /></RequireRole>} />
        <Route path="/c/read/:itemId" element={<RequireRole role="child"><LibraryPlayer /></RequireRole>} />

        <Route path="*" element={<RootRedirect />} />
      </Routes>

      {showTabs && (isParent ? <ParentTabs /> : <ChildTabs />)}
    </div>
  );
}

function RootRedirect() {
  const { session, data } = useApp();
  if (session?.role === 'parent') return <Navigate to="/p" replace />;
  if (session?.role === 'child') return <Navigate to="/c" replace />;
  // A brand new install gets the walkthrough before it gets a form.
  if (!data.settings.onboarded && data.parents.length === 0) {
    return <Navigate to="/start" replace />;
  }
  return <Navigate to="/welcome" replace />;
}

function RequireRole({ role, children }: { role: 'parent' | 'child'; children: React.ReactNode }) {
  const { session } = useApp();
  if (!session) return <Navigate to="/welcome" replace />;
  if (session.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ParentTabs() {
  return (
    <nav className="tabbar" aria-label="Main">
      <Tab to="/p" icon={<IconHome />} label="Tonight" end />
      <Tab to="/p/story" icon={<IconSpark />} label="Create" />
      <Tab to="/p/record" icon={<IconMic />} label="Record" />
      <Tab to="/p/family" icon={<IconUsers />} label="Family" />
      <Tab to="/p/progress" icon={<IconChart />} label="Progress" />
    </nav>
  );
}

function ChildTabs() {
  return (
    <nav className="tabbar" aria-label="Main">
      <Tab to="/c" icon={<IconMoon />} label="Tonight" end />
      <Tab to="/c/shelf/story" icon={<IconBook />} label="Stories" />
      <Tab to="/c/learning" icon={<IconSpark />} label="Learning" />
      <Tab to="/c/lullabies" icon={<IconMusic />} label="Lullaby" />
      <Tab to="/c/games" icon={<IconGame />} label="Play" />
    </nav>
  );
}

function Tab({
  to,
  icon,
  label,
  end,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink to={to} end={end} className="tab">
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}
