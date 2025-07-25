// cypress/e2e/contratacao/motoristas-lista.cy.ts

describe('Motoristas Lista', () => {
  beforeEach(() => {
    cy.visitContratacao();
    cy.contains('Lista').click();
    cy.waitForLoading();
  });

  describe('Lista Display and Navigation', () => {
    it('should display the motoristas table with correct headers', () => {
      cy.get('table thead').should('contain', 'Nome');
      cy.get('table thead').should('contain', 'CPF');
      cy.get('table thead').should('contain', 'Telefone');
      cy.get('table thead').should('contain', 'Função');
      cy.get('table thead').should('contain', 'Status');
      cy.get('table thead').should('contain', 'Ações');
    });

    it('should display pagination controls when data exists', () => {
      cy.get('table tbody tr').then(($rows) => {
        if ($rows.length > 0) {
          cy.get('[data-testid="pagination"]').should('be.visible');
        }
      });
    });

    it('should filter by search term', () => {
      cy.get('[data-testid="search-input"]').type('Gabriel');
      cy.wait(1000); // Wait for debounce
      
      // Check that results are filtered
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).should('contain.text', 'Gabriel');
      });
    });

    it('should filter by function type', () => {
      cy.get('[data-testid="funcao-filter"]').click();
      cy.get('[data-value="Motorista"]').click();
      
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).should('contain.text', 'Motorista');
      });
    });

    it('should filter by status', () => {
      cy.get('[data-testid="status-filter"]').click();
      cy.get('[data-value="contratado"]').click();
      
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).should('contain.text', 'Contratado');
      });
    });
  });

  describe('CRUD Operations', () => {
    it('should open add motorista modal', () => {
      cy.get('[data-testid="add-motorista-btn"]').click();
      cy.get('[data-testid="motorista-modal"]').should('be.visible');
      cy.contains('Cadastrar Motorista').should('be.visible');
    });

    it('should create a new motorista', () => {
      const testData = {
        nome: `Teste Motorista ${Date.now()}`,
        cpf: '12345678901',
        telefone: '11999999999',
        email: `teste${Date.now()}@email.com`
      };

      cy.get('[data-testid="add-motorista-btn"]').click();
      
      // Fill form
      cy.get('[name="nome"]').type(testData.nome);
      cy.get('[name="cpf"]').type(testData.cpf);
      cy.get('[name="telefone"]').type(testData.telefone);
      cy.get('[name="email"]').type(testData.email);
      
      // Select function
      cy.get('[data-testid="funcao-select"]').click();
      cy.get('[data-value="Motorista"]').click();
      
      // Submit
      cy.get('[data-testid="submit-btn"]').click();
      
      // Verify success
      cy.contains('cadastrado com sucesso').should('be.visible');
      
      // Verify in table
      cy.get('table tbody').should('contain', testData.nome);
    });

    it('should edit an existing motorista', () => {
      // Get first row and click edit
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="edit-btn"]').click();
      });
      
      cy.get('[data-testid="motorista-modal"]').should('be.visible');
      
      // Modify name
      const newName = `Editado ${Date.now()}`;
      cy.get('[name="nome"]').clear().type(newName);
      
      // Submit
      cy.get('[data-testid="submit-btn"]').click();
      
      // Verify success
      cy.contains('atualizado com sucesso').should('be.visible');
    });

    it('should delete a motorista', () => {
      // Get first row and click delete
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="delete-btn"]').click();
      });
      
      // Confirm deletion
      cy.get('[data-testid="confirm-delete-btn"]').click();
      
      // Verify success
      cy.contains('excluído com sucesso').should('be.visible');
    });
  });

  describe('Bulk Operations', () => {
    it('should select multiple motoristas', () => {
      cy.get('[data-testid="select-all-checkbox"]').check();
      
      // Verify all rows are selected
      cy.get('[data-testid="row-checkbox"]').each(($checkbox) => {
        cy.wrap($checkbox).should('be.checked');
      });
      
      // Verify bulk actions are visible
      cy.get('[data-testid="bulk-actions"]').should('be.visible');
    });

    it('should perform bulk status update', () => {
      // Select multiple items
      cy.get('[data-testid="row-checkbox"]').first().check();
      cy.get('[data-testid="row-checkbox"]').eq(1).check();
      
      // Open bulk actions
      cy.get('[data-testid="bulk-actions-btn"]').click();
      cy.get('[data-testid="bulk-status-update"]').click();
      
      // Select new status
      cy.get('[data-testid="bulk-status-select"]').click();
      cy.get('[data-value="qualificado"]').click();
      
      // Submit
      cy.get('[data-testid="bulk-submit-btn"]').click();
      
      // Verify success
      cy.contains('atualizados com sucesso').should('be.visible');
    });

    it('should perform bulk delete', () => {
      // Select multiple items
      cy.get('[data-testid="row-checkbox"]').first().check();
      cy.get('[data-testid="row-checkbox"]').eq(1).check();
      
      // Open bulk actions
      cy.get('[data-testid="bulk-actions-btn"]').click();
      cy.get('[data-testid="bulk-delete"]').click();
      
      // Confirm deletion
      cy.get('[data-testid="confirm-bulk-delete-btn"]').click();
      
      // Verify success
      cy.contains('excluídos com sucesso').should('be.visible');
    });
  });

  describe('Document Management', () => {
    it('should open document viewer', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="documents-btn"]').click();
      });
      
      cy.get('[data-testid="document-viewer"]').should('be.visible');
    });

    it('should upload a document', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="documents-btn"]').click();
      });
      
      cy.get('[data-testid="upload-document-btn"]').click();
      cy.get('[data-testid="document-upload-modal"]').should('be.visible');
      
      // Select document type
      cy.get('[data-testid="document-type-select"]').click();
      cy.get('[data-value="rg"]').click();
      
      // Note: File upload testing would require actual file fixture
      // For now, we test the modal opens correctly
    });
  });

  describe('WiseApp Integration', () => {
    it('should display WiseApp sync button for each motorista', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="wiseapp-sync-btn"]').should('be.visible');
      });
    });

    it('should open bulk sync panel', () => {
      cy.get('[data-testid="bulk-wiseapp-sync-btn"]').click();
      cy.get('[data-testid="bulk-sync-panel"]').should('be.visible');
    });
  });

  describe('Messaging Integration', () => {
    it('should open chat for motorista', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="chat-btn"]').click();
      });
      
      // Chat should open (implementation depends on chat system)
      cy.get('[data-testid="floating-chat"]').should('be.visible');
    });

    it('should open mass message modal', () => {
      // Select multiple motoristas
      cy.get('[data-testid="row-checkbox"]').first().check();
      cy.get('[data-testid="row-checkbox"]').eq(1).check();
      
      cy.get('[data-testid="mass-message-btn"]').click();
      cy.get('[data-testid="mass-message-modal"]').should('be.visible');
    });
  });

  describe('Data Export', () => {
    it('should export data to Excel', () => {
      cy.get('[data-testid="export-btn"]').click();
      cy.get('[data-testid="export-excel"]').click();
      
      // Note: File download testing would require additional setup
      // For now, we test the button is clickable
    });
  });
});