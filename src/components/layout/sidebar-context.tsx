"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./header";

interface SidebarCtx {
  collapsed: boolean;
  toggle: () => void;
  sidebarWidth: number;
}

const SidebarContext = createContext<SidebarCtx>({
  collapsed: false,
  toggle: () => {},
  sidebarWidth: 264,
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? 48 : 264;

  const toggle = useCallback(() => setCollapsed(prev => !prev), []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, sidebarWidth }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function AppLayout({ config, children }: { config: any; children: React.ReactNode }) {
  const { collapsed, sidebarWidth } = useSidebar();
  const pathname = usePathname();

  // Pages without sidebar: login, participant test portal, UMKM portal
  const noSidebarPaths = ["/login", "/take/", "/portal"];
  const hideSidebar = noSidebarPaths.some((p) => pathname.startsWith(p));

  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <div
      className="app-layout"
      style={{
        display: 'grid',
        gridTemplateColumns: `${sidebarWidth}px 1fr`,
        minHeight: '100vh',
        transition: 'grid-template-columns 0.3s ease',
      }}
    >
      <Sidebar config={config} />
      <div className="flex flex-col min-w-0" style={{ overflow: 'hidden' }}>
        <Topbar config={config} />
        <main className="flex-1" style={{ padding: '26px 30px calc(48px + env(safe-area-inset-bottom, 0px))' }}>{children}</main>
      </div>
    </div>
  );
}
