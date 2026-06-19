import { Link, usePage } from '@inertiajs/react';
import {
    BarChart2, Bell, ChefHat, Coffee, Home, LogOut,
    Menu, Moon, Search, Settings, Shield, ShoppingBag,
    Sun, Table2, Tag, UserCircle, Users, X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAppearance } from '@/hooks/use-appearance';
import { adminAddonGroupsIndex, adminCategoriesIndex, adminCustomersIndex, adminDashboard,
    adminMenuItemsIndex, adminOrdersIndex, adminPromosIndex, adminRolesIndex, adminSettings,
    adminTablesIndex, adminUsersIndex, kitchenIndex, logout, posIndex,
} from '@/lib/routes';

const NAV_GROUPS = [
    {
        label: 'MAIN MENU',
        items: [
            { href: adminDashboard(),       label: 'Dashboard',   icon: Home,      color: '#D4A843' },
            { href: adminOrdersIndex(),     label: 'Orders',      icon: ShoppingBag, color: '#3B82F6' },
            { href: adminCategoriesIndex(), label: 'Categories',  icon: Coffee,    color: '#8A9E7B' },
            { href: adminMenuItemsIndex(),  label: 'Menu Items',  icon: ChefHat,   color: '#F59E0B' },
            { href: adminAddonGroupsIndex(),label: 'Add-ons',     icon: BarChart2, color: '#A78BFA' },
            { href: adminTablesIndex(),     label: 'Tables & QR', icon: Table2,    color: '#10B981' },
            { href: adminCustomersIndex(), label: 'Customers',   icon: UserCircle, color: '#F97316' },
            { href: adminPromosIndex(),   label: 'Promos',      icon: Tag,        color: '#EF4444' },
        ],
    },
    {
        label: 'SETTINGS',
        items: [
            { href: adminUsersIndex(), label: 'Users',    icon: Users,    color: '#EC4899' },
            { href: adminRolesIndex(), label: 'Roles',    icon: Shield,   color: '#6366F1' },
            { href: adminSettings(),   label: 'Settings', icon: Settings, color: '#6B7280' },
        ],
    },
];

const QUICK_LINKS = [
    { href: posIndex(),     label: 'POS Terminal', icon: ShoppingBag },
    { href: kitchenIndex(), label: 'Kitchen',       icon: ChefHat },
];

