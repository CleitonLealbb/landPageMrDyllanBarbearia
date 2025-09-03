import styled from "styled-components";



interface ButtonProps {
  marginRight?: string;
  display?: string;
  menuAberto?: boolean;
  marginLeft?: string;
}

// Styled-component que filtra a prop
export const ButtonAgendar = styled.button.withConfig({
  shouldForwardProp: (prop) => prop !== 'marginRight', // filtra para não ir ao DOM
})<ButtonProps>`
 display: ${({ display }) => display || 'none'};
  background: ${({ theme }) => theme.colors.colorWhite};
  padding: 5px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.3s ease;
  margin-right: ${({ marginRight }) => marginRight || '0'};
  margin-left: ${({ marginLeft }) => marginLeft || '0'};
  
  &:hover {
    background: ${({ theme }) => theme.colors.corItens};
    color: ${({ theme }) => theme.colors.colorWhite};
  }
  @media (max-width: 768px) {
    display: ${({ menuAberto}) => (menuAberto ? 'none' : 'flex')};
  }
  
`;
