import { useEffect } from 'react';

/**
 * Keyboard shortcuts for the application
 * Ctrl+N - New case
 * Ctrl+P - Open phishing analyzer
 * Ctrl+D - Open analytics dashboard
 * Ctrl+H - Open help
 * Ctrl+K - Focus search/command input
 * Escape - Close modals/menus
 */

export function useKeyboardShortcuts({
  onNewCase,
  onOpenPhishing,
  onOpenAnalytics,
  onOpenHelp,
  onFocusInput,
  onEscape,
  enabled = true,
}) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event) {
      // Check if user is typing in an input field
      const isInputField =
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.isContentEditable;

      // Handle Escape key (always works)
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }

      // Don't trigger shortcuts when typing in input fields (except Ctrl+K)
      if (isInputField && !(event.ctrlKey || event.metaKey)) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      if (modifierKey) {
        switch (event.key.toLowerCase()) {
          case 'n':
            if (onNewCase) {
              event.preventDefault();
              onNewCase();
            }
            break;
          case 'p':
            if (onOpenPhishing) {
              event.preventDefault();
              onOpenPhishing();
            }
            break;
          case 'd':
            if (onOpenAnalytics) {
              event.preventDefault();
              onOpenAnalytics();
            }
            break;
          case 'h':
            if (onOpenHelp) {
              event.preventDefault();
              onOpenHelp();
            }
            break;
          case 'k':
            if (onFocusInput) {
              event.preventDefault();
              onFocusInput();
            }
            break;
          default:
            break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onNewCase, onOpenPhishing, onOpenAnalytics, onOpenHelp, onFocusInput, onEscape]);
}

/**
 * Screen reader announcements hook
 */
export function useScreenReaderAnnouncement() {
  useEffect(() => {
    // Create a live region for screen reader announcements if it doesn't exist
    let liveRegion = document.getElementById('sr-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'sr-live-region';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      document.body.appendChild(liveRegion);
    }
  }, []);

  return function announce(message) {
    const liveRegion = document.getElementById('sr-live-region');
    if (liveRegion) {
      liveRegion.textContent = message;
      // Clear after announcement
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 1000);
    }
  };
}

/**
 * Skip to main content link component
 */
export function SkipToMainContent() {
  return (
    <a
      href="#main-content"
      className="skip-to-main"
      style={{
        position: 'absolute',
        left: '-10000px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        zIndex: 10000,
      }}
      onFocus={(e) => {
        e.target.style.position = 'fixed';
        e.target.style.left = '10px';
        e.target.style.top = '10px';
        e.target.style.width = 'auto';
        e.target.style.height = 'auto';
        e.target.style.padding = '10px';
        e.target.style.background = 'var(--blue)';
        e.target.style.color = 'white';
        e.target.style.borderRadius = '4px';
      }}
      onBlur={(e) => {
        e.target.style.position = 'absolute';
        e.target.style.left = '-10000px';
        e.target.style.top = 'auto';
        e.target.style.width = '1px';
        e.target.style.height = '1px';
        e.target.style.padding = '0';
      }}
    >
      Skip to main content
    </a>
  );
}
