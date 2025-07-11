/// <reference types="cypress" />

describe('Veículos', () => {
  beforeEach(() => {
    cy.loginWiseApp();
    cy.visit('/veiculos?account_id=1');
  });

  it('deve exibir o campo de busca', () => {
    cy.get('input[placeholder*="Buscar"]').should('exist');
  });

  it('deve exibir filtros principais', () => {
    cy.contains('Todos os status').should('exist');
    cy.contains('Todas as categorias').should('exist');
    cy.contains('Todos os clientes').should('exist');
    cy.get('select').should('exist');
  });

  it('deve filtrar por status', () => {
    cy.contains('Todos os status').click();
    cy.get('.dropdown-menu li').first().click();
    cy.get('tbody tr').should('exist');
    cy.contains('Limpar').click();
  });

  it('deve filtrar por categoria', () => {
    cy.contains('Todas as categorias').click();
    cy.get('.dropdown-menu li').first().click();
    cy.get('tbody tr').should('exist');
    cy.contains('Limpar').click();
  });

  it('deve filtrar por cliente', () => {
    cy.contains('Todos os clientes').click();
    cy.get('.dropdown-menu li').first().click();
    cy.get('tbody tr').should('exist');
    cy.contains('Limpar').click();
  });

  it('deve filtrar por período', () => {
    cy.get('select').select(1);
    cy.get('tbody tr').should('exist');
    cy.get('select').select(0);
  });

  it('deve abrir e fechar o modal de adicionar veículo', () => {
    cy.contains('button', 'Adicionar Veículo').click();
    cy.contains('Cadastrar Veículo').should('exist');
    cy.get('button').contains('Cancelar').click();
  });

  it('deve abrir e fechar o modal de edição', () => {
    cy.get('tbody tr').first().within(() => {
      cy.get('button[title="Editar Veículo"]').click({ force: true });
    });
    cy.contains('Editar Veículo').should('exist');
    cy.get('button').contains('Cancelar').click();
  });

  it('deve abrir e fechar o modal de detalhes', () => {
    cy.get('tbody tr').first().within(() => {
      cy.get('button[title="Visualizar"]').click({ force: true });
    });
    cy.contains('Detalhes do Veículo').should('exist');
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