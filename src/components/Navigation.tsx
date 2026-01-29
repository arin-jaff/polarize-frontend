'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Calendar,
  Activity,
  Settings,
  MessageSquare,
  LogOut,
  Upload,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/activities', label: 'Activities', icon: Activity },
  { href: '/coach', label: 'AI Coach', icon: MessageSquare },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <nav className="fixed top-0 left-0 h-full w-64 bg-slate-900 text-white p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-blue-400">Polarize</h1>
        <p className="text-sm text-slate-400 mt-1">{user?.name}</p>
      </div>

      <div className="flex-1">
        <ul className="space-y-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  pathname === href
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon size={20} />
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8 px-4">
          <Link
            href="/upload"
            className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Upload size={18} />
            Upload FIT
          </Link>
        </div>
      </div>

      <div className="border-t border-slate-700 pt-4">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2 w-full text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </nav>
  );
}
