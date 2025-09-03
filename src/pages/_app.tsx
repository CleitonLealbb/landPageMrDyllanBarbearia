// pages/_app.tsx
import type { AppProps } from "next/app";
import { ThemeProvider } from "styled-components";
import { theme } from "../styles/theme";
import { GlobalStyle } from "../styles/globals";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
   <>
      <GlobalStyle />
      <Component {...pageProps} />
   </>
  
  );
}
