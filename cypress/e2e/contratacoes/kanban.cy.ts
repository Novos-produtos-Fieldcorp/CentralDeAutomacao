/// <reference types="cypress" />

describe('Contratações - Kanban', () => {
  it('deve autenticar e acessar a página Kanban', () => {
    cy.loginWiseApp();
    cy.visit('/?account_id=1#/motoristas/kanban');
    cy.contains('Contratações', { timeout: 1000 }).should('exist');
  });
}); 