import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  title: "Mr Dyllan Barbearia",
  description:
    "Barbearia premium com cortes, barba e agendamento online em uma experiência moderna.",
  keywords: [
    "Barbearia",
    "Corte de cabelo",
    "Barba",
    "Estilo masculino",
    "Agendamento online",
    "Barbearia moderna",
    "Barbearia premium",
    "Nova Xavantina",
  ],
  authors: [{ name: "Mr Dyllan Barbearia" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
