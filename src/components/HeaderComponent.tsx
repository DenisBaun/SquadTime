import React, { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import AuthModal from './AuthModal';
import UserAvatar from './UserAvatar';
import { getToken, clearToken } from '../utils/auth';
import { API_BASE, authHeaders } from '../utils/api';

const Header: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [user, setUser] = useState<string | null>(null);
    const [userId, setUserId] = useState<number | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    const loadUserFromToken = async () => {
        const token = getToken();
        if (!token) {
            setUser(null);
            return;
        }

        // Try to fetch current user from server using token; fall back to local JWT decode
        try {
            const resp = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() });
            if (resp.ok) {
                const data = await resp.json();
                setUser(data.user?.display_name || data.user?.username || data.user?.email || null);
                setUserId(data.user?.id || null);
                setUsername(data.user?.username || null);
                setAvatarUrl(data.user?.avatar_url || null);
                return;
            }
        } catch (e) {
            // ignore and fallback
        }

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setUser(payload.username || payload.email || null);
            setUserId(payload.id || null);
            setUsername(payload.username || null);
            setAvatarUrl(null);
        } catch (e) {
            setUser(null);
            setUserId(null);
            setUsername(null);
            setAvatarUrl(null);
        }
    };

    useEffect(() => {
        loadUserFromToken();
    }, []);

    const handleLogout = () => {
        clearToken();
        setUser(null);
        setUserId(null);
        setUsername(null);
        setAvatarUrl(null);
    };

    const navItems = [
        { to: '/gamefinder', label: 'Gamefinder', description: 'Spiele finden' },
        { to: '/planner', label: 'Planner', description: 'Sessions planen' },
        { to: '/friends', label: 'Friends', description: 'Freunde & Social' },
        { to: '/library', label: 'Library', description: 'Deine Spiele' }
    ];

    return (
        <>
            <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
                    <Link to="/" className="flex items-center gap-3">
                        <img src="/favicon.png" alt="SquadTime Icon" className="h-[72px] w-[72px] rounded-lg object-contain" />
                        <div>
                            <h1 className="text-2xl font-bold text-white">SquadTime</h1>
                            <p className="text-sm text-slate-400">Gaming Planner & Social Hub</p>
                        </div>
                    </Link>

                    <nav className="flex items-center gap-2">
                                        {navItems.map((item) => (
                           <NavLink
                               key={item.label}
                               to={item.to}
                               className={({ isActive }) =>
                                   `rounded-full px-4 py-2 text-sm font-medium transition ${
                                       isActive
                                           ? 'bg-cyan-500 text-slate-950'
                                           : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                                   }`
                               }
                           >
                               {item.label}
                           </NavLink>
                                        ))}

                        <div className="ml-2 flex items-center gap-3">
                            {user ? (
                                <>
                                    {userId ? (
                                        <Link to={username ? `/u/${username}` : `/users/${userId}`} className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700">
                                            <UserAvatar name={user || username || 'U'} avatarUrl={avatarUrl} sizeClassName="h-6 w-6" />
                                            <span>{user}</span>
                                        </Link>
                                    ) : (
                                        <span className="rounded-full bg-slate-800 px-3 py-2 text-sm text-slate-200">{user}</span>
                                    )}
                                    <button onClick={handleLogout} className="rounded-full bg-slate-700 px-3 py-2 text-sm text-slate-100">Logout</button>
                                </>
                            ) : (
                                <button onClick={() => setOpen(true)} className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">Login</button>
                            )}
                        </div>
                    </nav>
                </div>
            </header>
            <AuthModal open={open} onClose={() => setOpen(false)} onLoginSuccess={loadUserFromToken} />
        </>
    );
};

export default Header;
