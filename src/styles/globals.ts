// styles/globals.ts
import { createGlobalStyle } from "styled-components";
import { theme } from "./theme";

export type ThemeType = typeof theme;

export const GlobalStyle = createGlobalStyle`
  :root {
    --cor-black: #000000ff;
    --cor-white: #ffffffff;

  }

  @media (prefers-color-scheme: dark) {
    :root {
      --background-black: #0a0a0a;
      --foreground-white: #ededed;
    }
  }

  html,
  body {
    max-width: 100vw;
    overflow-x: hidden;
  }

  body {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;

    background-color: ${({ theme }) => theme.colors.colorBack};
    color: ${({ theme }) => theme.colors.colorWhite};

  }

  a {
    color: inherit;
    text-decoration: none;
  }

  * {
    box-sizing: border-box;
    padding: 0;
    margin: 0;
  }
`;
