"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { ThemeProvider as StyledThemeProvider } from "styled-components";
import { theme } from "@/styles/theme";

interface ThemeContextProps {
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeContext must be used inside ThemeProvider");
  }
  return context;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState(theme);

  const toggleTheme = () => {
    setCurrentTheme((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        colorBlack: prev.colors.colorBlack === "#fff" ? "#000" : "#fff",
        colorWhite: prev.colors.colorWhite === "#000" ? "#fff" : "#000",
        corSecundaria: prev.colors.corSecundaria === "#1A1A1A" ? "#E0E0E0" : "#1A1A1A",
        corItens: prev.colors.corItens === "#B8A169" ? "#7B5E1E" : "#B8A169",
        corTerceira: prev.colors.corTerceira === "#303030" ? "#C0C0C0" : "#303030",
        corSection: prev.colors.corSection === "#11161C" ? "#E0E0E0" : "#11161C",
        corDegrade1: prev.colors.corDegrade1 === "linear-gradient(0deg, rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.25))"
          ? "linear-gradient(0deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.25))"
          : "linear-gradient(0deg, rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.25))",
        corDegrade2: prev.colors.corDegrade2 === "linear-gradient(0deg, rgb(17, 22, 28), rgba(17, 22, 28, 0.949))"
          ? "linear-gradient(0deg, rgb(224, 224, 224), rgba(224, 224, 224, 0.949))" 
          : "linear-gradient(0deg, rgb(17, 22, 28), rgba(17, 22, 28, 0.949))",
        
      },
    }));
  };

  return (
    <ThemeContext.Provider value={{ toggleTheme }}>
      <StyledThemeProvider theme={currentTheme}>
        {children}
      </StyledThemeProvider>
    </ThemeContext.Provider>
  );
}