type Auth = { user: { name: string; email: string } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { url, props } = usePage();
    const auth = (props as { auth: Auth }).auth;
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const [mounted, setMounted] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);
    useEffect(() => setMounted(true), []);

    const isDark = mounted && resolvedAppearance === 'dark';

    return (
        <div
            className="admin-panel flex h-screen overflow-hidden"
            style={{ background: 'var(--ap-bg)', fontFamily: "'DM Sans', sans-serif" }}
        >
            {/* ── Mobile overlay ───────────────────────────────── */}
            {mobileSidebarOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/50 lg:hidden"
                    onClick={() => setMobileSidebarOpen(false)}
                />
            )}

            {/* ── Sidebar ──────────────────────────────────────── */}
            <aside
                ref={sidebarRef}
                className={`fixed left-0 top-0 z-30 flex h-full flex-col transition-all duration-300 ease-in-out
                    ${sidebarOpen ? 'w-64' : 'w-[70px]'}
                    ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
                style={{ background: '#1C1008' }}
            >
                {/* Logo */}
                <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: '#D4A843' }}>
                        <span className="text-base font-bold text-white">☕</span>
                    </div>
                    {sidebarOpen && (
                        <div className="overflow-hidden">
                            <p className="truncate text-sm font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
                                Milk&Honey
                            </p>
                            <p className="text-[10px] text-amber-400/70">Admin Panel</p>
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-4">
                    {NAV_GROUPS.map((group) => (
                        <div key={group.label} className="mb-4">
                            {sidebarOpen && (
                                <p className="mb-2 px-4 text-[10px] font-semibold tracking-widest text-gray-500">
                                    {group.label}
                                </p>
                            )}
                            <ul className="space-y-0.5 px-2">
                                {group.items.map(({ href, label, icon: Icon, color }) => {
                                    const isActive = url === href || (href !== adminDashboard() && url.startsWith(href));
                                    return (
                                        <li key={href}>
                                            <Link
                                                href={href}
                                                className={`group flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all duration-150
                                                    ${isActive
                                                        ? 'text-white'
                                                        : 'text-gray-400 hover:text-white'
                                                    }`}
                                                style={isActive
                                                    ? { background: 'rgba(212,168,67,0.12)', borderLeft: '3px solid #D4A843', paddingLeft: '9px' }
                                                    : {}}
                                            >
                                                <span
                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all"
                                                    style={{
                                                        background: isActive ? `${color}22` : 'rgba(255,255,255,0.05)',
                                                        color: isActive ? color : '#9CA3AF',
                                                    }}
                                                >
                                                    <Icon className="h-4 w-4" />
                                                </span>
                                                {sidebarOpen && <span className="truncate">{label}</span>}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}

                    {/* Quick access */}
                    {sidebarOpen && (
                        <div className="mb-2 px-4">
                            <p className="mb-2 text-[10px] font-semibold tracking-widest text-gray-500">QUICK ACCESS</p>
                        </div>
                    )}
                    <ul className="space-y-0.5 px-2">
                        {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
                            <li key={href}>
                                <Link
                                    href={href}
                                    className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-xs font-medium text-gray-500 hover:text-gray-300"
                                >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                        <Icon className="h-3.5 w-3.5" />
                                    </span>
                                    {sidebarOpen && <span>{label}</span>}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* User + Logout */}
                <div className="border-t border-white/10 p-3">
                    {sidebarOpen ? (
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: '#D4A843' }}>
                                {auth?.user?.name?.charAt(0).toUpperCase() ?? 'A'}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-white">{auth?.user?.name ?? 'Admin'}</p>
                                <p className="truncate text-[10px] text-gray-500">{auth?.user?.email ?? ''}</p>
                            </div>
                            <Link href={logout()} method="post" as="button" className="rounded-lg p-1.5 text-gray-500 hover:text-red-400">
                                <LogOut className="h-4 w-4" />
                            </Link>
                        </div>
                    ) : (
                        <Link href={logout()} method="post" as="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:text-red-400 mx-auto">
                            <LogOut className="h-4 w-4" />
                        </Link>
                    )}
                </div>
            </aside>

            {/* ── Main area ────────────────────────────────────── */}
            <div
                className="flex min-w-0 flex-1 flex-col transition-all duration-300"
                style={{ marginLeft: sidebarOpen ? '256px' : '70px' }}
            >
                {/* Topbar */}
                <header
                    className="sticky top-0 z-10 flex h-16 items-center gap-3 px-4 lg:px-6"
                    style={{
                        background: 'var(--ap-card)',
                        borderBottom: '1px solid var(--ap-border)',
                    }}
                >
                    {/* Sidebar toggle */}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-black/5"
                        style={{ color: 'var(--ap-muted)' }}
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => setMobileSidebarOpen(true)}
                        className="flex lg:hidden h-9 w-9 items-center justify-center rounded-xl"
                        style={{ color: 'var(--ap-muted)' }}
                    >
                        <Menu className="h-5 w-5" />
                    </button>

                    {/* Search */}
                    <div className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)' }}>
                        <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--ap-muted)' }} />
                        <span style={{ color: 'var(--ap-muted)' }} className="text-sm">Search or type command...</span>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-1">
                        {/* Dark mode toggle */}
                        {mounted && (
                            <button
                                onClick={() => updateAppearance(isDark ? 'light' : 'dark')}
                                className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-black/5"
                                title="Toggle dark mode"
                            >
                                {isDark
                                    ? <Sun className="h-5 w-5" style={{ color: '#D4A843' }} />
                                    : <Moon className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} />
                                }
                            </button>
                        )}

                        {/* Notifications */}
                        <button className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-black/5">
                            <Bell className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} />
                            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                        </button>

                        {/* User avatar */}
                        <div className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: '#D4A843' }}>
                            {auth?.user?.name?.charAt(0).toUpperCase() ?? 'A'}
                        </div>
                        {mounted && (
                            <span className="hidden text-sm font-medium md:block" style={{ color: 'var(--ap-input-text)' }}>
                                {auth?.user?.name ?? 'Admin'}
                            </span>
                        )}
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
