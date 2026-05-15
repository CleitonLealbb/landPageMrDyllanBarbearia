"use client";
import Image from "next/image";
import styled from "styled-components";
import BgImagem from './image/Frame1.webp';
 import HomemBarba from '../assets/image/human-face-expressions-min.jpg';
import { theme } from "../styles/theme";


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
    
    align-items: center;
    justify-content: flex-end;
    position: fixed;
  }
  @media (max-width: 480px) { 
    display: flex;
    justify-content: flex-end;
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
    gap: 40px;
  }
  @media (max-width: 480px) {
    gap: 40px;
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
  margin-right: 70dvw;
  
  
}
@media (max-width: 480px) {
  width: 45px;
  height: 45px;
  margin-right: 50dvw;
 
 
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
    width: 50%; 
    height: 85dvh;
    z-index: 9999;
    border-radius: 10px;
    background: ${({ theme }) => theme.colors.corTerceira};
    position: fixed;
    top: 55px;
  box-shadow: -2px 1px 18px 6px rgba(0, 0, 0, 0.55);
 @media (max-width: 480px) {
    height: 55dvh;
    background: blue;
  }



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
  height: 100dvh; /* força altura total da tela */
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
  background-image: url(${BgImagem.src});
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
  margin: 5px;
  `;

export const SectionContainer = styled.div`
  display: flex;
  flex-direction: column;
  
  align-items: center;
  height: 100dvh;
  width: 100%;
 background-color: ${({ theme }) => theme.colors.corTerceira};
  color: #f5f5f7;
padding: 50px 0 50px 0;
  
  @media(max-width: 768px) {
    height: 180dvh;
    width: 100%;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  @media(max-width: 480px) {
    height: 100dvh;
    width: 100%;
    justify-content: center;
    flex-direction: column;
    align-items: center;
  }
  `;

export const Title = styled.h2`
display: flex;
 font-size: 1.8rem; /* padrão para telas grandes */
 
  @media (max-width: 768px) { 
    font-size: 1.5rem; /* para tablets */
    margin-left: 15px;
    margin-top: 10px;

  }
  @media (max-width: 480px) {
    font-size: 1.2rem; /* para celulares */
    margin-left: 35px;
    margin-right: 35px;
  }
  `;
// aqui fica section sobre nos 
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
    height: 150vh;
    gap: 15px;
    
    }
  @media (max-width: 480px) {
    flex-direction: column;
    width: 100%;
    height: 100vh;
    gap: 15px;
  }
  `;
// aqui ficam os grids
export const ConteinerGrids = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  justify-content: center;
  align-items: center;
  ;
 
  @media (max-width: 768px) {
    flex-direction: column;
    flex-wrap: wrap;
    gap: 15px;
    }
  @media (max-width: 480px) {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 15px;
    }
`
  ;

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
  @media (min-width:480px) and ( max-width: 768px) {
    width: 350px;
    height: 180px;
    &:hover{
      transform: none;
    }
    }
  @media (max-width: 480px) {
    width: 250px;
    height: 150px;
    &:hover{
      transform: none;
    }
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

export const Line = styled.hr`
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
    height: 110dvh;
    width: 100%;
    justify-content: center;
    align-items: center;
    gap: 30px;
    ;
  }
  @media (max-width: 480px) {
    flex-direction: column;
    height: 100dvh;
    width: 100%;
    justify-content: center;
    align-items: center;
    gap: 50px;
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
    margin-top: 40px;
    width: 50vh;
    height: 40vh;
    margin-top: 20px;
    margin-bottom: 2px;
  }
  @media (max-width: 480px) {
    width: 45vh;
    height: 30vh;
    margin-top: 20px;
    margin-bottom: 3px;
  }
  `;
export const TitleHystory = styled.h2`
  font-size: 1.8rem; /* padrão para telas grandes */
  margin-bottom: 10px;
  @media (max-width: 768px) {
    font-size: 1.5rem; /* para tablets */
    margin-left: 15px;
    margin-top: 50px;
    }
  @media (max-width: 480px) {
    font-size: 1.2rem; /* para celulares */
    margin-left: 35px;
    margin-top: 35px;
  }`;

export const TextHystory = styled.p`
  font-size: 0.9rem;
  color: #f5f5f7;
  font-family: 'Roboto', sans-serif;
  font-weight: 400;
  text-indent: 30px;
  text-align: left;
  margin: 2px;

  @media (max-width: 768px) {
    font-size: 0.8rem;
    margin-left: 15px;
    margin-right: 15px;
    margin-top: 5px;
    ;
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
    
    }
    @media (max-width: 480px) {
      width: 45vh;
    height: 30vh;
 
      }
  `;

export const SectionStorys = styled.div <{ $bg: string }>`
  display: flex;
  height: 90vh;
  width: 100%;
  background-image: url(${(props) => props.$bg});
  background-size: cover; 
  background-repeat: no-repeat;
  background-position: center;
  transition: background-image 0.7s ease-in-out;
  @media (max-width: 768px) {
    height: 100dvh;
    width: 100%;
    background-size: cover; 
    background-repeat: no-repeat;
    background-position: center;
    }
    @media (max-width: 480px) {
      height: 92dvh;
      width: 100%;
      background-size: cover; 
      background-repeat: no-repeat;
      background-position: center;
      }
  `;
export const ConteinerButoes = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 20px 50px 20px 50px;
  @media(max-width: 768px) {
    padding: 10px 20px 10px 20px;
  }
  @media(max-width: 480px) {
    padding: 10px 15px 10px 15px;
  }
  `;

export const SectionServices = styled.section`
  display: flex;
  height: 100vh;
  width: 100%;
  background-color: ${({ theme }) => theme.colors.corSecundaria};
  color: ${({ theme }) => theme.colors.colorWhite};
  justify-content: center;
  flex-direction: column;
  align-items: center;
  @media (max-width: 768px) {
    height: 215dvh;
    width: 100%;
    justify-content: flex-start;
    align-items: center;

    }
    @media (max-width: 480px) {
      height: 150dvh;
      width: 100%;
      justify-content: center;
      align-items: center;
      } 


`;

export const TitleServices = styled.h2`
  font-size: 1.8rem; /* padrão para telas grandes */
  margin-bottom: 10px;
  @media (max-width: 768px) {
    font-size: 1.5rem; /* para tablets */
    margin-left: 15px;
    margin-top: 50px;
    margin-bottom: 35px;
    }
    @media (max-width: 480px) {
      font-size: 1.2rem; /* para celulares */
      margin-left: 35px;
      margin-top: 35px;
      }
  `;

export const ConteinerImagensServices = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  gap: 10px;
  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100dvh;
    gap: 10px;
    }
    @media (max-width: 480px) {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100dvh;
      gap: 10px;

      } 
