/// <reference types="cypress" />

describe('Contratações - Dashboard', () => {
  it('deve autenticar e acessar a página Dashboard', () => {
    cy.loginWiseApp();
    cy.visit('/?account_id=1#/motoristas/dashboard');
    cy.contains('Contratações', { timeout: 1000 }).should('exist');
  });
}); 