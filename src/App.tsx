import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import FriendsPage from './pages/FriendsPage';
import HomePage from './pages/HomePage';
import GamefinderPage from './pages/GamefinderPage';
import LibraryPage from './pages/LibraryPage';
import PlannerPage from './pages/PlannerPage';
import SessionDetailPage from './pages/SessionDetailPage';
import UserProfilePage from './pages/UserProfilePage';
import UserSettingsPage from './pages/UserSettingsPage';

export default function App() {
    return (
        <BrowserRouter>
            <div className="min-h-screen bg-slate-950 text-slate-100">
                <Header />
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/gamefinder" element={<GamefinderPage />} />
                    <Route path="/planner" element={<PlannerPage />} />
                    <Route path="/sessions/:id" element={<SessionDetailPage />} />
                    <Route path="/friends" element={<FriendsPage />} />
                    <Route path="/library" element={<LibraryPage />} />
                    <Route path="/settings" element={<UserSettingsPage />} />
                    <Route path="/users/:id" element={<UserProfilePage />} />
                    <Route path="/u/:username" element={<UserProfilePage />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
}