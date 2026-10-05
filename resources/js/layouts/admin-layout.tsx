import { Link, usePage } from '@inertiajs/react';
import {
    BarChart2, Banknote, Bell, Bike, CalendarCheck, ChefHat, Coffee, Database, Home, LogOut,
    Menu, Moon, Receipt, ScanLine, Search, Settings, Shield, ShoppingBag, Store,
    Sun, Table2, Tag, UserCircle, UserCog, Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAppearance } from '@/hooks/use-appearance';
import { adminAccount, adminAddonGroupsIndex, adminCategoriesIndex, adminCustomersIndex, adminDashboard,
    adminExpensesIndex,
    adminMenuItemsIndex, adminOrdersIndex, adminPromosIndex, adminRolesIndex, adminHrAttendance, adminHrEmployees, adminHrPayroll, adminSettings, adminSystem, attendanceKiosk,
    adminDeliveryMenIndex, adminTablesIndex, adminUsersIndex, baristaIndex, kitchenIndex, logout, posIndex,
} from '@/lib/routes';

const NAV_GROUPS = [
    {
        label: 'MAIN MENU',
        items: [
            { href: adminDashboard(),       label: 'Dashboard',   icon: Home },
            { href: adminOrdersIndex(),     label: 'Orders',      icon: ShoppingBag },
            { href: adminCategoriesIndex(), label: 'Categories',  icon: Coffee },
            { href: adminMenuItemsIndex(),  label: 'Menu Items',  icon: ChefHat },
            { href: adminAddonGroupsIndex(),label: 'Add-ons',     icon: BarChart2 },
            { href: adminTablesIndex(),     label: 'Tables & QR', icon: Table2 },
            { href: adminDeliveryMenIndex(), label: 'Delivery Men', icon: Bike },
            { href: adminCustomersIndex(), label: 'Customers',   icon: UserCircle },
            { href: adminPromosIndex(),          label: 'Promos',       icon: Tag },
            { href: adminExpensesIndex(),        label: 'Expenses',     icon: Receipt },
        ],
    },
    {
        label: 'HUMAN RESOURCE',
        items: [
            { href: adminHrEmployees(),  label: 'Employees',  icon: UserCog,       permission: 'view employees' },
            { href: adminHrAttendance(), label: 'Attendance', icon: CalendarCheck, permission: 'view attendance' },
            { href: adminHrPayroll(),    label: 'Payroll',    icon: Banknote,      permission: 'view payroll' },
        ],
    },
    {
        label: 'SETTINGS',
        items: [
            { href: adminUsersIndex(), label: 'Users',    icon: Users },
            { href: adminRolesIndex(), label: 'Roles',    icon: Shield },
            { href: adminSettings(),   label: 'Settings', icon: Settings },
            { href: adminSystem(),     label: 'System',   icon: Database, permission: 'view system' },
        ],
    },
];

/** Icon shortcuts shown in the top bar for jumping straight to the working screens. */
const TOP_SHORTCUTS = [
    { href: posIndex(), label: 'POS Terminal', icon: Store },
    { href: kitchenIndex(), label: 'Kitchen', icon: ChefHat },
    { href: baristaIndex(), label: 'Barista', icon: Coffee },
    // Opens the employee clock in / out screen in its own tab, ready to leave open on a tablet.
    { href: attendanceKiosk(), label: 'Attendance', title: 'Attendance — clock in / out (opens in a new tab)', icon: ScanLine, external: true },
];

const QUICK_LINKS = [
    { href: posIndex(),     label: 'POS Terminal', icon: ShoppingBag },
    { href: kitchenIndex(), label: 'Kitchen',       icon: ChefHat },
    { href: baristaIndex(), label: 'Barista',       icon: Coffee },
];

