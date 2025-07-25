# Cypress Testing for Contratação Module

This document describes the comprehensive test suite implemented for the Contratação (Hiring) module of the application.

## Overview

The test suite covers all major functionality of the contratação system including:
- Dashboard statistics and charts
- Motorista (Driver) management in List view
- Kanban board functionality
- Agregados (Contractors) management
- Integration testing across different views
- End-to-end workflows

## Test Structure

### Test Files

#### E2E Tests
- `cypress/e2e/contratacao/dashboard.cy.ts` - Dashboard functionality tests
- `cypress/e2e/contratacao/motoristas-lista.cy.ts` - List view comprehensive tests
- `cypress/e2e/contratacao/kanban.cy.ts` - Kanban board tests
- `cypress/e2e/contratacao/agregados.cy.ts` - Agregados management tests
- `cypress/e2e/contratacao/integration.cy.ts` - Cross-feature integration tests

#### Support Files
- `cypress/support/e2e.ts` - Main support file with type definitions
- `cypress/support/commands.ts` - Custom Cypress commands
- `cypress/support/component.ts` - Component testing support

#### Configuration
- `cypress.config.ts` - Main Cypress configuration
- `cypress/fixtures/test-data.json` - Test data fixtures

## Custom Commands

### Authentication & Navigation
- `cy.login(accountId)` - Login with specific account ID
- `cy.visitContratacao()` - Navigate to contratação section
- `cy.waitForLoading()` - Wait for loading states to complete

### Data Management
- `cy.createTestMotorista(data)` - Create test motorista
- `cy.deleteTestData()` - Clean up test data
- `cy.checkTableData(expectedData)` - Verify table contents

### Element Selection
- `cy.getByTestId(testId)` - Get elements by test ID

## Test Coverage

### Dashboard Tests
- ✅ Statistics cards display
- ✅ Monthly registration charts
- ✅ Client ranking tables
- ✅ Navigation between sections
- ✅ Data refresh functionality

### Motoristas Lista Tests
- ✅ Table display and pagination
- ✅ Search and filtering
- ✅ CRUD operations (Create, Read, Update, Delete)
- ✅ Bulk operations
- ✅ Document management
- ✅ WiseApp integration
- ✅ Messaging integration
- ✅ Data export

### Kanban Tests
- ✅ Board layout and columns
- ✅ Card display and information
- ✅ Drag and drop functionality
- ✅ Status updates
- ✅ Filtering and search
- ✅ Pagination within columns
- ✅ Quick actions
- ✅ Modal interactions

### Agregados Tests
- ✅ List display and management
- ✅ Vehicle association
- ✅ Client assignment
- ✅ Document management
- ✅ Status management
- ✅ Bulk operations
- ✅ Integration features

### Integration Tests
- ✅ End-to-end motorista workflow
- ✅ Data consistency between views
- ✅ Bulk operations across views
- ✅ Filter persistence
- ✅ Document management integration
- ✅ WiseApp sync integration
- ✅ Responsive design
- ✅ Performance with large datasets

## Running Tests

### Prerequisites
Make sure the application is running:
```bash
npm run dev
```

### Run All Contratação Tests
```bash
npx cypress run --spec 'cypress/e2e/contratacao/**/*.cy.ts'
```

### Run Specific Test File
```bash
npx cypress run --spec 'cypress/e2e/contratacao/dashboard.cy.ts'
npx cypress run --spec 'cypress/e2e/contratacao/motoristas-lista.cy.ts'
npx cypress run --spec 'cypress/e2e/contratacao/kanban.cy.ts'
npx cypress run --spec 'cypress/e2e/contratacao/agregados.cy.ts'
npx cypress run --spec 'cypress/e2e/contratacao/integration.cy.ts'
```

### Open Cypress GUI
```bash
npx cypress open
```

### Run Component Tests
```bash
npx cypress run --component
```

## Test Data Requirements

### Test Attributes
Tests rely on `data-testid` attributes in components. Key test IDs include:

#### Navigation & Layout
- `add-motorista-btn` - Add new motorista button
- `add-agregado-btn` - Add new agregado button
- `search-input` - Search input field
- `pagination` - Pagination controls

#### Filters
- `funcao-filter` - Function filter dropdown
- `status-filter` - Status filter dropdown
- `client-filter` - Client filter dropdown
- `vehicle-filter` - Vehicle filter dropdown

#### Actions
- `edit-btn` - Edit button for rows
- `delete-btn` - Delete button for rows
- `documents-btn` - Documents button for rows
- `chat-btn` - Chat button for rows
- `wiseapp-sync-btn` - WiseApp sync button

#### Bulk Operations
- `select-all-checkbox` - Select all checkbox
- `row-checkbox` - Individual row checkbox
- `bulk-actions-btn` - Bulk actions button
- `bulk-delete` - Bulk delete action
- `bulk-status-update` - Bulk status update

#### Modals & Forms
- `motorista-modal` - Motorista modal container
- `agregado-modal` - Agregado modal container
- `submit-btn` - Form submit button
- `confirm-delete-btn` - Confirm deletion button

#### Kanban Specific
- `kanban-column` - Kanban columns
- `motorista-card` - Motorista cards
- `column-header` - Column headers
- `card-edit-btn` - Card edit button
- `card-chat-btn` - Card chat button

### Test Data
Tests use the fixture data in `cypress/fixtures/test-data.json` including:
- Sample motoristas with different statuses
- Document templates
- Vehicle information
- Client data

## Best Practices

### Writing Tests
1. Use descriptive test names
2. Group related tests in `describe` blocks
3. Use `beforeEach` for common setup
4. Clean up test data after tests
5. Use custom commands for repetitive actions

### Test Data
1. Create unique test data using timestamps
2. Clean up after each test
3. Use fixtures for consistent test data
4. Don't rely on existing production data

### Assertions
1. Wait for elements to be visible before interacting
2. Use specific assertions (contain, have.class, etc.)
3. Verify success messages after actions
4. Check data consistency across views

### Debugging
1. Use `cy.debug()` for debugging
2. Add screenshots for failed tests
3. Use browser dev tools in Cypress GUI
4. Check network requests in Cypress GUI

## Maintenance

### Adding New Tests
1. Identify the feature to test
2. Add appropriate test IDs to components
3. Write test following existing patterns
4. Update this documentation

### Updating Tests
1. Update tests when UI changes
2. Maintain test ID consistency
3. Update custom commands as needed
4. Keep fixture data current

## Known Issues & Limitations

1. File upload testing requires additional setup
2. Drag and drop testing needs special configuration
3. Real-time features may need special handling
4. External API calls should be mocked for consistency

## Future Improvements

1. Add visual regression testing
2. Implement accessibility testing
3. Add performance testing
4. Create automated test data generation
5. Add database state verification