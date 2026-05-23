import { createTheme, alpha } from '@mui/material/styles';

const sidebarBackground = '#0f172a';
const sidebarText = '#e2e8f0';
const sidebarTextMuted = '#94a3b8';
const brandAccent = '#3b82f6';

// Enterprise MUI theme for the ontology dashboard.
export const enterpriseTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1d4ed8',
      dark: '#1e3a8a',
      light: '#3b82f6',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#475569',
      light: '#64748b',
      dark: '#334155',
    },
    background: {
      default: '#f1f5f9',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
    },
    divider: '#e2e8f0',
    success: { main: '#059669' },
    warning: { main: '#d97706' },
    error: { main: '#dc2626' },
    info: { main: '#0284c7' },
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
      letterSpacing: '-0.02em',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.0625rem',
    },
    subtitle1: {
      fontWeight: 500,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#cbd5e1 transparent',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#0f172a',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: sidebarBackground,
          color: sidebarText,
          borderRight: 'none',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginLeft: 8,
          marginRight: 8,
          marginBottom: 2,
          color: sidebarTextMuted,
          '& .MuiListItemIcon-root': {
            color: sidebarTextMuted,
            minWidth: 40,
          },
          '&:hover': {
            backgroundColor: alpha('#ffffff', 0.06),
            color: sidebarText,
            '& .MuiListItemIcon-root': {
              color: sidebarText,
            },
          },
          '&.Mui-selected': {
            backgroundColor: alpha(brandAccent, 0.18),
            color: '#ffffff',
            borderLeft: `3px solid ${brandAccent}`,
            paddingLeft: 13,
            '& .MuiListItemIcon-root': {
              color: '#93c5fd',
            },
            '&:hover': {
              backgroundColor: alpha(brandAccent, 0.24),
            },
          },
        },
      },
    },
    MuiListSubheader: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          color: sidebarTextMuted,
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          lineHeight: 2.5,
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#f8fafc',
          '& .MuiTableCell-root': {
            fontWeight: 600,
            color: '#475569',
            fontSize: '0.8125rem',
            borderBottom: '1px solid #e2e8f0',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': {
            borderBottom: 0,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
        },
        contained: {
          boxShadow: '0 1px 2px rgba(29, 78, 216, 0.2)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
        },
      },
    },
  },
});

export const sidebarPalette = {
  background: sidebarBackground,
  text: sidebarText,
  textMuted: sidebarTextMuted,
  accent: brandAccent,
};
