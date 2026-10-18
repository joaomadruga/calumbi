import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Calumbi · Gestão da fazenda",
  description:
    "O seu rebanho, o seu investimento e o futuro da sua fazenda em um só lugar.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
