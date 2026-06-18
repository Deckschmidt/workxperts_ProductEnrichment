import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Sicherheitszustand-Farben fürs Cockpit
        live: "#dc2626",
        dry: "#16a34a",
      },
    },
  },
  plugins: [],
} satisfies Config;
