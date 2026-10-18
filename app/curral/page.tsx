import type { Metadata } from "next";
import Dashboard from "@/components/dashboard";

export const metadata: Metadata = { title: "Curral · Fazenda Calumbi" };

export default function CorralPage() {
  return <Dashboard initialTab="curral" />;
}
