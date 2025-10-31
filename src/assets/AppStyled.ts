"use client";
import Image from "next/image";
import styled from "styled-components";
import BgImagem from './image/Frame1.svg';
import { theme } from "../styles/theme";
import { wrap } from "module";

interface ItensHeaderProps {
  display?: string;
  flexDirection?: string;
}
interface TextTypesProps {
  fontSize?: string;
  marginTop?: string;
  $colorKey?: keyof typeof theme.colors;
  fontWeight?: string;
}
interface SectionProps {
  $colorKey?: keyof typeof theme.colors;
}

interface NumeroContatoProps {
  fontSize?: string;
  marginTop?: string;
  $colorKey?: keyof typeof theme.colors;
  fontWeight?: string;
}

export const Header = styled.div`
 position: fixed;
  height: 59px;
  max-height: 59px;
  width: 100%;
  background: ${({ theme }) => theme.colors.corTerceira};
  z-index: 9999;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  @media (max-width: 768px) {
    justify-content: space-between;
    position: fixed;
  }
  @media (max-width: 480px) { 
    justify-content: space-between;
    position: fixed;
  }
 
`;
export const ItensHeader = styled.div<ItensHeaderProps>`
  display: ${({ display }) => display || 'flex'};
  flex-direction: ${({ flexDirection }) => flexDirection || 'row'};
  align-items: center;
  justify-content: center;
  gap: 45px;
  flex: 1;
  z-index: 9999;

  @media (max-width: 768px) {
    display: ${({ display }) => display || 'none'};
    flex-direction: ${({ flexDirection }) => flexDirection || 'column'};
  }
`;

export const ItemHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
 @media (max-width: 768px) and (max-width: 480px) {
    flex-direction: column;
    justify-content: flex-end;
    align-items: flex-end;
  
 }
  
`;

export const TextHeader = styled.div`
text-decoration: none;
  font-size: 13px;
  color: #f5f5f7;
  font-family: 'Roboto', sans-serif;
  font-weight: 500;
  opacity: 0.8;
  cursor: pointer;
  letter-spacing: -.01em;
`;
export const Logo = styled(Image)`
width: 55px;
height: 55px;
margin-left: 10dvw;

@media (max-width: 768px) {
  width: 50px;
  height: 50px;

  
}
@media (max-width: 480px) {
  width: 45px;
  height: 45px;
 
 
}
`;


export const MobileMenuWrapper = styled.div`

  @media (min-width: 769px) {
      display: none;
    }
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 100%; 
    height: 60dvh;
    z-index: 9999;
    border-radius: 10px;
    background: ${({ theme }) => theme.colors.corTerceira};
    position: fixed;
    top: 90px;
    
  box-shadow: -2px 1px 18px 6px rgba(0, 0, 0, 0.55);
`;

export const Link = styled.a`

  text-decoration: none;
  font-size: 13px;
  color: #f5f5f7;
  font-family: 'Roboto', sans-serif;
  font-weight: 500;
  cursor: pointer;
  letter-spacing: -.01em;
  &:hover {
    opacity: 1;
    color: ${({ theme }) => theme.colors.corItens};
    border-bottom: 2px solid ${({ theme }) => theme.colors.corItens};
    transition:  0.3s ease, opacity 0.3s ease;
  } 
`;

export const Section = styled.section<SectionProps>`
  height: 100vh;
  width: 100%;
  justify-content: center;
  align-items: center;
  background-color: ${({ $colorKey, theme }) => $colorKey ? theme.colors[$colorKey] : theme.colors.colorBlack};
  @media (max-width: 768px) {
    height: 100dvh; /* força altura total da tela */
    width: 100%;
  }
  @media (max-width: 480px) {
    height: 100dvh; /* força altura total da tela */
    width: 100%;
  }
`;


export const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: row;
  height: 100vh; /* força altura total da tela */
  width: 100%;
  background-image: url(${BgImagem});
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
   @media (max-width: 768px) {
   width: 100%;
   height: 100dvh;
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center;
    background-position-x: 30%;
    
  }
  @media (max-width: 480px) {
    width: 100%;
    height: 100dvh;
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center;
    background-position-x: 35%;
  }
`;

