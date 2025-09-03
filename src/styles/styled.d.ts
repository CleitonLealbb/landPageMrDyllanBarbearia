// styled.d.ts
import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme extends ThemeType{ 
    colors: {
    colorBlack: string,
    colorWhite:string,
    corSecundaria: string,
    corItens: string,
    corSection: string,
    corTerceira:string,
    corDegrade1: string,
    corDegrade2: string
    };
  }
}

export type ThemeType = typeof theme;
