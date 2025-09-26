'use client';
import React, { useState } from 'react';
import { Header, ItemHeader, TextHeader, Logo, ItensHeader, MobileMenuWrapper, Section, Link, Container, H1, P, InformationLeft, SectionContainer, ContainerSobreNos, ConteinerGrids, GridItem, Title, TitleGrid, ImageGrid} from '../assets/AppStyled';
import { ButtonAgendar } from '@/components/ButtonAgendar';
import LogoPng from '../assets/image/logo100X100.png';
import { ButtonMenu } from '@/components/ButtonMenu';
import { FiMenu, FiX } from 'react-icons/fi';
 import  HiHomeModern  from '../assets/image/imagem1.svg';
 import BarberExecution from '../assets/image/imagem2.svg';
 import LogoPngForm from '../assets/image/Logo-branco-sem-fundo-AI.png';

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


    
        <SectionContainer>
       <Title>Bem-Vindo à melhor barbearia de Nova Xavantina</Title>
       <ContainerSobreNos>
         
         <ConteinerGrids>
            <GridItem>

            <ImageGrid src={HiHomeModern} alt='homem moderno' width={200} height={200}></ImageGrid>
            </GridItem>
            <GridItem>
            <ImageGrid src={LogoPngForm} alt='homem moderno' width={300} height={300}></ImageGrid>
            </GridItem>
         </ConteinerGrids>
         
         <ConteinerGrids>
            <GridItem>
            <ImageGrid src={BarberExecution} alt='homem moderno' width={300} height={300}></ImageGrid>
            </GridItem>
            <GridItem>
            <TitleGrid>horário de atendimentos</TitleGrid>
           
            </GridItem>
         </ConteinerGrids>

       </ContainerSobreNos>
        </SectionContainer>
  

      <Section id='servicos' style={{ height: "90vh", backgroundColor: "#3a3a3c" }}>
       
      </Section>
      <Section id='contatos' style={{ height: "90vh", backgroundColor: "#3a3a3c" }}>
    
      </Section>
    </div>
  );
}

