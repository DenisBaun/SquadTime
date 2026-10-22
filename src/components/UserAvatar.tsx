import { API_BASE } from '../utils/api';

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  sizeClassName?: string;
}

function resolveAvatarUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
}

function pickFallbackColor(name: string) {
  const colors = ['bg-sky-700', 'bg-indigo-700', 'bg-emerald-700', 'bg-rose-700', 'bg-amber-700', 'bg-violet-700'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

export default function UserAvatar({ name, avatarUrl, sizeClassName = 'h-10 w-10' }: UserAvatarProps) {
  const initial = (name || '?').slice(0, 1).toUpperCase();
  const resolved = resolveAvatarUrl(avatarUrl);
  if (resolved) {
    return <img src={resolved} alt={name} className={`${sizeClassName} rounded-full object-cover`} />;
  }
  return (
    <div className={`${sizeClassName} ${pickFallbackColor(name)} flex items-center justify-center rounded-full font-bold text-white`}>
      {initial}
    </div>
  );
}
