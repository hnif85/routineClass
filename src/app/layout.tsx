import type { Metadata } from "next";
import { getAppConfig } from "@/lib/config/app-config";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, AppLayout } from "@/components/layout/sidebar-context";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getAppConfig();
  return {
    title: config.meta_title,
    description: config.meta_description,
    icons: { icon: config.favicon_url },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const config = await getAppConfig();
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --font-sora: 'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            --font-jakarta: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
        `}</style>
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SidebarProvider>
          <AppLayout config={config}>{children}</AppLayout>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
