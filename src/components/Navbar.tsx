"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, PanelLeft, Search, Bell, UserCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/ui/Logo";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { useNavigation } from "@/contexts/NavigationContext";

interface NavLink {
  label: string;
  href: string;
  dropdown?: { label: string; href: string }[];
}

const navLinks: NavLink[] = [
  {
    label: "Curriculum",
    href: "/curriculum",
  },
  {
    label: "Practice",
    href: "/practice",
  },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/community", label: "Community" },
];

const UserProfileDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
            <button
                className="rounded-2xl border border-white/10 bg-white/5 p-2 text-[var(--blueprint-foreground)] transition hover:border-white/20 hover:bg-white/10"
                data-testid="user-profile-button"
            >
                <UserCircle className="h-6 w-6" />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full right-0 mt-3 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[var(--blueprint-glass)] p-4 text-[var(--blueprint-foreground)] shadow-[0_25px_60px_rgba(5,15,35,0.55)] backdrop-blur-2xl"
                    >
                        <h4 className="font-semibold">Jane Doe</h4>
                        <p className="text-sm text-[rgba(230,241,255,0.7)]">Level 5: UVM Adept</p>
                        <div className="my-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-[var(--blueprint-accent)]" style={{ width: '45%' }}></div>
                        </div>
                        <p className="mb-2 text-xs text-[rgba(230,241,255,0.6)]">45% to next level</p>
                        <div className="-mx-4 my-2 border-t border-white/10" />
                        <Link href="/dashboard" className="block rounded-2xl px-2 py-1.5 text-sm text-[rgba(230,241,255,0.7)] transition hover:bg-white/10">Dashboard</Link>
                        <Link href="/settings" className="block rounded-2xl px-2 py-1.5 text-sm text-[rgba(230,241,255,0.7)] transition hover:bg-white/10">Settings</Link>
                        <button className="mt-1 w-full rounded-2xl px-2 py-1.5 text-left text-sm text-[rgba(230,241,255,0.7)] transition hover:bg-white/10">Sign Out</button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

const NotificationCenter = () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative">
             <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative rounded-2xl border border-white/10 bg-white/5 p-2 text-[var(--blueprint-foreground)] transition hover:border-white/20 hover:bg-white/10"
                data-testid="notification-button"
            >
                <Bell className="h-6 w-6" />
                <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-[var(--blueprint-accent)] ring-2 ring-[rgba(8,15,35,0.95)]"></span>
            </button>
             <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full right-0 mt-3 w-80 overflow-hidden rounded-2xl border border-white/10 bg-[var(--blueprint-glass)] shadow-[0_25px_60px_rgba(5,15,35,0.55)] backdrop-blur-2xl"
                    >
                        <div className="border-b border-white/10 p-3 text-sm font-semibold text-[var(--blueprint-foreground)]">Notifications</div>
                        <div className="p-4 text-center text-sm text-[rgba(230,241,255,0.72)]">
                            <p className="font-semibold mb-1">Achievement Unlocked!</p>
                            <p className="text-xs">You completed the 'UVM Basics' module.</p>
                        </div>
                         <div className="border-t border-white/10 p-2 text-center">
                            <Link href="/notifications" className="text-xs text-[var(--blueprint-accent)] hover:underline">View all</Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}


