import { createContext, useContext, useEffect, useState } from 'react';

const DarkModeContext = createContext();

// Three themes: 'light', 'grey' (the original dark mode — soft charcoal, not
// pure black), and 'amoled' (true black, for OLED screens / users who find
// 'grey' too dark). Stored under a new key so the old boolean 'darkMode'
// value doesn't half-migrate; existing dark-mode users flip to 'grey'.
const THEMES = ['light', 'grey', 'amoled'];

function readInitialTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (THEMES.includes(saved)) return saved;
    // Back-compat with the old boolean flag from before themes existed.
    if (localStorage.getItem('darkMode') === 'true') return 'grey';
  } catch {}
  return 'light';
}

export function DarkModeProvider({ children }) {
  const [theme, setTheme] = useState(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme !== 'light');
    root.classList.toggle('amoled', theme === 'amoled');
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  function cycle() {
    setTheme(t => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]);
  }

  return (
    <DarkModeContext.Provider value={{
      theme,
      setTheme,
      dark: theme !== 'light',
      toggle: cycle,
    }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  return useContext(DarkModeContext);
}
