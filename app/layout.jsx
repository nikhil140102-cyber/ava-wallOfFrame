import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/caveat/500.css";
import "@fontsource/caveat/700.css";
import "@fontsource/bricolage-grotesque/600.css";
import "@fontsource/bricolage-grotesque/700.css";
import "@fontsource/bricolage-grotesque/800.css";
// Fonts for all 22 Indian languages. Each only downloads when its script is on screen (unicode-range).
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/700.css";
import "@fontsource/noto-sans-bengali/400.css";
import "@fontsource/noto-sans-bengali/700.css";
import "@fontsource/noto-sans-gujarati/400.css";
import "@fontsource/noto-sans-gujarati/700.css";
import "@fontsource/noto-sans-gurmukhi/400.css";
import "@fontsource/noto-sans-gurmukhi/700.css";
import "@fontsource/noto-sans-kannada/400.css";
import "@fontsource/noto-sans-kannada/700.css";
import "@fontsource/noto-sans-malayalam/400.css";
import "@fontsource/noto-sans-malayalam/700.css";
import "@fontsource/noto-sans-oriya/400.css";
import "@fontsource/noto-sans-oriya/700.css";
import "@fontsource/noto-sans-tamil/400.css";
import "@fontsource/noto-sans-tamil/700.css";
import "@fontsource/noto-sans-telugu/400.css";
import "@fontsource/noto-sans-telugu/700.css";
import "@fontsource/noto-sans-ol-chiki/400.css";
import "@fontsource/noto-sans-ol-chiki/700.css";
import "@fontsource/noto-sans-meetei-mayek/400.css";
import "@fontsource/noto-sans-meetei-mayek/700.css";
import "@fontsource/noto-nastaliq-urdu/400.css";
import "@fontsource/noto-nastaliq-urdu/700.css";
import "@fontsource/noto-naskh-arabic/400.css";
import "@fontsource/noto-naskh-arabic/700.css";
import "./globals.css";
import "./shell.css";
import "./pages.css";
import "./frame.css";
import "./scripts.css";
import "./language.css";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/I18nProvider";
import { localeInfo } from "@/lib/i18n/locales";

export const metadata = {
  title: { default: "Wall of Frames", template: "%s · Wall of Frames" },
  description: "AvaZone Wall of Frames — recognise great work across the company.",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e6e9f2" },
    { media: "(prefers-color-scheme: dark)", color: "#070b17" },
  ],
};

export default async function RootLayout({ children }) {
  const user = await getCurrentUser();
  // Signed in: the person's saved choice. Signed out: the last choice on this device.
  const saved = user?.theme ?? (await cookies()).get("wof_theme")?.value;
  const theme = saved === "light" || saved === "dark" ? saved : undefined;
  const { locale, dir, messages, fmtData } = await getI18n();
  const script = localeInfo(locale).script;
  return (
    <html lang={locale} dir={dir} data-theme={theme} data-script={script}>
      <body>
        <I18nProvider locale={locale} messages={messages} fmtData={fmtData}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
