/// <reference types="cypress" />

describe('Contratações - Motoristas', () => {
  beforeEach(() => {
    cy.loginWiseApp();
    cy.visit('/?account_id=1#/motoristas/lista');
  });

  it('deve exibir o campo de busca', () => {
    cy.get('input[placeholder*="Buscar"]').should('exist');
  });

  it('deve exibir o botão de adicionar motorista', () => {
    cy.contains('button', 'Adicionar Motorista').should('exist');
  });

  it('deve exibir a lista ou tabela de motoristas', () => {
    cy.get('table, .overflow-x-auto, .overflow-y-auto').should('exist');
  });

  it('deve abrir o modal de adicionar motorista', () => {
    cy.contains('button', 'Adicionar Motorista').click();
    cy.contains('Cadastrar Motorista').should('exist');
    cy.get('button').contains('Cancelar').click(); // Fecha o modal
  });
}); 