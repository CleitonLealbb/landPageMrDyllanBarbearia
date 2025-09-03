'use client';
import React, { useState } from 'react';
import { Header, ItemHeader, TextHeader, Logo, ItensHeader, MobileMenuWrapper, Section, Link, Container, H1, P, InformationLeft } from '../assets/AppStyled';
import { ButtonAgendar } from '@/components/ButtonAgendar';
import LogoPng from '../assets/image/logo100X100.png';
import { ButtonMenu } from '@/components/ButtonMenu';
import { FiMenu, FiX } from 'react-icons/fi';

import HomeModern  from '../assets/image/barbudo--sem 1.svg';

;
// import { Logo } from '../components/Logo'; // Adjust the path as necessary

export default function Home() {





  const [menuAberto, setMenuAberto] = useState(false);

  const toggleMenu = () => {
    setMenuAberto((prevState) => !prevState);
  };

  const closeMenu = () => {
    setMenuAberto(false); // fecha o menu
  };

  return (
    <div>
      <Header>
        <Logo src={LogoPng} alt="Logo da Barbearia" />
        <ItensHeader>

          <ItemHeader>
            <TextHeader> 
            <Link href={"#home"}  >INÍCIO</Link>
            </TextHeader>
          </ItemHeader>

          <ItemHeader>
            <TextHeader>
            <Link href={"#sobre-nos"}  >SOBRE NÓS</Link>
            </TextHeader>
          </ItemHeader>

          <ItemHeader>
            <TextHeader>
            <Link href={"#servicos"}  >SERVIÇOS</Link>
            </TextHeader>
          </ItemHeader>
          <ItemHeader>
            <TextHeader>
            <Link href={"#contatos"}  >CONSTATOS</Link>
            </TextHeader>
          </ItemHeader>
          <ButtonAgendar style={{ display: "flex", marginLeft: "60px" }}>Agendar horário</ButtonAgendar>

        </ItensHeader>

        <ButtonMenu onClick={toggleMenu}>
          {menuAberto ? <FiX /> : <FiMenu />}

        </ButtonMenu>
        {menuAberto && (
          <MobileMenuWrapper>
            <ItensHeader style={{ display: "flex", flexDirection: "column" }}>

              <ItemHeader>
                <TextHeader>
                  <Link href={"#home"}  onClick={closeMenu}>INÍCIO</Link>
                </TextHeader>
              </ItemHeader>

              <ItemHeader>
                <TextHeader>
                  <Link href={"#sobre-nos"}  onClick={closeMenu}>SOBRE NÓS</Link>
                </TextHeader>
              </ItemHeader>

              <ItemHeader>
                <TextHeader>
                  <Link href={"#servicos"}  onClick={closeMenu}>SERVIÇOS</Link>
                </TextHeader>
              </ItemHeader>

              <ItemHeader>
                <TextHeader>
                  <Link href={"#contatos"}  onClick={closeMenu}>CONTATOS</Link>
                </TextHeader>
              </ItemHeader>
              <ButtonAgendar style={{ display: "flex" }}  onClick={closeMenu}>Agendar horário</ButtonAgendar>
            </ItensHeader>

          </MobileMenuWrapper>
        )}



      </Header>

      <Section id='home'  style={{backgroundColor: "rgb(17, 22, 28)" }}>
     <Container>
       <InformationLeft>
        
      <H1>MR DYLLAN<br/>
      BARBEARIA</H1> 
      <P>Estamos sempre inovando para oferecer as melhores<br/> técnicas e os mais avançados procedimentos.</P> 
       
       </InformationLeft>
     </Container>
 

      </Section>


      <Section id='sobre-nos' style={{ height: "100vh", backgroundColor: "#3a3a3c" }}>
        <h1 style={{ color: "#f5f5f7" }}>Sobre nós</h1>
      </Section>
      <Section id='servicos' style={{ height: "90vh", backgroundColor: "#3a3a3c" }}>
        <h1 style={{ color: "#f5f5f7" }}>Serviços</h1>
      </Section>
      <Section id='contatos' style={{ height: "90vh", backgroundColor: "#3a3a3c" }}>
        <h1 style={{ color: "#f5f5f7" }}>Contatos</h1>
      </Section>
    </div>
  );
}

