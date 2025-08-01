"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, PanelLeft, Search, Bell, UserCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/ui/Logo";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { useNavigation } from "@/contexts/NavigationContext";

const navLinks = [
  {
    label: "Curriculum",
    href: "/curriculum",
  },
  {
    label: "Practice",
    href: "/practice",
    dropdown: [
      { href: "/exercises", label: "Exercises" },
      { href: "/labs", label: "Labs" },
    ],
  },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/community", label: "Community" },
];

const UserProfileDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
            <button className="p-2 rounded-full hover:bg-muted" data-testid="user-profile-button">
                <UserCircle className="h-6 w-6" />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full right-0 mt-2 w-64 bg-background border border-border/40 rounded-md shadow-lg p-4"
                    >
                        <h4 className="font-semibold">Jane Doe</h4>
                        <p className="text-sm text-muted-foreground">Level 5: UVM Adept</p>
                        <div className="w-full bg-muted rounded-full h-2 my-2">
                            <div className="bg-primary h-2 rounded-full" style={{ width: '45%' }}></div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">45% to next level</p>
                        <div className="border-t border-border/40 -mx-4 my-2"></div>
                        <Link href="/dashboard" className="block px-2 py-1.5 text-sm hover:bg-muted rounded-md">Dashboard</Link>
                        <Link href="/settings" className="block px-2 py-1.5 text-sm hover:bg-muted rounded-md">Settings</Link>
                        <button className="w-full text-left mt-1 px-2 py-1.5 text-sm hover:bg-muted rounded-md">Sign Out</button>
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
             <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-full hover:bg-muted relative" data-testid="notification-button">
                <Bell className="h-6 w-6" />
                <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-primary ring-2 ring-background"></span>
            </button>
             <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full right-0 mt-2 w-80 bg-background border border-border/40 rounded-md shadow-lg"
                    >
                        <div className="p-3 font-semibold border-b border-border/40 text-sm">Notifications</div>
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            <p className="font-semibold mb-1">Achievement Unlocked!</p>
                            <p className="text-xs">You completed the 'UVM Basics' module.</p>
                        </div>
                         <div className="border-t border-border/40 p-2 text-center">
                            <Link href="/notifications" className="text-xs text-primary hover:underline">View all</Link>
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
      className="sticky top-0 z-30 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Section */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-md hover:bg-muted hidden md:inline-flex"
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
          <div className="hidden md:flex flex-grow justify-center items-center px-8">
            <div className="relative w-full max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input type="text" placeholder="Search... (Ctrl+K)" className="w-full pl-11 pr-4 py-2 border text-sm border-border/40 rounded-lg bg-background focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all"/>
            </div>
          </div>

          {/* Right Section */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) =>
              link.dropdown ? (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(link.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button className="transition-colors text-sm hover:text-foreground/80 text-foreground/60 flex items-center px-3 py-2 rounded-md">
                    {link.label}
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </button>
                  <AnimatePresence>
                    {openDropdown === link.label && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full mt-2 w-48 bg-background border border-border/40 rounded-md shadow-lg"
                      >
                        {link.dropdown.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="block px-4 py-2 text-sm text-foreground/80 hover:bg-muted"
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
                  className="transition-colors text-sm hover:text-foreground/80 text-foreground/60 px-3 py-2 rounded-md"
                >
                  {link.label}
                </Link>
              )
            )}
            <div className="h-6 border-l border-border/40 mx-2"></div>
            <ThemeSwitcher />
            <NotificationCenter />
            <UserProfileDropdown />
          </div>

          {/* Mobile UI */}
          <div className="md:hidden flex items-center gap-1">
             <button
              onClick={toggleSidebar}
              type="button"
              className="p-2 rounded-full hover:bg-muted"
            >
              <PanelLeft className="h-6 w-6" />
              <span className="sr-only">Open sidebar</span>
            </button>
            <button className="p-2 rounded-full hover:bg-muted">
                <Search className="h-6 w-6" />
            </button>
            <button
              onClick={toggleMobileMenu}
              type="button"
              className="p-2 rounded-full hover:bg-muted"
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
                    className="fixed inset-0 bg-black/60 z-40 md:hidden"
                    onClick={toggleMobileMenu}
                />
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="fixed top-0 right-0 h-full w-4/5 max-w-sm bg-background z-50 shadow-lg flex flex-col"
                >
                    <div className="p-4 flex justify-between items-center border-b border-border/40">
                      <h2 className="text-lg font-semibold">Menu</h2>
                      <button onClick={toggleMobileMenu} className="p-1 rounded-md hover:bg-muted">
                          <X className="h-6 w-6" />
                      </button>
                    </div>
                    <div className="flex-grow overflow-y-auto p-4 space-y-4">
                        {navLinks.map((link) => (
                            <div key={link.label}>
                            {link.dropdown ? (
                                <div>
                                <h3 className="w-full text-left text-lg font-semibold block px-3 py-2 rounded-md">
                                    {link.label}
                                </h3>
                                <div className="pl-4 border-l-2 border-border/40 ml-3">
                                    {link.dropdown.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="block px-3 py-2 rounded-md text-base font-medium transition-colors hover:bg-muted"
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
                                className="block px-3 py-2 rounded-md text-lg font-semibold transition-colors hover:bg-muted"
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
