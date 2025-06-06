/**
 * Export Hodometros Data for R Visualization
 * 
 * This script exports hodometros data from the application's database
 * to a CSV file that can be used with the R visualization script.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to format date as YYYY-MM-DD
const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

// Main export function
async function exportHodometrosData(companyId, startDate, endDate, outputPath) {
  try {
    console.log(`Exporting hodometros data for company ${companyId} from ${startDate} to ${endDate}`);
    
    // Query the database
    const { data, error } = await supabase
      .from('hodometro')
      .select(`
        *,
        motorista:motorista_id (
          motorista_id,
          nome,
          cpf
        ),
        veiculo:veiculo_id (
          veiculo_id,
          placa,
          marca,
          tipo
        ),
        cliente:cliente_id (
          cliente_id,
          nome
        )
      `)
      .eq('company_id', companyId)
      .gte('data', startDate)
      .lte('data', endDate)
      .order('data', { ascending: true });
    
    if (error) {
      throw new Error(`Error fetching data: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      console.log('No data found for the specified criteria');
      return;
    }
    
    console.log(`Found ${data.length} records`);
    
    // Process the data for R visualization
    const processedData = [];
    
    // Group by motorista and month
    const groupedData = {};
    
    data.forEach(hodometro => {
      if (!hodometro.motorista || !hodometro.veiculo) return;
      
      // Extract year and month from the date
      const date = new Date(hodometro.data);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Create a key for grouping
      const key = `${hodometro.motorista_id}_${yearMonth}`;
      
      if (!groupedData[key]) {
        groupedData[key] = {
          driver: hodometro.motorista.nome,
          driver_id: hodometro.motorista_id,
          date: yearMonth,
          mileage: 0,
          vehicle: hodometro.veiculo.placa,
          client: hodometro.cliente?.nome || 'No Client'
        };
      }
      
      // Add the mileage for this record
      groupedData[key].mileage += hodometro.km_rodado || 0;
    });
    
    // Convert grouped data to array
    for (const key in groupedData) {
      processedData.push(groupedData[key]);
    }
    
    // Sort by date and driver
    processedData.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.driver.localeCompare(b.driver);
    });
    
    // Write to CSV
    const csvHeader = 'driver,driver_id,date,mileage,vehicle,client\n';
    const csvRows = processedData.map(row => 
      `"${row.driver}",${row.driver_id},${row.date},${row.mileage},"${row.vehicle}","${row.client}"`
    );
    
    const csvContent = csvHeader + csvRows.join('\n');
    
    fs.writeFileSync(outputPath, csvContent);
    
    console.log(`Data exported successfully to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

// If running directly from command line
if (require.main === module) {
  // Default parameters
  const companyId = process.env.COMPANY_ID || 1;
  const endDate = formatDate(new Date());
  const startDate = formatDate(new Date(new Date().setFullYear(new Date().getFullYear() - 1)));
  const outputPath = path.resolve(__dirname, 'driver_mileage_data.csv');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  let customCompanyId, customStartDate, customEndDate, customOutputPath;
  
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === '--company-id' && args[i+1]) customCompanyId = args[i+1];
    if (args[i] === '--start-date' && args[i+1]) customStartDate = args[i+1];
    if (args[i] === '--end-date' && args[i+1]) customEndDate = args[i+1];
    if (args[i] === '--output' && args[i+1]) customOutputPath = args[i+1];
  }
  
  // Run the export function
  exportHodometrosData(
    customCompanyId || companyId,
    customStartDate || startDate,
    customEndDate || endDate,
    customOutputPath || outputPath
  ).catch(err => {
    console.error('Export failed:', err);
    process.exit(1);
  });
}

// Export the function for use in other scripts
module.exports = { exportHodometrosData };