export const InformationLeft = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-end;
    margin-bottom: 80px;
    margin-right: 250px;
    gap: 25px;
    width: 100%;
    height: 100vh;
  
    @media (max-width: 768px) {
      margin-left: 450px;
      margin-bottom: 60px;
      gap: 20px;
    }
    @media (max-width: 480px) {
      margin-left: 400px;
      margin-bottom: 40px;
      gap: 15px;
    }
  
`;

export const H1 = styled.h1<TextTypesProps>`
  font-size: ${(props) => props.fontSize || '60px'};
  color: ${({ $colorKey, theme }) => $colorKey ? theme.colors[$colorKey] : theme.colors.colorWhite};
  margin-top: ${(props) => props.marginTop || '70px'};
  font-weight: ${(props) => props.fontWeight || '700'};
  font-family: 'Roboto', sans-serif;
  letter-spacing: 0.05em;
  margin: 0;
  @media (max-width: 768px) {
    font-size: 45px;
    margin-top: 50px;
  } 
  @media (max-width: 480px) {
    font-size: 30px;
    margin-top: 30px;
  }

`;

export const P = styled.p<TextTypesProps>`

  font-size: 14px;
  color: ${({ $colorKey, theme }) => $colorKey ? theme.colors[$colorKey] : theme.colors.colorWhite};
  font-family: 'Roboto', sans-serif;
  font-weight: 700;
  margin: 5px;`;

export const SectionContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100dvh;
  width: 100%;
  background-color: ${({ theme }) => theme.colors.corTerceira};
  color: #f5f5f7;

  //border: 1px solid rgba(255, 1, 1, 0.67);
  @media(max-width: 768px) {
    height: 120dvh;
    width: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  @media(max-width: 480px) {
   height: 100dvh;
    width: 100%;
    flex-direction: column;
    align-items: center;
    
  }
  `;

export const Title = styled.h2`
 font-size: 1.8rem; /* padrão para telas grandes */
 
  @media (max-width: 768px) { 
    font-size: 1.5rem; /* para tablets */
    margin-left: 15px;

  }
  @media (max-width: 480px) {
    font-size: 1.2rem; /* para celulares */
    margin-left: 35px;
    margin-right: 35px;
  }
  `;

export const ContainerSobreNos = styled.div`
display: flex;
  flex-direction: row;
 justify-content: center;
  align-items: center;
  width: 100%;
  height: 100vh;
  gap: 20px;
 
  @media (max-width: 768px) {
    flex-direction: column;
    width: 100%;
    height: 100vh;
    
    }
  @media (max-width: 480px) {
    flex-direction: column;
    width: 100%;
    height: 100vh;
  }
  `;

export const ConteinerGrids = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  justify-content: center;
  align-items: center;

`;

export const GridItem = styled.div`
  display: flex;
  width: 300px;
  height: 200px;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.67);
  border-radius: 10px;
  justify-content: center;
  align-items: center;
  padding: 0px;
  background-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
  &:hover {
    transform: translateY(-10px);
  } 
  @media (max-width: 768px) {
    width: 250px;
    height: 150px;
    }
  @media (max-width: 480px) {
    width: 250px;
    height: 150px;
    }
