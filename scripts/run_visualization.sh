#!/bin/bash
# Script to run the R visualization with sample data or exported data

# Set the directory of this script as the working directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Default values
COMPANY_ID=1
START_DATE=$(date -d "1 year ago" +%Y-%m-%d)
END_DATE=$(date +%Y-%m-%d)
OUTPUT_DIR="../public/visualizations"
USE_SAMPLE_DATA=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --company-id)
      COMPANY_ID="$2"
      shift
      shift
      ;;
    --start-date)
      START_DATE="$2"
      shift
      shift
      ;;
    --end-date)
      END_DATE="$2"
      shift
      shift
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift
      shift
      ;;
    --sample)
      USE_SAMPLE_DATA=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# If using sample data, run R script directly
if [ "$USE_SAMPLE_DATA" = true ]; then
  echo "Running R visualization with sample data..."
  Rscript driver_mileage_visualization.R
else
  # Export data first, then run R visualization
  echo "Exporting data for company $COMPANY_ID from $START_DATE to $END_DATE..."
  DATA_FILE="$OUTPUT_DIR/driver_mileage_data_$(date +%Y%m%d_%H%M%S).csv"
  
  # Run the export script
  node export_hodometros_data.js --company-id "$COMPANY_ID" --start-date "$START_DATE" --end-date "$END_DATE" --output "$DATA_FILE"
  
  # Check if export was successful
  if [ $? -ne 0 ]; then
    echo "Error exporting data. Exiting."
    exit 1
  fi
  
  echo "Data exported to $DATA_FILE"
  echo "Running R visualization..."
  
  # Run R script with the exported data
  Rscript driver_mileage_visualization.R "$DATA_FILE"
fi

echo "Visualization complete. Output files are in $OUTPUT_DIR"