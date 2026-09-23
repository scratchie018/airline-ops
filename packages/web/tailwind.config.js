/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Sampled directly from the provided TUI logo (sky-blue background,
        // #5ACBF5) - 400 is that exact swatch, 500/600 are deepened a bit
        // from it so white text on buttons still has real contrast.
        brand: {
          50: "#eafbff",
          100: "#cdf3ff",
          200: "#9fe7fc",
          300: "#6bd8f9",
          400: "#5acbf5",
          500: "#29aee0",
          600: "#1b8ebd",
          700: "#146d93",
          800: "#0f5170",
          900: "#0a3a50",
        },
        // The logo's red smile-mark (#D50E15) - used sparingly, e.g. destructive
        // action hovers, not as a second primary action color (that's brand.*).
        tuired: {
          50: "#fdecec",
          400: "#e23f3f",
          500: "#d50e15",
          600: "#b50a10",
          700: "#8f080c",
        },
        // The app's dark theme: bg = page background, accent = card/surface
        // background, outline = the lavender border/divider color used everywhere
        // at reduced opacity (outline/20, outline/40 etc.) rather than full
        // strength, so it reads as a subtle line, not a glowing edge.
        bg: "#0f1021",
        accent: "#171933",
        outline: "#c2c6ff",
        ink: {
          // Text colors tuned for the dark bg - DEFAULT is near-white body text,
          // muted is the lavender-tinted secondary/caption tone.
          DEFAULT: "#e8e9fb",
          muted: "#8f93c9",
        },
      },
      // Every bare `border`/`border-t`/`border-b`/`divide-y` class across the app
      // (there are a lot of them) picks up the lavender outline color at low
      // opacity automatically from this, instead of needing an explicit color
      // utility added to every single one individually.
      borderColor: {
        DEFAULT: "rgb(194 198 255 / 0.18)",
      },
      divideColor: {
        DEFAULT: "rgb(194 198 255 / 0.18)",
      },
    },
  },
  plugins: [],
};
