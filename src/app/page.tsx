"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  FiMenu,
  FiX,
  FiClock,
  FiMapPin,
  FiPhone,
  FiScissors,
  FiStar,
  FiUsers,
  FiCalendar,
  FiMessageCircle,
} from "react-icons/fi";

import LogoPng from "../assets/image/logo100X100.webp";
import LogoPngForm from "../assets/image/Logo-branco-sem-fundo-AI.webp";
import HiHomeModern from "../assets/image/imagem1.webp";
import BarberExecution from "../assets/image/imagem-bg.jpg";
import BgImagem1 from "../assets/image/imagem1.webp";
import BgImagem2 from "../assets/image/imagem2.webp";
import Barba from "../assets/image/beard.webp";
import Baby from "../assets/image/kids.webp";
import Barbear from "../assets/image/razor.webp";
import Cut from "../assets/image/scissors.webp";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  const slides = useMemo(() => [BgImagem1, BgImagem2], []);
  const heroBg = slides[slide];

  const whatsappLink =
    "https://api.whatsapp.com/send?phone=5566984519856&text=Ol%C3%A1!%20Quero%20agendar%20um%20hor%C3%A1rio.";

  const nextSlide = () => setSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setSlide((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <main className="barber-page">
      <header className="site-header">
        <div className="container nav">
          <a href="#home" className="brand">
            <Image src={LogoPng} alt="Mr Dyllan Barbearia" width={58} height={58} />
            <div className="brand-text">
              <strong>MR DYLLAN</strong>
              <span>BARBEARIA</span>
            </div>
          </a>

          <nav className="desktop-nav">
            <a href="#home">Início</a>
            <a href="#sobre">Sobre</a>
            <a href="#servicos">Serviços</a>
            <a href="#beneficios">Benefícios</a>
            <a href="#contato">Contato</a>
          </nav>

          <div className="nav-actions">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              Agendar horário
            </a>

            <button
              className="menu-toggle"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Abrir menu"
            >
              {menuOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="mobile-menu">
            <a href="#home" onClick={() => setMenuOpen(false)}>Início</a>
            <a href="#sobre" onClick={() => setMenuOpen(false)}>Sobre</a>
            <a href="#servicos" onClick={() => setMenuOpen(false)}>Serviços</a>
            <a href="#beneficios" onClick={() => setMenuOpen(false)}>Benefícios</a>
            <a href="#contato" onClick={() => setMenuOpen(false)}>Contato</a>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              onClick={() => setMenuOpen(false)}
            >
              Agendar horário
            </a>
          </div>
        )}
      </header>

      <section
        id="home"
        className="hero"
        style={{
          backgroundImage: `linear-gradient(rgba(10,10,10,.76), rgba(10,10,10,.84)), url(${heroBg.src})`,
        }}
      >
        <div className="container hero-grid">
          <div className="hero-content">
            <div className="eyebrow">Barbearia premium + agendamento rápido</div>

            <h1>
              ELEVE SEU VISUAL COM A
              <span> EXPERIÊNCIA CERTA</span>
            </h1>

            <p>
              Corte, barba e atendimento profissional em um ambiente moderno.
              Agende seu horário com rapidez e tenha uma experiência de barbearia
              com mais estilo, organização e praticidade.
            </p>

            <div className="hero-cta">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
              >
                Agendar no WhatsApp
              </a>

              <a href="#servicos" className="btn btn-secondary">
                Ver serviços
              </a>
            </div>

            <div className="hero-meta">
              <div>
                <FiPhone />
                <span>+55 (66) 9 8451-9856</span>
              </div>
              <div>
                <FiStar />
                <span>Atendimento com qualidade e estilo</span>
              </div>
            </div>
          </div>

          <div className="hero-side">
            <div className="hero-card">
              <Image
                src={LogoPngForm}
                alt="Logo Mr Dyllan Barbearia"
                className="hero-logo"
              />
             
            </div>
          </div>
        </div>

        <div className="hero-slider-controls">
          <button onClick={prevSlide} aria-label="Anterior">‹</button>
          <button onClick={nextSlide} aria-label="Próximo">›</button>
        </div>
      </section>

      <section id="sobre" className="section section-dark">
        <div className="container">
          <div className="section-heading center">
            <span className="section-kicker">Quem somos</span>
            <h2>Sobre a barbearia</h2>
          </div>

          <div className="about-grid">
            <div className="about-text">
              <p>
                A Mr Dyllan Barbearia foi criada para no ano de 2019 no intuito entregar o melhor
                do serviço de barbearia com um atendimento mais prático profissional, organizado e moderno.
                 Nosso foco é oferecer uma experiência de qualidade,
                 onde cada cliente se sinta valorizado e bem cuidado. 
                 Com um ambiente acolhedor e uma equipe dedicada,
                  buscamos transformar cada visita em um momento de relaxamento e estilo.
              </p>

              <ul className="check-list">
                <li>Atendimento profissional</li>
                <li>Ambiente moderno e confortável</li>
                <li>Agendamento rápido e sem complicação</li>
                <li>Cuidado com cada detalhe do visual</li>
              </ul>

              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
              >
                Agendar horário
              </a>
            </div>

            <div className="about-image-frame">
              <Image
                src={BarberExecution}
                alt="Execução de serviço na barbearia"
                className="about-image"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="servicos" className="section section-textured">
        <div className="container">
          <div className="section-heading center">
            <span className="section-kicker">O que fazemos</span>
            <h2>Serviços de barbearia</h2>
          </div>

          <div className="services-grid">
            <article className="service-card">
              <Image src={Cut} alt="Corte de cabelo" width={54} height={54} />
              <h3>Corte de cabelo</h3>
              <p>Cortes modernos e clássicos com acabamento profissional.</p>
            </article>

            <article className="service-card">
              <Image src={Barbear} alt="Barbear" width={54} height={54} />
              <h3>Barbear</h3>
              <p>Barba alinhada com técnica, estilo e presença.</p>
            </article>

            <article className="service-card">
              <Image src={Barba} alt="Aparar barba" width={54} height={54} />
              <h3>Aparar barba</h3>
              <p>Manutenção ideal para deixar o visual sempre em dia.</p>
            </article>

            <article className="service-card">
              <Image src={Baby} alt="Corte infantil" width={54} height={54} />
              <h3>Corte infantil</h3>
              <p>Atendimento pensado para os pequenos com mais conforto.</p>
            </article>
          </div>

          <div className="banner-cta">
            <Image src={HiHomeModern} alt="Cliente em atendimento" className="banner-bg" />
            <div className="banner-overlay">
              <h3>Agende agora e garanta seu horário</h3>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
              >
                Agendar horário
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="beneficios" className="section section-dark">
        <div className="container">
          <div className="section-heading center">
            <span className="section-kicker">Diferenciais</span>
            <h2>Por que escolher a Mr Dyllan</h2>
          </div>

          <div className="benefits-grid">
            <article className="benefit-card">
              <FiCalendar />
              <h3>Agendamento simples</h3>
              <p>Marque seu horário com rapidez e sem burocracia.</p>
            </article>

            <article className="benefit-card">
              <FiUsers />
              <h3>Mais organização</h3>
              <p>Atendimento melhor estruturado e experiência mais fluida.</p>
            </article>

            <article className="benefit-card">
              <FiScissors />
              <h3>Visual de alto nível</h3>
              <p>Serviços feitos com atenção, técnica e presença.</p>
            </article>

            <article className="benefit-card">
              <FiMessageCircle />
              <h3>Contato rápido</h3>
              <p>WhatsApp direto para facilitar o atendimento.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section section-orange stats-section">
        <div className="container">
          <div className="section-heading center light-on-orange">
            <span className="section-kicker">Números da barbearia</span>
            <h2>Alguns destaques</h2>
          </div>

          <div className="stats-grid">
            <div className="stat-item">
              <strong>1000</strong>
              <span>Atendimentos realizados</span>
            </div>
            <div className="stat-item">
              <strong>900</strong>
              <span>Clientes satisfeitos</span>
            </div>
            <div className="stat-item">
              <strong>500</strong>
              <span>Agendamentos concluídos</span>
            </div>
            <div className="stat-item">
              <strong>100</strong>
              <span>Novos clientes recorrentes</span>
            </div>
          </div>
        </div>
      </section>

      <section id="contato" className="section contact-section">
        <div className="container">
          <div className="section-heading center">
            <span className="section-kicker">Fale conosco</span>
            <h2>Contato</h2>
          </div>

          <div className="contact-grid">
            <div className="contact-card">
              <div className="contact-item">
                <FiMapPin />
                <div>
                  <strong>Endereço</strong>
                  <p>
                    Rua Vereador Francisco de Albuquerque, nº 435, Centro,
                    Nova Xavantina - MT
                  </p>
                </div>
              </div>

              <div className="contact-item">
                <FiClock />
                <div>
                  <strong>Horários</strong>
                  <p>Segunda: 13h às 20h</p>
                  <p>Terça a sábado: 08h às 20h</p>
                  <p>Domingo: fechado</p>
                </div>
              </div>

              <div className="contact-item">
                <FiPhone />
                <div>
                  <strong>Telefone</strong>
                  <p>+55 (66) 9 8451-9856</p>
                  <p>mrdyllanbarbearia@gmail.com</p>
                </div>
               
              </div>
               <div className="footer-socials">
                  <a href="#" aria-label="Instagram">IG</a>
                  <a href="#" aria-label="WhatsApp">WA</a>
                  <a href="#" aria-label="Facebook">FB</a>
                </div>
            </div>

            <div className="contact-cta">
              <h3>Pronto para agendar?</h3>
              <p>
                Clique no botão abaixo e fale agora pelo WhatsApp para reservar
                seu horário.
              </p>

              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-full"
              >
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer" id="contato">
        <div className="container">
       

          <div className="footer-bottom">
            <p>© 2025 Mr Dyllan Barbearia. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}