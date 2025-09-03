import type { Metadata } from "next";
import { ThemeProvider } from "@/context/ThemeProvider";

import "../styles/globals.css";

export const metadata: Metadata = {
  icons: {
    icon: "./favicon.ico",
    shortcut: "./favicon.ico",
    apple: "./favicon.ico",
  },
  title: "Mr Dyllan Barbearia",
  description: "Barbearia AI - Corte de cabelo e barba com estilo e tecnologia de ponta.",
  keywords: [
    "Barbearia",
    "Corte de cabelo",
    "Barba",
    "Estilo",
    "Tecnologia",
    "Agendamento online",
    "Serviços de barbearia",
    "Tendências de cabelo",
    "Cuidados com a barba",
    "Barbearia moderna",
    "Cortes personalizados",
    "Atendimento profissional",
    "Barbearia urbana",
    "Estilo masculino",
    "Cortes de cabelo modernos",
    "Barbearia de luxo",
    "Tendências de barba",
    "Cortes de cabelo clássicos",
    "Barbearia tradicional",
    "Cortes de cabelo criativos",
  ],
  authors: [{ name: "Barbearia AI", url: "https://barbeariaai.com" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
