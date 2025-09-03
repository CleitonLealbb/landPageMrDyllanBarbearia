import styled from "styled-components";

export const ButtonMenu = styled.button`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    color: ${({ theme }) => theme.colors.colorWhite};
    background: none;
    border: none;
    font-size: 36px;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    margin-right: 9dvw;
  }
  @media (max-width: 480px) {
    margin-left: 7dvw;
    font-size: 26px;
    
  }
`;