`;

export const TitleGrid = styled.h3`
  font-size: 1.3rem;
  color: #f5f5f7;
  font-family: 'Roboto', sans-serif;
  font-weight: 400;
  text-align: center;
  margin: 0;
  display: flex;

  @media (max-width: 768px) {
    font-size: 0.85rem;
    margin: 0;
    }
  @media (max-width: 480px) {
    font-size: 0.85rem;
    margin: 0;
    }
  `;

  export const ImageGrid = styled(Image)`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 10px;
  @media (max-width: 768px) {
    width: 100%;
    height: 100%;
    }
  @media (max-width: 480px) {
    width: 100%;
    height: 100%;
    }
  `;
  export const NumeroContato = styled.p<NumeroContatoProps>`
  font-size: 16px;
  color:${({ $colorKey, theme }) => $colorKey ? theme.colors[$colorKey] : theme.colors.colorWhite};
  font-family: 'Roboto', sans-serif;
  font-weight: 700;
  margin: 5px;
  @media (max-width: 768px) {
    font-size: 12px;
    margin: 3px;
    }
    @media (max-width: 480px) {
      font-size: 12px;
      margin: 3px;
   }
  `;
  
  export const  Line = styled.hr`
   display: flex;
  width: 21%;
  border: 1.2px solid  ${theme.colors.corItens};
  margin: 10px 0 5px 40px;
  align-self: flex-start; /* garante o alinhamento à esquerda em containers flex */
  
  @media (max-width: 768px) {
    margin: 10px 0 5px 50px;
    width: 18%;
    }
    @media (max-width: 480px) {
      margin: 10px 0 5px 60px;
      width: 15%;
      }
      `;

  export const ContainerHorsDays = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  width: 90%;
  height: 80%;
  gap: 20px;
  margin: 10px 0 10px 0;

  @media (max-width: 768px) {
    width: 60%;
    height: 50%;
    gap: 10px;
    margin: 5px 0 5px 0;
    }
    @media (max-width: 480px) {
      width: 50%;
      height: 40%;
      gap: 10px;
      margin: 5px 0 5px 0;
      }
  `;

export const ContainerDays = styled.div`
display: flex;
flex-direction: column;
justify-content: center;
align-items: flex-start;
width: 100%;
height: 100%;
gap: 1px;
`;

  export const ContainerHors = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  height: 100%;
  gap: 7px;
  `;
  export const DaysHors = styled.p`
  font-size: 14px;
  color: #f5f5f7;
  font-family: 'Roboto', sans-serif;
  font-weight: 600;
  margin: 2px;
  @media (max-width: 768px) {
    font-size: 12px;
    margin: 1px;
    }
    @media (max-width: 480px) {
      font-size: 12px;
      margin: 1px;
      }

  `;

  export const SectionNewsHystory = styled.section`
  display: flex;
  height: 100vh;
  width: 100%;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  background-color: ${({ theme }) => theme.colors.colorBlack};
  color: #f5f5f7;
  gap: 20px;
  @media (max-width: 768px) {
    flex-direction: column;
    height: 100dvh;
    width: 100%;
    justify-content: center;
    align-items: center;
    gap: 10px;
    }
    @media (max-width: 480px) {
      flex-direction: column;
      height: 100dvh;
      width: 100%;
      justify-content: center;
      align-items: center;
      gap: 10px;
      }
  `;

  export const ContainerHystory = styled.div`
  display: flex;
  flex-direction: column;
  width: 55vh;
  height: 50vh;
  align-items: flex-start;
  justify-content: center;
 
  @media (max-width: 768px) {
    width: 50vh;
    height: 40vh;
    
    }
    @media (max-width: 480px) {
      width: 45vh;
     
     
      }


 `;
 export const TitleHystory = styled.h2`
  font-size: 1.8rem; /* padrão para telas grandes */
  margin-bottom: 10px;
  @media (max-width: 768px) {
    font-size: 1.5rem; /* para tablets */
    margin-left: 15px;
    margin-bottom: 5px;
    }`;

 export const TextHystory = styled.p`
  font-size: 0.9rem;
  color: #f5f5f7;
  font-family: 'Roboto', sans-serif;
  font-weight: 400;
  text-indent: 30px;
  text-align: left;
  margin: 0.1px;

  @media (max-width: 768px) {
    font-size: 0.8rem;
    margin-left: 15px;
    margin-right: 15px;
    margin-top: 5px;
    }
    @media (max-width: 480px) {
      font-size: 0.8rem;
      margin-left: 35px;
      margin-right: 35px;
      margin-top: 5px;
      }
  `;

  export const ContainerImagem = styled.div`
  display: flex;
  width: 55vh;
  height: 50vh;
  margin-top: 55px;
  justify-content: center;
  align-items: center;

  @media (max-width: 768px) {
    width: 50vh;
    height: 40vh;
    margin-top: 50px;
    }
    @media (max-width: 480px) {
      width: 45vh;
    height: 30vh;
      margin-top: 50px;
      }
  `;