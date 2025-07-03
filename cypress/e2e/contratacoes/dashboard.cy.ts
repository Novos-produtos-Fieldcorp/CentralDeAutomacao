/// <reference types="cypress" />

describe('Contratações - Dashboard', () => {
  beforeEach(() => {
    cy.loginWiseApp();
    cy.visit('/?account_id=1#/motoristas/dashboard');
  });

  it('deve exibir cards de estatísticas', () => {
    const cards = ['Motoristas', 'Agregados', 'Documentação', 'Qualificados', 'Contratos Ativos', 'Rejeitados'];
    cards.forEach(card => {
      cy.contains(card).should('exist');
    });
  });

  it('deve exibir clientes contratados (se houver)', () => {
    cy.contains('Clientes Contratados').should('exist');
  });
}); 