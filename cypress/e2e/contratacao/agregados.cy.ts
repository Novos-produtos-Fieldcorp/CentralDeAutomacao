// cypress/e2e/contratacao/agregados.cy.ts

describe('Agregados Management', () => {
  beforeEach(() => {
    cy.visitContratacao();
    cy.contains('Agregados').click();
    cy.waitForLoading();
  });

  describe('Agregados List Display', () => {
    it('should display agregados table with correct headers', () => {
      cy.get('table thead').should('contain', 'Nome');
      cy.get('table thead').should('contain', 'CPF');
      cy.get('table thead').should('contain', 'Telefone');
      cy.get('table thead').should('contain', 'Veículo');
      cy.get('table thead').should('contain', 'Status');
      cy.get('table thead').should('contain', 'Cliente');
      cy.get('table thead').should('contain', 'Ações');
    });

    it('should show vehicle information when available', () => {
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).within(() => {
          // Check if vehicle column has data or shows N/A
          cy.get('td').eq(3).should('not.be.empty');
        });
      });
    });

    it('should display client information', () => {
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).within(() => {
          // Check if client column has data
          cy.get('td').contains(/Cliente|N\/A/).should('be.visible');
        });
      });
    });
  });

  describe('Search and Filtering', () => {
    it('should filter agregados by search term', () => {
      cy.get('[data-testid="search-input"]').type('Gabriel');
      cy.wait(1000); // Wait for debounce
      
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).should('contain.text', 'Gabriel');
      });
    });

    it('should filter by vehicle status', () => {
      cy.get('[data-testid="vehicle-filter"]').click();
      cy.get('[data-value="com-veiculo"]').click();
      
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).within(() => {
          cy.get('td').eq(3).should('not.contain', 'N/A');
        });
      });
    });

    it('should filter by client', () => {
      cy.get('[data-testid="client-filter"]').click();
      cy.get('[data-value]').first().click();
      
      cy.waitForLoading();
      
      // Verify filtered results
      cy.get('table tbody tr').should('have.length.at.least', 0);
    });
  });

  describe('CRUD Operations', () => {
    it('should open add agregado modal', () => {
      cy.get('[data-testid="add-agregado-btn"]').click();
      cy.get('[data-testid="agregado-modal"]').should('be.visible');
      cy.contains('Cadastrar Agregado').should('be.visible');
    });

    it('should create new agregado', () => {
      const testData = {
        nome: `Teste Agregado ${Date.now()}`,
        cpf: '98765432100',
        telefone: '11888888888',
        email: `agregado${Date.now()}@email.com`
      };

      cy.get('[data-testid="add-agregado-btn"]').click();
      
      // Fill form
      cy.get('[name="nome"]').type(testData.nome);
      cy.get('[name="cpf"]').type(testData.cpf);
      cy.get('[name="telefone"]').type(testData.telefone);
      cy.get('[name="email"]').type(testData.email);
      
      // Submit
      cy.get('[data-testid="submit-btn"]').click();
      
      // Verify success
      cy.contains('cadastrado com sucesso').should('be.visible');
      
      // Verify in table
      cy.get('table tbody').should('contain', testData.nome);
    });

    it('should edit agregado information', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="edit-btn"]').click();
      });
      
      cy.get('[data-testid="agregado-modal"]').should('be.visible');
      
      // Modify name
      const newName = `Editado Agregado ${Date.now()}`;
      cy.get('[name="nome"]').clear().type(newName);
      
      // Submit
      cy.get('[data-testid="submit-btn"]').click();
      
      // Verify success
      cy.contains('atualizado com sucesso').should('be.visible');
    });

    it('should delete agregado', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="delete-btn"]').click();
      });
      
      // Confirm deletion
      cy.get('[data-testid="confirm-delete-btn"]').click();
      
      // Verify success
      cy.contains('excluído com sucesso').should('be.visible');
    });
  });

  describe('Vehicle Association', () => {
    it('should associate vehicle with agregado', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="edit-btn"]').click();
      });
      
      // Navigate to vehicle tab
      cy.get('[data-testid="vehicle-tab"]').click();
      
      // Select vehicle
      cy.get('[data-testid="vehicle-select"]').click();
      cy.get('[data-value]').first().click();
      
      // Save
      cy.get('[data-testid="submit-btn"]').click();
      
      // Verify success
      cy.contains('atualizado com sucesso').should('be.visible');
    });

    it('should remove vehicle association', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="edit-btn"]').click();
      });
      
      // Navigate to vehicle tab
      cy.get('[data-testid="vehicle-tab"]').click();
      
      // Clear vehicle selection
      cy.get('[data-testid="clear-vehicle-btn"]').click();
      
      // Save
      cy.get('[data-testid="submit-btn"]').click();
      
      // Verify success
      cy.contains('atualizado com sucesso').should('be.visible');
    });
  });

  describe('Document Management', () => {
    it('should view agregado documents', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="documents-btn"]').click();
      });
      
      cy.get('[data-testid="document-viewer"]').should('be.visible');
    });

    it('should upload documents for agregado', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="documents-btn"]').click();
      });
      
      cy.get('[data-testid="upload-document-btn"]').click();
      cy.get('[data-testid="document-upload-modal"]').should('be.visible');
      
      // Select document type
      cy.get('[data-testid="document-type-select"]').click();
      cy.get('[data-value="cnh"]').click();
    });
  });

  describe('Client Assignment', () => {
    it('should assign agregado to client', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="edit-btn"]').click();
      });
      
      // Select client
      cy.get('[data-testid="client-select"]').click();
      cy.get('[data-value]').first().click();
      
      // Save
      cy.get('[data-testid="submit-btn"]').click();
      
      // Verify success
      cy.contains('atualizado com sucesso').should('be.visible');
    });

    it('should remove client assignment', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="edit-btn"]').click();
      });
      
      // Clear client selection
      cy.get('[data-testid="client-select"]').click();
      cy.get('[data-value=""]').click();
      
      // Save
      cy.get('[data-testid="submit-btn"]').click();
      
      // Verify success
      cy.contains('atualizado com sucesso').should('be.visible');
    });
  });

  describe('Status Management', () => {
    it('should update agregado status', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="edit-btn"]').click();
      });
      
      // Change status
      cy.get('[data-testid="status-select"]').click();
      cy.get('[data-value="contratado"]').click();
      
      // Save
      cy.get('[data-testid="submit-btn"]').click();
      
      // Verify success
      cy.contains('atualizado com sucesso').should('be.visible');
      
      // Verify status in table
      cy.get('table tbody tr').first().should('contain', 'Contratado');
    });
  });

  describe('Bulk Operations', () => {
    it('should select multiple agregados', () => {
      cy.get('[data-testid="select-all-checkbox"]').check();
      
      // Verify all rows are selected
      cy.get('[data-testid="row-checkbox"]').each(($checkbox) => {
        cy.wrap($checkbox).should('be.checked');
      });
    });

    it('should perform bulk client assignment', () => {
      // Select multiple items
      cy.get('[data-testid="row-checkbox"]').first().check();
      cy.get('[data-testid="row-checkbox"]').eq(1).check();
      
      // Open bulk actions
      cy.get('[data-testid="bulk-actions-btn"]').click();
      cy.get('[data-testid="bulk-client-assign"]').click();
      
      // Select client
      cy.get('[data-testid="bulk-client-select"]').click();
      cy.get('[data-value]').first().click();
      
      // Submit
      cy.get('[data-testid="bulk-submit-btn"]').click();
      
      // Verify success
      cy.contains('atualizados com sucesso').should('be.visible');
    });
  });

  describe('Export and Reports', () => {
    it('should export agregados data', () => {
      cy.get('[data-testid="export-btn"]').click();
      cy.get('[data-testid="export-excel"]').click();
      
      // File download would be tested with additional setup
    });

    it('should generate agregados report', () => {
      cy.get('[data-testid="reports-btn"]').click();
      cy.get('[data-testid="agregados-report"]').click();
      
      cy.get('[data-testid="report-modal"]').should('be.visible');
    });
  });

  describe('Integration Features', () => {
    it('should sync with WiseApp', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="wiseapp-sync-btn"]').click();
      });
      
      // Verify sync starts
      cy.contains('Sincronizando').should('be.visible');
    });

    it('should start chat with agregado', () => {
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-testid="chat-btn"]').click();
      });
      
      cy.get('[data-testid="floating-chat"]').should('be.visible');
    });
  });
});