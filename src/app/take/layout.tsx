import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Isi Kuesioner — UMKM Connect",
};

export default function TakeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
