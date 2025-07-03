/// <reference types="cypress" />

describe('Contratações - Contratados', () => {
  beforeEach(() => {
    cy.loginWiseApp();
    cy.visit('/?account_id=1#/motoristas/contratados');
  });

  it('deve exibir o campo de busca', () => {
    cy.get('input[placeholder*="Buscar"]').should('exist');
  });

  it('deve exibir a lista ou tabela de contratados', () => {
    cy.get('table, .overflow-x-auto, .overflow-y-auto').should('exist');
  });

  it('deve abrir o modal de edição se houver contratados', () => {
    cy.get('table tbody tr').first().within(() => {
      cy.get('button, svg').filter(':visible').first().click({ force: true });
    });
    cy.get('button').contains('Cancelar').click({ multiple: true, force: true }); // Fecha o modal
  });
}); 