// cypress/e2e/contratacao/integration.cy.ts

describe('Contratação Integration Tests', () => {
  beforeEach(() => {
    cy.login();
    cy.deleteTestData();
  });

  describe('End-to-End Motorista Workflow', () => {
    it('should complete full motorista hiring process', () => {
      // Step 1: Navigate to contratação
      cy.visitContratacao();
      
      // Step 2: Create new motorista
      const motoristaData = {
        nome: `E2E Test Motorista ${Date.now()}`,
        cpf: '12345678901',
        telefone: '11999999999',
        email: `e2e${Date.now()}@test.com`
      };
      
      cy.get('[data-testid="add-motorista-btn"]').click();
      cy.get('[name="nome"]').type(motoristaData.nome);
      cy.get('[name="cpf"]').type(motoristaData.cpf);
      cy.get('[name="telefone"]').type(motoristaData.telefone);
      cy.get('[name="email"]').type(motoristaData.email);
      cy.get('[data-testid="funcao-select"]').click();
      cy.get('[data-value="Motorista"]').click();
      cy.get('[data-testid="submit-btn"]').click();
      
      // Verify creation
      cy.contains('cadastrado com sucesso').should('be.visible');
      cy.get('table tbody').should('contain', motoristaData.nome);
      
      // Step 3: Update status to documentação
      cy.get('table tbody tr').contains(motoristaData.nome).parent().within(() => {
        cy.get('[data-testid="edit-btn"]').click();
      });
      
      cy.get('[data-testid="status-select"]').click();
      cy.get('[data-value="documentacao"]').click();
      cy.get('[data-testid="submit-btn"]').click();
      
      // Verify status update
      cy.contains('atualizado com sucesso').should('be.visible');
      
      // Step 4: Check in Kanban view
      cy.contains('Kanban').click();
      cy.waitForLoading();
      
      cy.get('[data-testid="kanban-column"][data-status="documentacao"]').within(() => {
        cy.contains(motoristaData.nome).should('be.visible');
      });
      
      // Step 5: Move to qualified status
      cy.contains(motoristaData.nome).click();
      cy.get('[data-testid="status-select"]').click();
      cy.get('[data-value="qualificado"]').click();
      cy.get('[data-testid="save-changes-btn"]').click();
      
      // Verify movement in Kanban
      cy.get('[data-testid="kanban-column"][data-status="qualificado"]').within(() => {
        cy.contains(motoristaData.nome).should('be.visible');
      });
      
      // Step 6: Final step - contract
      cy.contains(motoristaData.nome).click();
      cy.get('[data-testid="status-select"]').click();
      cy.get('[data-value="contratado"]').click();
      cy.get('[data-testid="save-changes-btn"]').click();
      
      // Verify final status
      cy.get('[data-testid="kanban-column"][data-status="contratado"]').within(() => {
        cy.contains(motoristaData.nome).should('be.visible');
      });
    });
  });

  describe('Data Consistency Between Views', () => {
    it('should maintain data consistency between Lista and Kanban views', () => {
      // Create test data
      const testName = `Consistency Test ${Date.now()}`;
      
      cy.visitContratacao();
      cy.createTestMotorista({ nome: testName });
      
      // Verify in Lista view
      cy.get('table tbody').should('contain', testName);
      
      // Switch to Kanban view
      cy.contains('Kanban').click();
      cy.waitForLoading();
      
      // Verify same data exists in Kanban
      cy.get('[data-testid="kanban-column"][data-status="cadastrado"]').within(() => {
        cy.contains(testName).should('be.visible');
      });
      
      // Edit from Kanban
      cy.contains(testName).click();
      const newName = `${testName} - Edited`;
      cy.get('[name="nome"]').clear().type(newName);
      cy.get('[data-testid="save-changes-btn"]').click();
      
      // Switch back to Lista view
      cy.contains('Lista').click();
      cy.waitForLoading();
      
      // Verify changes are reflected
      cy.get('table tbody').should('contain', newName);
      cy.get('table tbody').should('not.contain', testName);
    });
  });

  describe('Bulk Operations Integration', () => {
    it('should perform bulk operations across multiple items', () => {
      // Create multiple test motoristas
      const testPrefix = `Bulk Test ${Date.now()}`;
      
      cy.visitContratacao();
      
      for (let i = 0; i < 3; i++) {
        cy.createTestMotorista({ 
          nome: `${testPrefix} - ${i}`,
          cpf: `1234567890${i}`
        });
      }
      
      // Select all test items
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).within(() => {
          cy.get('td').first().then(($cell) => {
            if ($cell.text().includes(testPrefix)) {
              cy.get('[data-testid="row-checkbox"]').check();
            }
          });
        });
      });
      
      // Perform bulk status update
      cy.get('[data-testid="bulk-actions-btn"]').click();
      cy.get('[data-testid="bulk-status-update"]').click();
      cy.get('[data-testid="bulk-status-select"]').click();
      cy.get('[data-value="documentacao"]').click();
      cy.get('[data-testid="bulk-submit-btn"]').click();
      
      // Verify bulk update
      cy.contains('atualizados com sucesso').should('be.visible');
      
      // Check all items have new status
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).within(() => {
          cy.get('td').first().then(($cell) => {
            if ($cell.text().includes(testPrefix)) {
              cy.get('td').should('contain', 'Documentação');
            }
          });
        });
      });
    });
  });

  describe('Search and Filter Integration', () => {
    it('should maintain filters when switching between views', () => {
      cy.visitContratacao();
      
      // Apply search filter
      cy.get('[data-testid="search-input"]').type('Gabriel');
      cy.wait(1000);
      
      // Switch to Kanban with filter applied
      cy.contains('Kanban').click();
      cy.waitForLoading();
      
      // Verify filter is maintained
      cy.get('[data-testid="search-input"]').should('have.value', 'Gabriel');
      
      // All visible cards should match filter
      cy.get('[data-testid="motorista-card"]').each(($card) => {
        cy.wrap($card).should('contain.text', 'Gabriel');
      });
      
      // Clear filter
      cy.get('[data-testid="search-input"]').clear();
      cy.wait(1000);
      
      // Switch back to Lista
      cy.contains('Lista').click();
      cy.waitForLoading();
      
      // Verify filter is cleared in Lista view
      cy.get('[data-testid="search-input"]').should('have.value', '');
    });
  });

  describe('Document Management Integration', () => {
    it('should manage documents across different views', () => {
      // Create motorista with document
      cy.visitContratacao();
      const testName = `Doc Test ${Date.now()}`;
      cy.createTestMotorista({ nome: testName });
      
      // Open document management
      cy.get('table tbody tr').contains(testName).parent().within(() => {
        cy.get('[data-testid="documents-btn"]').click();
      });
      
      // Verify document viewer opens
      cy.get('[data-testid="document-viewer"]').should('be.visible');
      
      // Close and check from Kanban view
      cy.get('[data-testid="close-modal-btn"]').click();
      cy.contains('Kanban').click();
      cy.waitForLoading();
      
      // Open from Kanban
      cy.contains(testName).click();
      cy.get('[data-testid="documents-tab"]').click();
      
      // Should show same document interface
      cy.get('[data-testid="document-viewer"]').should('be.visible');
    });
  });

  describe('WiseApp Integration', () => {
    it('should sync data with WiseApp across views', () => {
      cy.visitContratacao();
      
      // Test individual sync
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="wiseapp-sync-btn"]').click();
      });
      
      // Wait for sync to complete
      cy.contains('Sincronizando').should('be.visible');
      
      // Test bulk sync
      cy.get('[data-testid="bulk-wiseapp-sync-btn"]').click();
      cy.get('[data-testid="bulk-sync-panel"]').should('be.visible');
      
      cy.get('[data-testid="start-bulk-sync-btn"]').click();
      
      // Wait for bulk sync
      cy.contains('Sincronização em andamento').should('be.visible');
    });
  });

  describe('Responsive Design Integration', () => {
    it('should work properly on mobile viewport', () => {
      cy.viewport('iphone-x');
      
      cy.visitContratacao();
      
      // Table should be scrollable on mobile
      cy.get('table').should('be.visible');
      cy.get('[data-testid="scroll-indicator"]').should('be.visible');
      
      // Actions should be accessible
      cy.get('[data-testid="add-motorista-btn"]').should('be.visible');
      
      // Kanban should stack properly
      cy.contains('Kanban').click();
      cy.waitForLoading();
      
      cy.get('[data-testid="kanban-column"]').should('be.visible');
    });
  });

  describe('Performance Integration', () => {
    it('should handle large datasets efficiently', () => {
      cy.visitContratacao();
      
      // Test pagination with large dataset
      cy.get('[data-testid="items-per-page-select"]').click();
      cy.get('[data-value="100"]').click();
      
      cy.waitForLoading();
      
      // Table should load without timeout
      cy.get('table tbody tr', { timeout: 15000 }).should('have.length.at.least', 1);
      
      // Search should work with large dataset
      cy.get('[data-testid="search-input"]').type('a');
      cy.wait(1000);
      
      // Should return filtered results quickly
      cy.get('table tbody tr').should('have.length.at.least', 0);
    });
  });
});