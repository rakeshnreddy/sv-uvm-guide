"use client";

import { useEffect } from 'react';
import { useNavigation } from '@/contexts/NavigationContext';
import { useRouter } from 'next/navigation';

export const useKeyboardShortcuts = () => {
  const { toggleSidebar } = useNavigation();
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Allow shortcuts only when not typing in an input field, textarea, etc.
      const target = event.target as HTMLElement;
      const isTyping = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

      if (isTyping && event.key !== 'Escape') {
          // Allow escape key to bubble up from inputs, for example to close modals.
          return;
      }

      // Toggle Sidebar with Ctrl+B (or Cmd+B on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        toggleSidebar();
      }

      // Focus search bar with Ctrl+K
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }

      // Navigation shortcuts
      if (event.altKey) {
        switch(event.key) {
            case '1':
                event.preventDefault();
                router.push('/curriculum');
                break;
            case '2':
                event.preventDefault();
                router.push('/practice');
                break;
            case '3':
                event.preventDefault();
                router.push('/dashboard');
                break;
             case 'c':
                event.preventDefault();
                router.push('/community');
                break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleSidebar, router]);
};
