import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/caveat/500.css";
import "@fontsource/caveat/700.css";
import "@fontsource/bricolage-grotesque/600.css";
import "@fontsource/bricolage-grotesque/700.css";
import "@fontsource/bricolage-grotesque/800.css";
import "./globals.css";
import "./shell.css";
import "./pages.css";
import "./frame.css";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
  title: { default: "Wall of Frames", template: "%s · Wall of Frames" },
  description: "AvaZone Wall of Frames — recognise great work across the company.",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }) {
  const user = await getCurrentUser();
  const theme = user?.theme && user.theme !== "system" ? user.theme : undefined;
  return (
    <html lang="en" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
