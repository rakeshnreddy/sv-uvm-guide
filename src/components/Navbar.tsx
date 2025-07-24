"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/ui/Logo";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

const navLinks = [
  {
    label: "Curriculum",
    href: "/curriculum",
    dropdown: [
      { href: "/curriculum/T1_Foundational/F1_Why_Verification/index", label: "Tier 1: Foundational" },
      { href: "/curriculum/T2_Intermediate/I-SV-1_OOP/index", label: "Tier 2: Intermediate" },
      { href: "/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/index", label: "Tier 3: Advanced" },
      { href: "/curriculum/T4_Expert/E-CUST-1_UVM_Methodology_Customization/index", label: "Tier 4: Expert" },
    ],
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
  { href: "/history", label: "History" },
  { href: "/resources", label: "Resources" },
  { href: "/projects", label: "Projects" },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggleNavbar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 50, delay: 0.2 }}
      className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/">
              <Logo />
            </Link>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            {navLinks.map((link) =>
              link.dropdown ? (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(link.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button className="transition-colors hover:text-foreground/80 text-foreground/60 flex items-center">
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
                  className="transition-colors hover:text-foreground/80 text-foreground/60"
                >
                  {link.label}
                </Link>
              )
            )}
          </div>
          <ThemeSwitcher />
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleNavbar}
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-brand-text-primary hover:text-accent focus:outline-none"
              aria-controls="mobile-menu"
              aria-expanded={isOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="md:hidden"
            id="mobile-menu"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navLinks.map((link) => (
                <div key={link.label}>
                  {link.dropdown ? (
                    <div>
                      <button className="w-full text-left text-brand-text-primary hover:text-accent block px-3 py-2 rounded-md text-base font-medium transition-colors">
                        {link.label}
                      </button>
                      <div className="pl-4">
                        {link.dropdown.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className="text-brand-text-primary hover:text-accent block px-3 py-2 rounded-md text-base font-medium transition-colors"
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
                      onClick={() => setIsOpen(false)}
                      className="text-brand-text-primary hover:text-accent block px-3 py-2 rounded-md text-base font-medium transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