`;

export const ImageServices = styled(Image)`
  width: 450px;
  height: 420px;
  object-fit: cover;
  border-radius: 10px;
  @media (max-width: 768px) {
    width: 300px;
    height: 300px;
  }
  @media (max-width: 480px) {
    width: 250px;
    height: 250px;
  }
    `;

export const ConteinerGridsServices = styled.div`
 width: 450px;
 height: 410px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 15px;
  justify-content: center;
  align-items: center;
  border-radius: 10px;
  padding: 10px 0 20px 0;
  @media (max-width: 768px) {
    width: 350px;
    height: 350px;
    gap: 10px;
    }
    @media (max-width: 480px) {
      width: 250px;
      height: 250px;
      gap: 10px;
      }
`

export const GridItemServices = styled.div`
  display: flex;
  width: 200px;
  height: 205px;
  flex-direction: column;
  border-radius: 10px;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 0px;
  background-color: ${({ theme }) => theme.colors.corItens};
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  @media (max-width: 768px) {
    width: 300px;
    height: 200px;
    }
    @media (max-width: 480px) {
      width: 130px;
      height: 130px;
      }
  `;

export const ImagemGrid = styled(Image)`
  padding-top: 20px;
  width: 90px;
  height: 90px;
  object-fit: cover;
  border-radius: 10px;
 
 `;

export const SectionBannerDesconto = styled.section`
  display: flex;
  height: 100vh;
  width: 100%;
  background-image: url(${HomemBarba.src}), ${({ theme }) => theme.colors.corDegrade1} ;
  color: ${({ theme }) => theme.colors.colorWhite};
  background-size: cover;
  background-position:  left bottom;
  background-repeat: no-repeat;
  justify-content:  flex-end;
  align-items: center;
  flex-direction: row;
  @media (max-width: 768px) {
    height: 100dvh;
    width: 100%;
    background-size: 300px contain, cover;
    background-position:  left bottom;
    background-repeat: no-repeat;
    justify-content: center;
    align-items: center;
  }
  @media (max-width: 480px) {
    height: 100dvh;
    width: 100%;
    background-size: contain, cover;
    background-position:  left center;
    background-repeat: no-repeat;
    justify-content: center;
    align-items: center;

      }
 `;

export const ConteinerInformacoesPromo = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: flex-start;
  width: 130vh;
  height: 100%;
  align-items: center;
  margin: 0 0 0 30px;
  word-wrap: break-word;
  line-height: 1;
  
`;

