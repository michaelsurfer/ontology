import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const COLOR_MODE_STORAGE_KEY = 'ontology-color-mode'

const ColorModeContext = createContext({
  colorMode: 'light',
  toggleColorMode: () => {},
  setColorMode: () => {},
})

/* Persisted light/dark preference for the whole app shell. */
export function ColorModeProvider({ children }) {
  const [colorMode, setColorMode] = useState(() => {
    try {
      const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY)
      if (stored === 'dark' || stored === 'light') {
        return stored
      }
    } catch (error) {
      /* ignore */
    }
    return 'light'
  })

  useEffect(() => {
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode)
    } catch (error) {
      /* ignore */
    }
  }, [colorMode])

  const toggleColorMode = () => {
    setColorMode((previous) => (previous === 'light' ? 'dark' : 'light'))
  }

  const value = useMemo(
    () => ({
      colorMode,
      setColorMode,
      toggleColorMode,
    }),
    [colorMode],
  )

  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>
}

export function useColorMode() {
  return useContext(ColorModeContext)
}