type Auth = { user: { name: string; email: string; permissions?: string[] } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { url, props } = usePage();
    const auth = (props as { auth: Auth }).auth;
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const [mounted, setMounted] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);
    // Appearance is only known client-side; avoids a hydration mismatch on the theme icon.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => setMounted(true), []);

    // The mobile drawer is always shown expanded; the collapsed rail only applies to desktop.
    const expanded = sidebarOpen || mobileSidebarOpen;

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
                className={`fixed left-0 top-0 z-30 flex h-full flex-col border-r transition-all duration-300 ease-in-out
                    ${expanded ? 'w-64' : 'w-[70px]'}
                    ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
                style={{ background: 'var(--ap-sidebar-bg)', borderColor: 'var(--ap-sidebar-border)' }}
            >
                {/* Logo */}
                <div className="flex h-16 items-center gap-3 border-b px-4" style={{ borderColor: 'var(--ap-sidebar-border)' }}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary">
                        <span className="text-base font-bold text-primary-foreground">☕</span>
                    </div>
                    {expanded && (
                        <div className="overflow-hidden">
                            <p className="truncate text-sm font-bold" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--ap-input-text)' }}>
                                Milk&Honey
                            </p>
                            <p className="text-[10px] font-medium text-primary">Admin Panel</p>
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-4">
                    {NAV_GROUPS.map((group) => (
                        <div key={group.label} className="mb-4">
                            {expanded && (
                                <p className="mb-2 px-4 text-[10px] font-semibold tracking-widest" style={{ color: 'var(--ap-sidebar-heading)' }}>
                                    {group.label}
                                </p>
                            )}
                            <ul className="space-y-0.5 px-2">
                                {group.items.filter((item) => !('permission' in item) || !item.permission || (auth?.user?.permissions ?? []).includes(item.permission)).map(({ href, label, icon: Icon }) => {
                                    const isActive = url === href || (href !== adminDashboard() && url.startsWith(href));

                                    return (
                                        <li key={href}>
                                            <Link
                                                href={href}
                                                onClick={() => setMobileSidebarOpen(false)}
                                                className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all duration-150"
                                                style={{ color: isActive ? 'var(--ap-sidebar-text-active)' : 'var(--ap-sidebar-text)' }}
                                                onMouseEnter={(e) => {
 if (!isActive) {
e.currentTarget.style.color = 'var(--ap-sidebar-text-active)';
} 
}}
                                                onMouseLeave={(e) => {
 if (!isActive) {
e.currentTarget.style.color = 'var(--ap-sidebar-text)';
} 
}}
                                            >
                                                <span
                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all"
                                                    style={{
                                                        background: isActive ? 'var(--ap-primary)' : 'transparent',
                                                        color: isActive ? 'var(--ap-primary-fg)' : 'inherit',
                                                    }}
                                                >
                                                    <Icon className="h-4 w-4" />
                                                </span>
                                                {expanded && <span className="truncate">{label}</span>}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}

                    {/* Quick access */}
                    {expanded && (
                        <div className="mb-2 px-4">
                            <p className="mb-2 text-[10px] font-semibold tracking-widest" style={{ color: 'var(--ap-sidebar-heading)' }}>QUICK ACCESS</p>
                        </div>
                    )}
                    <ul className="space-y-0.5 px-2">
                        {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
                            <li key={href}>
                                <Link
                                    href={href}
                                    onClick={() => setMobileSidebarOpen(false)}
                                    className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors"
                                    style={{ color: 'var(--ap-sidebar-text)' }}
                                    onMouseEnter={(e) => {
 e.currentTarget.style.color = 'var(--ap-sidebar-text-active)'; 
}}
                                    onMouseLeave={(e) => {
 e.currentTarget.style.color = 'var(--ap-sidebar-text)'; 
}}
                                >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--ap-bg)' }}>
                                        <Icon className="h-3.5 w-3.5" />
                                    </span>
                                    {expanded && <span>{label}</span>}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* User + Logout */}
                <div className="border-t p-3" style={{ borderColor: 'var(--ap-sidebar-border)' }}>
                    {expanded ? (
                        <div className="flex items-center gap-2">
                            <Link href={adminAccount()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground transition-opacity hover:opacity-80" title="Account settings">
                                {auth?.user?.name?.charAt(0).toUpperCase() ?? 'A'}
                            </Link>
                            <div className="min-w-0 flex-1">
                                <Link href={adminAccount()} className="block truncate text-xs font-semibold transition-colors hover:text-primary" style={{ color: 'var(--ap-input-text)' }}>{auth?.user?.name ?? 'Admin'}</Link>
                                <p className="truncate text-[10px]" style={{ color: 'var(--ap-sidebar-heading)' }}>{auth?.user?.email ?? ''}</p>
                            </div>
                            <Link href={logout()} method="post" as="button" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-error" title="Logout">
                                <LogOut className="h-4 w-4" />
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <Link href={adminAccount()} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground transition-opacity hover:opacity-80" title="Account settings">
                                {auth?.user?.name?.charAt(0).toUpperCase() ?? 'A'}
                            </Link>
                            <Link href={logout()} method="post" as="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-error" title="Logout">
                                <LogOut className="h-4 w-4" />
                            </Link>
                        </div>
                    )}
                </div>
            </aside>

            {/* ── Main area ────────────────────────────────────── */}
            <div
                className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-[70px]'}`}
            >
                {/* Topbar */}
                <header
                    className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b px-4 lg:px-6"
                    style={{
                        background: 'var(--ap-card)',
                        borderColor: 'var(--ap-border)',
                    }}
                >
                    {/* Sidebar toggle */}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="hidden h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted lg:flex"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => setMobileSidebarOpen(true)}
                        aria-label="Open menu"
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground lg:hidden"
                    >
                        <Menu className="h-5 w-5" />
                    </button>

                    {/* Search */}
                    <div className="hidden min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-sm sm:flex" style={{ background: 'var(--ap-bg)', borderColor: 'var(--ap-border)' }}>
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm text-muted-foreground">Search or type command...</span>
                    </div>

                    {/* Quick navigation to POS / Kitchen / Barista */}
                    <nav aria-label="Quick navigation" className="ml-auto flex shrink-0 items-center gap-1 rounded-xl border p-1 sm:ml-0" style={{ background: 'var(--ap-bg)', borderColor: 'var(--ap-border)' }}>
                        {TOP_SHORTCUTS.map((shortcut) => {
                            const { href, label, icon: Icon } = shortcut;
                            const external = 'external' in shortcut && shortcut.external;
                            const title = 'title' in shortcut ? shortcut.title : label;
                            const active = !external && (url === href || url.startsWith(`${href}/`));
                            const className = `group relative flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`;
                            const content = (
                                <>
                                    <Icon className="h-[18px] w-[18px]" />
                                    <span className="hidden xl:inline">{label}</span>
                                </>
                            );

                            return external ? (
                                <a key={href} href={href} target="_blank" rel="noopener noreferrer" title={title} aria-label={title} className={className}>{content}</a>
                            ) : (
                                <Link key={href} href={href} title={title} aria-label={title} className={className}>{content}</Link>
                            );
                        })}
                    </nav>

                    {/* Right actions */}
                    <div className="flex items-center gap-1">
                        {/* Dark mode toggle */}
                        {mounted && (
                            <button
                                onClick={() => updateAppearance(isDark ? 'light' : 'dark')}
                                className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-muted"
                                title="Toggle dark mode"
                            >
                                {isDark
                                    ? <Sun className="h-5 w-5 text-primary" />
                                    : <Moon className="h-5 w-5 text-muted-foreground" />
                                }
                            </button>
                        )}

                        {/* Notifications */}
                        <button className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-muted">
                            <Bell className="h-5 w-5 text-muted-foreground" />
                            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error ring-2" style={{ boxShadow: '0 0 0 2px var(--ap-card)' }} />
                        </button>

                        {/* User avatar */}
                        <div className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
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
