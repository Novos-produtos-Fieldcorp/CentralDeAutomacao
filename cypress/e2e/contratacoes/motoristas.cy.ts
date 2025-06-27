/// <reference types="cypress" />

describe('Contratações - Motoristas', () => {
  it('deve autenticar e acessar a página de motoristas', () => {
    cy.loginWiseApp();
    cy.visit('/?account_id=1#/motoristas/lista');
    cy.contains('Contratações', { timeout: 1000 }).should('exist');
  });
}); 