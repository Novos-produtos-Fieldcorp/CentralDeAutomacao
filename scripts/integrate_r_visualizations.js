/**
 * R Visualization Integration Script
 * 
 * This script provides utilities to integrate R visualizations with the React application.
 * It handles running R scripts, processing their output, and making the visualizations
 * available to the frontend.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { exportHodometrosData } = require('./export_hodometros_data');

// Configuration
const config = {
  // Path to R executable
  rPath: process.env.R_PATH || 'Rscript',
  
  // Path to R script
  rScriptPath: path.resolve(__dirname, 'driver_mileage_visualization.R'),
  
  // Output directory for visualizations
  outputDir: path.resolve(__dirname, '../public/visualizations'),
  
  // Default parameters
  defaultParams: {
    companyId: 1,
    startDate: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
    endDate: new Date()
  }
};

// Ensure output directory exists
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
}

/**
 * Run the R script with the provided data file
 * @param {string} dataFilePath - Path to the CSV data file
 * @param {Object} options - Additional options for the R script
 * @returns {Promise<Object>} - Paths to the generated visualization files
 */
async function runRVisualization(dataFilePath, options = {}) {
  return new Promise((resolve, reject) => {
    // Prepare arguments for R script
    const args = [
      config.rScriptPath,
      '--data', dataFilePath,
      '--output-dir', config.outputDir
    ];
    
    // Add any additional options
    if (options.threshold) args.push('--threshold', options.threshold);
    if (options.colorPalette) args.push('--color-palette', options.colorPalette);
    if (options.exportFormat) args.push('--export-format', options.exportFormat);
    
    console.log(`Running R script with args: ${args.join(' ')}`);
    
    // Spawn R process
    const rProcess = spawn(config.rPath, args);
    
    let stdout = '';
    let stderr = '';
    
    rProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`R stdout: ${data}`);
    });
    
    rProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`R stderr: ${data}`);
    });
    
    rProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`R process exited with code ${code}`);
        return reject(new Error(`R script failed with code ${code}: ${stderr}`));
      }
      
      // Parse output paths from stdout
      try {
        // The R script should output JSON with file paths
        const outputLines = stdout.split('\n').filter(line => line.trim().startsWith('{'));
        if (outputLines.length === 0) {
          throw new Error('No output paths found in R script output');
        }
        
        const outputPaths = JSON.parse(outputLines[outputLines.length - 1]);
        resolve(outputPaths);
      } catch (error) {
        console.error('Error parsing R script output:', error);
        reject(error);
      }
    });
  });
}

/**
 * Generate visualizations for the specified company and date range
 * @param {number} companyId - Company ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {Object} options - Additional options for the visualization
 * @returns {Promise<Object>} - Paths to the generated visualization files
 */
async function generateVisualizations(companyId, startDate, endDate, options = {}) {
  try {
    // Create a unique filename for this export
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dataFilePath = path.join(config.outputDir, `data_${companyId}_${timestamp}.csv`);
    
    // Export data to CSV
    await exportHodometrosData(companyId, startDate, endDate, dataFilePath);
    
    // Run R visualization
    const visualizationPaths = await runRVisualization(dataFilePath, options);
    
    // Return paths to the generated files
    return {
      dataFile: dataFilePath,
      ...visualizationPaths
    };
  } catch (error) {
    console.error('Error generating visualizations:', error);
    throw error;
  }
}

/**
 * Get the URL paths for the visualization files
 * @param {Object} filePaths - Paths to the visualization files
 * @returns {Object} - URL paths for the visualization files
 */
function getVisualizationUrls(filePaths) {
  const baseUrl = '/visualizations/';
  const urls = {};
  
  for (const [key, filePath] of Object.entries(filePaths)) {
    if (typeof filePath === 'string') {
      const fileName = path.basename(filePath);
      urls[key] = `${baseUrl}${fileName}`;
    }
  }
  
  return urls;
}

// Export functions for use in the application
module.exports = {
  generateVisualizations,
  getVisualizationUrls,
  config
};