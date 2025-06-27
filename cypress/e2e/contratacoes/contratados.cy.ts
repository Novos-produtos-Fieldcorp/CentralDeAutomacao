/// <reference types="cypress" />

describe('Contratações - Contratados', () => {
  it('deve autenticar e acessar a página de contratados', () => {
    cy.loginWiseApp();
    cy.visit('/?account_id=1#/motoristas/contratados');
    cy.contains('Contratações', { timeout: 1000 }).should('exist');
  });
}); 