'use client';
import React, { useState } from 'react';
import { Header, ItemHeader, TextHeader, Logo, ItensHeader, MobileMenuWrapper, Section, Link, Container, H1, P, InformationLeft, SectionContainer, ContainerSobreNos, ConteinerGrids, GridItem, Title, TitleGrid, ImageGrid, NumeroContato, Line, ContainerHorsDays, ContainerHors, ContainerDays, DaysHors, SectionNewsHystory, ContainerHystory, TextHystory, ContainerImagem, TitleHystory } from '../assets/AppStyled';
import { ButtonAgendar } from '@/components/ButtonAgendar';
import LogoPng from '../assets/image/logo100X100.webp';
import { ButtonMenu } from '@/components/ButtonMenu';
import { FiMenu, FiX } from 'react-icons/fi';
import HiHomeModern from '../assets/image/imagem1.svg';
import BarberExecution from '../assets/image/imagem2.svg';
import LogoPngForm from '../assets/image/Logo-branco-sem-fundo-AI.webp';
import { theme } from '@/styles/theme';

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
                  <Link href={"#home"} onClick={closeMenu}>INÍCIO</Link>
                </TextHeader>
              </ItemHeader>

              <ItemHeader>
                <TextHeader>
                  <Link href={"#sobre-nos"} onClick={closeMenu}>SOBRE NÓS</Link>
                </TextHeader>
              </ItemHeader>

              <ItemHeader>
                <TextHeader>
                  <Link href={"#servicos"} onClick={closeMenu}>SERVIÇOS</Link>
                </TextHeader>
              </ItemHeader>

              <ItemHeader>
                <TextHeader>
                  <Link href={"#contatos"} onClick={closeMenu}>CONTATOS</Link>
                </TextHeader>
              </ItemHeader>
              <ButtonAgendar style={{ display: "flex" }} onClick={closeMenu}>Agendar horário</ButtonAgendar>
            </ItensHeader>

          </MobileMenuWrapper>
        )}



      </Header>

      <Section id='home' style={{ backgroundColor: "rgb(17, 22, 28)" }}>
        <Container>
          <InformationLeft>

            <H1>MR DYLLAN<br />
              BARBEARIA</H1>
            <P>Estamos sempre inovando para oferecer as melhores<br /> técnicas e os mais avançados procedimentos.</P>

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
              <NumeroContato style={{ color: theme.colors.corItens }}>+55 (66) 9 8451-9856 </NumeroContato>
              <TitleGrid>horário de atendimentos</TitleGrid>
              <Line />
              <ContainerHorsDays>
                <ContainerDays>
                  <DaysHors>SEGUNDA</DaysHors>
                  <DaysHors> TERÇA À SÁBADO</DaysHors>
                  <DaysHors> DOMINGO</DaysHors>
                </ContainerDays>
                <ContainerHors>
                  <DaysHors>13 - 20 Hrs</DaysHors>
                  <DaysHors>08 - 20 Hrs</DaysHors>
                  <DaysHors> FECHADO</DaysHors>
                </ContainerHors>
              </ContainerHorsDays>

            </GridItem>
          </ConteinerGrids>

        </ContainerSobreNos>
      </SectionContainer>

      <SectionNewsHystory>

        <ContainerHystory>
          <TitleHystory>Nossa História</TitleHystory>
          <TextHystory>
            Somos uma barbearia localizada em Nova Xavantina, MT, com o objetivo de oferecer aos nossos clientes um ambiente acolhedor e serviços de alta qualidade. Nossa equipe é composta por profissionais experientes e apaixonados pelo que fazem, sempre prontos para atender às suas necessidades.
          </TextHystory>
          <TextHystory>
            Na nossa barbearia, valorizamos a tradição e a modernidade, oferecendo cortes de cabelo clássicos e contemporâneos, além de serviços de barba e cuidados pessoais. Estamos comprometidos em proporcionar uma experiência única e satisfatória para todos os nossos clientes.
          </TextHystory>
          <ButtonAgendar style={{ display: "flex", marginLeft: "0px", marginTop: "10px" }}>Agendar horário</ButtonAgendar>

        </ContainerHystory>

        <ContainerImagem>
          <ImageGrid src={HiHomeModern} alt='homem moderno' width={50} height={50}></ImageGrid>
        </ContainerImagem>

      </SectionNewsHystory>


    </div>
  );
}