export const TitlePromo = styled.h1`
width: 80%;
  font-size: 5rem; /* padrão para telas grandes */
  color: #f5f5f7;
  font-family: 'Roboto', sans-serif;
  font-weight: 700;
  margin-top: 0;
  @media (max-width: 768px) {
    font-size: 3.5rem; /* para tablets */
    margin-left: 15px;
    margin-top: 50px;
    }
    @media (max-width: 480px) {
      font-size: 2.5rem; /* para celulares */
      margin-left: 35px;
      margin-top: 35px;
      }
  `;
export const ConteinerBannerDesconto = styled.div`
  display: flex;
  width: 90%;
  height: 70%;
  justify-content: flex-start;
  align-items: flex-start;
  flex-direction: column;;
  @media (max-width: 768px) {
    width: 80%;
    height: 25%;
    }
    @media (max-width: 480px) {
      width: 90%;
      height: 20%;
      }`;

export const SubTitle = styled.h2`
  font-size: 3.5rem; /* padrão para telas grandes */
  margin-top: 35px;
  `;

export const ConfiraDescontoP = styled.p`
  font-size: 1.2rem;
  color: #f5f5f7;
  font-family: 'Roboto', sans-serif;
  font-weight: 400;
  text-align: left;
  margin: 10px 0 10px 0;`;

export const SectionFooter = styled.section`
  display: flex;
  height: 50vh;
  width: 100%;
  background-color: ${({ theme }) => theme.colors.corTerceira};
  color: #f5f5f7;
  justify-content: center;
  align-items: center;
flex-direction: row;
gap: 50px;
  @media (max-width: 768px) {
    height: 80dvh;
    width: 100%;
    justify-content: center;
    align-items: center;
    }
    @media (max-width: 480px) {
      height: 80dvh;
      width: 100%;
      justify-content: center;
      align-items: center;
      }
      `;

export const TitleFooter = styled.h2`
  font-size: 2.4rem; /* padrão para telas grandes */
  margin-bottom: 10px;
  @media (max-width: 768px) {
    font-size: 1.5rem; /* para tablets */
    margin-left: 15px;
    margin-top: 50px;
    }
    @media (max-width: 480px) {
      font-size: 1.2rem; /* para celulares */
      margin-left: 35px;
      margin-top: 35px;
      }`;

export const TextFooter = styled.p`
  display: flex;
  font-size: 1rem;
  color: #f5f5f7;
  font-family: 'Roboto', sans-serif;
  font-weight: 400;
  text-align: left;
  margin: 2px;
  text-align: center;       /* Necessário para alinhar o texto */
  word-wrap: break-word;   /* Permite quebra de linha dentro de palavras longas */
;
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

export const ContainerHorsDaysFooter = styled.div`
display: flex;
flex-direction: row;
justify-content: center;
align-items: center;
margin-top: 1px;
`;

// aqui fica o horario do footer
export const ConteinerHorarioFooter = styled.div`
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
width: 350px;
@media (max-width: 768px) {
 display: none;
  }
  @media (max-width: 480px) {
    display: none;
    }
`;
export const LogoFooter = styled(Image)`
width: 80px;
height: 80px;
margin-bottom: 5px;
`;

// aqui fica a localidade do footer
export const ConteinerLocalidadeFooter = styled.div`
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
text-align: center;
word-wrap: break-word;
width:  350px;

`;

export const LinkEmail = styled.a`
  margin-top: 15px;
  text-decoration: none;
  font-size: 20px;
  color: ${({ theme }) => theme.colors.corItens};
  font-family: 'Roboto', sans-serif;
  font-weight: 500;
  margin-bottom: 10px;
 `;

export const TextFooterDireitos = styled.p`
display: flex;
  font-size: .9rem;
  color: #f5f5f7;
  font-family: 'Roboto', sans-serif;
  font-weight: 400;
  text-align: left;
  margin-top: 17px;
 
  text-align: center;       /* Necessário para alinhar o texto */
  
;
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

export const ButtonLigar = styled.a`
  text-decoration: none;
  font-size: 20px;
  color: ${({ theme }) => theme.colors.colorWhite};
  font-family: 'Roboto', sans-serif;
  font-weight: 500;
  background-color: ${({ theme }) => theme.colors.corItens};
  padding: 3px 30px 3px 30px;
  border-radius: 8px;
 `;

// aqui fica as redes sociais do footer

export const ConteinerRedesFooter = styled.div`
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
`;

export const LinkWhatsapp = styled.a`
  margin-top: 1px;
  text-decoration: none;
  font-size: 18px;
  color: ${({ theme }) => theme.colors.corItens};`;