const Navbar = () => {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const { toggleSidebar } = useNavigation();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 50, delay: 0.2 }}
      className="sticky top-0 z-40 w-full border-b border-white/10 bg-[rgba(8,15,35,0.88)] shadow-[0_12px_45px_rgba(5,10,25,0.45)] backdrop-blur-2xl"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[4.5rem] items-center justify-between py-3">
          {/* Left Section */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSidebar}
              className="hidden rounded-2xl border border-white/10 bg-white/5 p-2 text-[var(--blueprint-foreground)] transition hover:border-white/20 hover:bg-white/10 md:inline-flex"
              aria-label="Toggle Sidebar"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
            <motion.div whileHover={{ scale: 1.05, rotate: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}>
                <Link href="/">
                  <Logo />
                </Link>
            </motion.div>
          </div>

          {/* Center Section - Desktop */}
          <div className="hidden flex-grow items-center justify-center px-8 md:flex">
            <div className="relative w-full max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-[rgba(230,241,255,0.55)]" />
                <input
                  type="text"
                  placeholder="Search... (Ctrl+K)"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-2 pl-11 pr-4 text-sm text-[var(--blueprint-foreground)] placeholder:text-[rgba(230,241,255,0.45)] focus:outline-none focus:ring-2 focus:ring-[var(--blueprint-accent)]"
                  data-testid="main-search-input"
                />
            </div>
          </div>

          {/* Right Section */}
          <div className="hidden items-center space-x-1 md:flex">
            {navLinks.map((link) =>
              link.dropdown ? (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(link.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button className="flex items-center rounded-2xl px-3 py-2 text-sm text-[rgba(230,241,255,0.65)] transition hover:text-[var(--blueprint-foreground)]">
                    {link.label}
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </button>
                  <AnimatePresence>
                    {openDropdown === link.label && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full mt-3 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[var(--blueprint-glass)] shadow-[0_20px_50px_rgba(5,15,35,0.45)] backdrop-blur-xl"
                      >
                        {link.dropdown.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="block px-4 py-2 text-sm text-[rgba(230,241,255,0.7)] transition hover:bg-white/10"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl px-3 py-2 text-sm text-[rgba(230,241,255,0.65)] transition hover:text-[var(--blueprint-foreground)]"
                >
                  {link.label}
                </Link>
              )
            )}
            <div className="mx-2 h-6 border-l border-white/10"></div>
            <ThemeSwitcher />
            <NotificationCenter />
            <UserProfileDropdown />
          </div>

          {/* Mobile UI */}
          <div className="flex items-center gap-1 md:hidden">
             <button
              onClick={toggleSidebar}
              type="button"
              className="rounded-2xl border border-white/10 bg-white/5 p-2 text-[var(--blueprint-foreground)] transition hover:border-white/20 hover:bg-white/10"
            >
              <PanelLeft className="h-6 w-6" />
              <span className="sr-only">Open sidebar</span>
            </button>
            <button className="rounded-2xl border border-white/10 bg-white/5 p-2 text-[var(--blueprint-foreground)] transition hover:border-white/20 hover:bg-white/10">
                <Search className="h-6 w-6" />
            </button>
            <button
              onClick={toggleMobileMenu}
              type="button"
              className="rounded-2xl border border-white/10 bg-white/5 p-2 text-[var(--blueprint-foreground)] transition hover:border-white/20 hover:bg-white/10"
              aria-controls="mobile-menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
    </motion.nav>

    {/* Mobile Slide-out Menu */}
    <AnimatePresence>
        {isMobileMenuOpen && (
            <>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-40 bg-black/60 md:hidden"
                    onClick={toggleMobileMenu}
                />
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="fixed top-0 right-0 z-50 flex h-full w-4/5 max-w-sm flex-col bg-[rgba(8,15,35,0.96)] shadow-[0_20px_60px_rgba(5,10,25,0.75)] backdrop-blur-2xl"
                >
                    <div className="flex items-center justify-between border-b border-white/10 p-4">
                      <h2 className="text-lg font-semibold">Menu</h2>
                      <button onClick={toggleMobileMenu} className="rounded-2xl border border-white/10 bg-white/5 p-1 text-[var(--blueprint-foreground)] transition hover:border-white/20 hover:bg-white/10">
                          <X className="h-6 w-6" />
                      </button>
                    </div>
                    <div className="flex-grow space-y-4 overflow-y-auto p-4">
                        {navLinks.map((link) => (
                            <div key={link.label}>
                            {link.dropdown ? (
                                <div>
                                <h3 className="block w-full rounded-2xl px-3 py-2 text-left text-lg font-semibold text-[var(--blueprint-foreground)]">
                                    {link.label}
                                </h3>
                                <div className="ml-3 border-l-2 border-white/10 pl-4">
                                    {link.dropdown.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="block rounded-2xl px-3 py-2 text-base font-medium text-[rgba(230,241,255,0.7)] transition hover:bg-white/10"
                                    >
                                        {item.label}
                                    </Link>
                                    ))}
                                </div>
                                </div>
                            ) : (
                                <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className="block rounded-2xl px-3 py-2 text-lg font-semibold text-[rgba(230,241,255,0.8)] transition hover:bg-white/10"
                                >
                                {link.label}
                                </Link>
                            )}
                            </div>
                        ))}
                    </div>
                </motion.div>
            </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
