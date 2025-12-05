'use client';
import React, { useState } from 'react';

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

import {
  Header,
  ItemHeader,
  TextHeader,
  Logo,
  ItensHeader,
  MobileMenuWrapper,
  Section,
  Link,
  Container,
  H1,
  P,
  InformationLeft,
  SectionContainer, 
  ContainerSobreNos, 
  ConteinerGrids,
   GridItem, 
  Title,
   TitleGrid,
   ImageGrid, 
   NumeroContato,
    Line, 
    ContainerHorsDays,
     ContainerHors, 
     ContainerDays, 
     DaysHors, 
     SectionNewsHystory, 
     ContainerHystory, 
     TextHystory, 
     ContainerImagem,
      TitleHystory, 
     SectionStorys,
      ConteinerButoes, 
      SectionServices, 
      ConteinerImagensServices, 
      ImageServices, ConteinerGridsServices, 
      GridItemServices,
       ImagemGrid, 
      TitleServices, 
      SectionBannerDesconto,
      SectionFooter,
      ConteinerInformacoesPromo,
      TitlePromo,
      ConteinerBannerDesconto,
      SubTitle,
      ConfiraDescontoP,
      ConteinerHorarioFooter,
      ConteinerLocalidadeFooter,
      ConteinerRedesFooter,
      TitleFooter,
      TextFooter,
      LinkEmail,
      ButtonLigar,
      TextFooterDireitos,
      LogoFooter,
      ContainerHorsDaysFooter,
      LinkWhatsapp
      
      
} from '../assets/AppStyled';
import { ButtonAgendar } from '@/components/ButtonAgendar';
import LogoPng from '../assets/image/logo100X100.webp';
import { ButtonMenu } from '@/components/ButtonMenu';
import { FiMenu, FiX } from 'react-icons/fi';
import HiHomeModern from '../assets/image/imagem1.webp';
import BarberExecution from '../assets/image/imagem2.webp';
import LogoPngForm from '../assets/image/Logo-branco-sem-fundo-AI.webp';
import BgImagem1 from '../assets/image/imagem1.webp';
import BgImagem2 from '../assets/image/imagem2.webp';
import Barba from '../assets/image/beard.webp';
import Baby from '../assets/image/kids.webp';
import Barbear from '../assets/image/razor.webp';
import Cut from '../assets/image/scissors.webp';
import HomemBarba from '../assets/image/foto-de-estudio-de-gengibre-hippie-com-barba-grossa-corte-de-cabelo-da-moda-tem-uma-expressao-seria-aponta-com-o-dedo-indicador-no-canto-superior-direito_273609-18616-removebg-preview.png';
import { theme } from '@/styles/theme';
import 'material-symbols';
import '../styles/globals.css'; // se tiver estilos globais


export default function Home() {

  const [menuAberto, setMenuAberto] = useState(false);

  const toggleMenu = () => {
    setMenuAberto((prevState) => !prevState);
  };

  const closeMenu = () => {
    setMenuAberto(false); // fecha o menu
  };

  const [bgAtual, setBgAtual] = useState(BgImagem1.src);

  const trocarBg = () => {
    setBgAtual((prev) => (prev === BgImagem1.src ? BgImagem2.src : BgImagem1.src));
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
              <Link href={"#contatos"}>CONSTATOS</Link>
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

      <SectionNewsHystory id='sobre-nos' >

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
          <ImageGrid src={HiHomeModern} alt='homem moderno'  ></ImageGrid>
        </ContainerImagem>

      </SectionNewsHystory>

      <SectionStorys $bg={bgAtual}>
        <ConteinerButoes>
          <ButtonAgendar onClick={trocarBg} style={{ display: "flex", marginLeft: "0px", marginTop: "10px", padding: "12px 2px" }}> <span className="material-symbols-outlined">arrow_back_ios_new</span></ButtonAgendar>
          <ButtonAgendar onClick={trocarBg} style={{ display: "flex", marginLeft: "0px", marginTop: "10px", padding: "12px 2px" }}> <span className="material-symbols-outlined">arrow_forward_ios</span></ButtonAgendar>
        </ConteinerButoes>

      </SectionStorys>

    <SectionServices id='servicos' >
        <TitleServices>SERVIÇOS DE BARBEARIA</TitleServices>
        <ConteinerImagensServices>
          <ImageServices src={BgImagem1} alt="Imagem de serviço de barbearia"></ImageServices>
          <ConteinerGridsServices>
            <GridItemServices>
              <ImagemGrid src={Cut} alt='barba' width={50} height={50}></ImagemGrid>
              <h3>Corte de cabelo</h3>
            </GridItemServices>

            <GridItemServices>
              <ImagemGrid src={Barbear} alt='barba' width={50} height={50}></ImagemGrid>
              <h3>Barbear</h3>
            </GridItemServices>

            <GridItemServices>
              <ImagemGrid src={Barba} alt='barba' width={50} height={50}></ImagemGrid>
              <h3>Aparar barba</h3>
            </GridItemServices>

            <GridItemServices>
              <ImagemGrid src={Baby} alt='barba' width={50} height={50}></ImagemGrid>
                <h3>Corte de cabelo infantil</h3>
            </GridItemServices>

          </ConteinerGridsServices>
        </ConteinerImagensServices>
      </SectionServices>

      <SectionBannerDesconto>
         <ConteinerInformacoesPromo>
          <TitlePromo>ATÉ 13% <br/> DE<br/>
         DESC<br/>
      ONT<br/>
         O</TitlePromo>
  <ConteinerBannerDesconto>
   <SubTitle>Em nossos combos de pacotes</SubTitle>
   <ConfiraDescontoP>Confira nossos pacotes de serviços e
   aproveite descontos especiais!</ConfiraDescontoP>
   <ButtonAgendar 
   style={{ display: "flex", marginLeft: "0px", marginTop: "10px", }}>Agendar horário</ButtonAgendar>
  </ConteinerBannerDesconto>
        </ConteinerInformacoesPromo> 
        
              
      </SectionBannerDesconto>

      <SectionFooter id="contatos">
        <ConteinerHorarioFooter>
          <LogoFooter src={LogoPng} alt="Logo da Barbearia" />
          <TextFooter>Barbearias de serviço completo e cuidados masculinos em Nova Xavantina, Mato-Grosso.</TextFooter>
            <ContainerHorsDaysFooter>

         
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
              
            </ContainerHorsDaysFooter>   
          </ConteinerHorarioFooter>

        <ConteinerLocalidadeFooter>
          <TitleFooter>Localização</TitleFooter>
         <TextFooter>Rua Vereador Francisco de Albuquerque,  Nº435, Centro 78690-000, Nova Xavantina, MT </TextFooter> 
         <LinkEmail href='mailto:mrdyllanbarbearia@gmail.com'>mrdyllanbarbearia@gmail.com</LinkEmail> 
         <ButtonLigar href='tel:+55(066)98451-9856'>+55 (66) 9 8451-9856</ButtonLigar> 
         <TextFooterDireitos>Todos direitos reservados © 2025 - Mr Dyllan Barbearia</TextFooterDireitos> 



        </ConteinerLocalidadeFooter>

        <ConteinerRedesFooter>
          <FontAwesomeIcon icon={faWhatsapp} size='4x' color='#4cb04f'/>
          <TextFooter>Adicione nosso whatsApp.</TextFooter>
          <LinkWhatsapp href='https://api.whatsapp.com/send?phone=5566984519856'>Click aqui para adicionar</LinkWhatsapp>
       
     
        </ConteinerRedesFooter>
        
      </SectionFooter>

    </div>
  );
}

