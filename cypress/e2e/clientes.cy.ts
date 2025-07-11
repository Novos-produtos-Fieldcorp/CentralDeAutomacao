/// <reference types="cypress" />

describe('Clientes', () => {
  beforeEach(() => {
    cy.loginWiseApp();
    cy.visit('/clientes?account_id=1');
  });

  it('deve exibir o campo de busca', () => {
    cy.get('input[placeholder*="Buscar"]').should('exist');
  });

  it('deve exibir filtros principais', () => {
    cy.contains('Todos os status').should('exist');
    cy.contains('Todas as cidades').should('exist');
    cy.get('select').should('exist');
  });

  it('deve filtrar por status', () => {
    cy.contains('Todos os status').click();
    cy.get('.dropdown-menu li').first().click();
    cy.get('tbody tr').should('exist');
    cy.contains('Limpar').click();
  });

  it('deve filtrar por cidade', () => {
    cy.contains('Todas as cidades').click();
    cy.get('.dropdown-menu li').first().click();
    cy.get('tbody tr').should('exist');
    cy.contains('Limpar').click();
  });

  it('deve filtrar por período', () => {
    cy.get('select').select(1);
    cy.get('tbody tr').should('exist');
    cy.get('select').select(0);
  });

  it('deve abrir e fechar o modal de adicionar cliente', () => {
    cy.contains('button', 'Adicionar Cliente').click();
    cy.contains('Cadastrar Cliente').should('exist');
    cy.get('button').contains('Cancelar').click();
  });

  it('deve abrir e fechar o modal de edição', () => {
    cy.get('tbody tr').first().within(() => {
      cy.get('button[title="Editar Cliente"]').click({ force: true });
    });
    cy.contains('Editar Cliente').should('exist');
    cy.get('button').contains('Cancelar').click();
  });

  it('deve abrir e fechar o modal de detalhes', () => {
    cy.get('tbody tr').first().within(() => {
      cy.get('button[title="Visualizar"]').click({ force: true });
    });
    cy.contains('Detalhes do Cliente').should('exist');
    cy.get('button').contains('Fechar').click();
  });

  it('deve selecionar todos e exibir ações em massa', () => {
    cy.get('input[type="checkbox"]').first().check({ force: true });
    cy.contains('Excluir').should('exist');
    cy.get('input[type="checkbox"]').first().uncheck({ force: true });
  });

  it('deve exibir a paginação', () => {
    cy.contains('Próxima').should('exist');
    cy.contains('Anterior').should('exist');
  });

  it('deve abrir e fechar o modal de exclusão', () => {
    cy.get('tbody tr').first().within(() => {
      cy.get('button[title="Excluir"]').click({ force: true });
    });
    cy.contains('Confirmar Exclusão').should('exist');
    cy.get('button').contains('Cancelar').click();
  });
}); 