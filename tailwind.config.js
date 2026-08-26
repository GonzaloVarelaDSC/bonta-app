/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Inter: tipografía funcional para toda la UI (tablas, badges, formularios,
        // kanban, números de KPI). Elegida por legibilidad a tamaños chicos, cifras
        // tabulares nativas y alto contraste de trazo — prioridad sobre matchear la
        // identidad de la web pública, que es una pieza de marca, no una herramienta
        // de uso diario. `display` queda como alias semántico (mismos títulos de
        // página) por si en el futuro se le quiere dar un tratamiento distinto.
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        // Solo para el wordmark "Estudio Bonta" y la frase de marca del login —
        // un guiño a la identidad del estudio sin comprometer la lectura funcional.
        brand: ['"Cormorant Garamond"', 'system-ui', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Rampa neutra tomada de tokens.css del sitio (--color-neutral-*), con 950 propio
        // (más oscuro que el 900 de la web) para mantener el contraste de la sidebar oscura.
        ink: {
          950: '#1a1817',
          900: '#2d2b2b',
          800: '#444141',
          700: '#605d5d',
          600: '#7d7979',
          500: '#9b9797',
          400: '#bab6b6',
          300: '#d7d3d3',
          200: '#eae7e7',
          100: '#f0eded',
          50: '#f8f4f4',
        },
        // Acento bronce/dorado de la web (--color-accent / --color-accent-*), reemplaza el
        // verde anterior.
        brand: {
          700: '#5a3b0a',
          600: '#7d5411',
          500: '#a06f24',
          400: '#c28d41',
          300: '#e1ad66',
          100: '#fff3e4',
        },
        crit: { DEFAULT: '#e0393e', bg: '#fdecec', text: '#8f1d21' },
        urg: { DEFAULT: '#e8792e', bg: '#fef1e6', text: '#93430f' },
        norm: { DEFAULT: '#d1a417', bg: '#fdf6e0', text: '#7a5c05' },
        plan: { DEFAULT: '#2f9e5a', bg: '#e7f6ed', text: '#1a6538' },
        wait: { DEFAULT: '#8891a0', bg: '#eef0f3', text: '#4a5568' },
        // Azul "en curso" — para que el estado de un trabajo se distinga de un
        // vistazo del resto (gris = no arrancado, azul = en curso, verde = listo,
        // rojo/naranja = necesita atención), como en Linear/GitHub/Trello.
        info: { DEFAULT: '#3068e0', bg: '#eaf1fd', text: '#1d4ed8' },
        // Violeta y verde azulado agregados para darle identidad de color propia a
        // cada columna del Kanban (antes solo había 3 tonos para 7 columnas) — no
        // llevan carga de "alarma" como crit/urg, son solo identidad visual.
        review: { DEFAULT: '#8454d6', bg: '#f3eefc', text: '#5b32a8' },
        site: { DEFAULT: '#0f9488', bg: '#e6f7f5', text: '#0b6d63' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,32,0.06), 0 1px 1px rgba(15,23,32,0.04)',
        pop: '0 12px 32px rgba(15,23,32,0.16), 0 2px 8px rgba(15,23,32,0.08)',
      },
    },
  },
  plugins: [],
}
