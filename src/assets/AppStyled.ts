"use client";
import Image from "next/image";
import styled from "styled-components";
import BgImagem from './image/Frame1.svg';

interface ItensHeaderProps {
  display?: string ;
  flexDirection?: string;
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
  @media screen {
    justify-content: space-between;
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
  opacity: 0.8;
  cursor: pointer;
  letter-spacing: -.01em;
  &:hover {
    opacity: 1;
    transition: all 0.3s ease-in-out;
  } 
`;

export const Section = styled.section`
  height: 100vh;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: black;
  @media (max-width: 768px) {
    height: 100dvh; /* força altura total da tela */
  }
  @media (max-width: 480px) {
    height: 100dvh; /* força altura total da tela */
  }
`;

  
export const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: flex-end;
  
  height: 100vh; /* força altura total da tela */
  width: 100%;
  background-image: url(${BgImagem});
  background-size: cover;
  background-repeat: no-repeat;
  background-position: left;
   @media (max-width: 768px) {
   width: 100%;
   height: 100dvh;
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center;
    background-position-x: 40%;
    
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

export const H1 = styled.h1`
  font-size: 55px;
  color: #f5f5f7;
  font-family: 'Roboto', sans-serif;
  font-weight: 700;
  letter-spacing: 0.05em;
  margin: 0;

  @media (max-width: 768px) {
    font-size: 45px;
  }
  @media (max-width: 480px) {
    font-size: 35px;
  }

`;

export const P = styled.p`
  font-size: 14px;
  color: #f5f5f7;
  font-family: 'Roboto', sans-serif;
  font-weight: 700;
 
  @media (max-width: 768px) {
    font-size: 12px;
  }`;
