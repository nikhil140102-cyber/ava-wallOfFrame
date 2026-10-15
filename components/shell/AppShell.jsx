"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppProvider, useApp } from "./AppContext";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { RecognizeSheet } from "./RecognizeSheet";
import { TabBar } from "./TabBar";
import { ShortcutsSheet } from "./ShortcutsSheet";
import { Icon } from "../Icon";

function UrlSignals() {
  const params = useSearchParams();
  const router = useRouter();
  const { openRecognize, toast } = useApp();
  useEffect(() => {
    if (params.get("recognize")) {
      openRecognize(params.get("to") ? [params.get("to")] : []);
      router.replace(window.location.pathname);
    }
    if (params.get("denied")) {
      toast("You don't have access to that page.", { tone: "error" });
      router.replace(window.location.pathname);
    }
  }, [params, openRecognize, toast, router]);
  return null;
}

function Frame({ children }) {
  const [open, setOpen] = useState(false);
  const { openPalette } = useApp();
  return (
    <div className="shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="main">
        <header className="mobile-bar">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Icon name="sidebar" size={20} />
          </button>
          <b>Wall of Frames</b>
          <button className="icon-btn" onClick={openPalette} aria-label="Search">
            <Icon name="search" size={20} />
          </button>
        </header>
        {children}
      </div>
      <TabBar onMore={() => setOpen(true)} />
      <CommandPalette />
      <RecognizeSheet />
      <ShortcutsSheet />
      <Suspense>
        <UrlSignals />
      </Suspense>
    </div>
  );
}

export function AppShell({ data, children }) {
  return (
    <AppProvider data={data}>
      <Frame>{children}</Frame>
    </AppProvider>
  );
}
