import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        toss: {
          blue: '#3182F6',
          'blue-hover': '#1B6EF3',
          gray: '#6B7684',
          'gray-light': '#ADB5BD',
          border: '#E5E8EB',
          'bg-input': '#F9FAFB',
          text: '#191F28',
          red: '#F04452',
        },
      },
      fontFamily: {
        pretendard: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
