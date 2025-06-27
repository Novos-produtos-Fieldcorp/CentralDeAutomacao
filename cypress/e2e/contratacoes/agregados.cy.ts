/// <reference types="cypress" />

describe('Contratações - Agregados', () => {
  it('deve autenticar e acessar a página de agregados', () => {
    cy.loginWiseApp();
    cy.visit('/?account_id=1#/motoristas/agregados');
    cy.contains('Contratações', { timeout: 1000 }).should('exist');
  });
}); 