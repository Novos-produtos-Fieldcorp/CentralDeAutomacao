# Driver Mileage Visualization

This directory contains R scripts for creating elegant and responsive visualizations of monthly mileage per driver from the readings dataset.

## Overview

The main script `driver_mileage_visualization.R` provides comprehensive functionality for analyzing and visualizing driver mileage data, including:

- Line plots showing monthly mileage per driver
- Interactive visualizations with tooltips
- Trend analysis and significant change detection
- Data export capabilities
- A complete Shiny dashboard for interactive exploration

## Requirements

The script requires the following R packages:

```r
install.packages(c("ggplot2", "dplyr", "lubridate", "scales", "plotly", 
                  "shiny", "shinydashboard", "DT", "RColorBrewer"))
```

## Usage

### Basic Usage

To generate static visualizations, run the script directly:

```r
Rscript driver_mileage_visualization.R
```

This will:
1. Generate sample data (or use your provided data)
2. Create and save static visualizations
3. Export the data to CSV format

### Interactive Dashboard

For a fully interactive experience, run the script in R:

```r
source("driver_mileage_visualization.R")
create_shiny_app()
```

This launches a Shiny dashboard with:
- Interactive line plots
- Date range selection
- Driver filtering
- Significant change detection
- Data table view
- Export capabilities

### Integration with Web Application

To integrate with a web application:

1. Use the R script to generate visualizations and save them as static files
2. Serve these files through your web application
3. For real-time integration, consider using an R API service like Plumber

## Features

### Visualization Features

- **Professional Color Scheme**: Uses carefully selected color palettes from RColorBrewer
- **Responsive Layout**: Visualizations adapt to different screen sizes
- **Grid Lines**: Clear grid lines for better readability
- **Formatted Axis Labels**: Properly formatted with thousands separators
- **Interactive Tooltips**: Hover over data points to see exact values
- **Trend Lines**: Smooth trend lines to identify patterns
- **Significant Change Highlighting**: Automatically detects and highlights significant changes in mileage

### Data Features

- **Monthly Aggregation**: Automatically aggregates data by month
- **Date Range Selection**: Filter data by custom date ranges
- **Driver Filtering**: Include or exclude specific drivers
- **Export Functionality**: Export data and visualizations in multiple formats

## Customization

The script provides several customization options:

- **Color Palettes**: Change the `custom_palette` variable or use the dashboard settings
- **Significance Threshold**: Adjust the `threshold_percent` parameter
- **Line and Point Styles**: Modify the ggplot aesthetics or use the dashboard settings
- **Export Formats**: Choose from PNG, PDF, SVG, or JPEG formats

## Example Output

When run, the script generates:

- `driver_mileage_plot.png`: Static line plot of monthly mileage
- `driver_mileage_interactive.html`: Interactive HTML visualization
- `driver_mileage_changes.png`: Plot highlighting significant changes
- `driver_mileage_data.csv`: Exported data in CSV format

## Integration with React Application

To integrate these visualizations with the React application:

1. Set up an R server (like Shiny Server or Plumber API)
2. Configure the server to read data from your application's database
3. Create API endpoints that return visualization data or rendered images
4. Use React components to fetch and display the visualizations

Alternatively, for simpler integration:

1. Run the R script periodically as a scheduled task
2. Save the output files to a location accessible by your web application
3. Display the static visualizations in your React components