import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
}

const theme = extendTheme({
  config,
  fonts: {
    body: "'Iosevka-Aile', system-ui, -apple-system, 'Segoe UI', sans-serif",
    heading: "'Iosevka-Aile', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'Iosevka-Aile', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
  colors: {
    tempo: {
      bg: '#1d1d1d',
      panel: '#232323',
      panelStrong: '#2a2a2a',
      text: '#e4e4e4',
      muted: '#b3b3b3',
      border: '#2a2a2a',
      accent: '#38cfff',
      success: '#7affb4',
      warning: '#ffc538',
    },
  },
  styles: {
    global: {
      '@font-face': [
        {
          fontFamily: 'Iosevka-Aile',
          src: "url('/fonts/Iosevka-Aile-01.ttf') format('truetype')",
          fontWeight: '400',
          fontStyle: 'normal',
          fontDisplay: 'swap',
        },
        {
          fontFamily: 'Iosevka-Aile',
          src: "url('/fonts/Iosevka-Aile-Italic-03.ttf') format('truetype')",
          fontWeight: '400',
          fontStyle: 'italic',
          fontDisplay: 'swap',
        },
        {
          fontFamily: 'Iosevka-Aile',
          src: "url('/fonts/Iosevka-Aile-Oblique-02.ttf') format('truetype')",
          fontWeight: '400',
          fontStyle: 'oblique',
          fontDisplay: 'swap',
        },
      ],
      body: {
        bg: 'tempo.bg',
        color: 'tempo.text',
        scrollbarColor: '#2a2a2a transparent',
        scrollbarWidth: 'thin',
      },
      '::-webkit-scrollbar': {
        width: '10px',
        height: '10px',
      },
      '::-webkit-scrollbar-track': {
        backgroundColor: 'rgba(255,255,255,0.03)',
      },
      '::-webkit-scrollbar-thumb': {
        backgroundColor: '#2a2a2a',
        borderRadius: '8px',
        border: '2px solid #1d1d1d',
      },
      '::-webkit-scrollbar-thumb:hover': {
        backgroundColor: '#38cfff',
        borderColor: '#1d1d1d',
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: '6px',
        fontWeight: '600',
      },
      variants: {
        solid: {
          bg: 'tempo.accent',
          color: '#0d0d0d',
          _hover: { filter: 'brightness(1.05)' },
        },
        outline: {
          borderColor: 'tempo.border',
          color: 'tempo.text',
          _hover: { borderColor: 'tempo.accent', color: 'tempo.accent' },
        },
      },
    },
    Input: {
      variants: {
        tempo: {
          field: {
            bg: 'tempo.bg',
            borderRadius: '6px',
            border: '1px solid',
            borderColor: 'tempo.border',
            _focus: {
              borderColor: 'tempo.accent',
              boxShadow: '0 0 0 1px var(--chakra-colors-tempo-accent)',
            },
          },
        },
      },
      defaultProps: { variant: 'tempo' },
    },
    Textarea: {
      variants: {
        tempo: {
          borderRadius: '6px',
          border: '1px solid',
          borderColor: 'tempo.border',
          bg: 'tempo.bg',
          _focus: {
            borderColor: 'tempo.accent',
            boxShadow: '0 0 0 1px var(--chakra-colors-tempo-accent)',
          },
        },
      },
      defaultProps: { variant: 'tempo' },
    },
    Select: {
      variants: {
        tempo: {
          field: {
            borderRadius: '6px',
            border: '1px solid',
            borderColor: 'tempo.border',
            bg: 'tempo.bg',
            _focus: {
              borderColor: 'tempo.accent',
              boxShadow: '0 0 0 1px var(--chakra-colors-tempo-accent)',
            },
          },
        },
      },
      defaultProps: { variant: 'tempo' },
    },
  },
})

export default theme
