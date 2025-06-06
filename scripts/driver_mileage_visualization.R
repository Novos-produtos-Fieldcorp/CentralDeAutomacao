# Driver Mileage Visualization
# This script creates elegant visualizations for monthly mileage per driver

# Load required libraries
library(ggplot2)
library(dplyr)
library(lubridate)
library(scales)
library(plotly)
library(shiny)
library(shinydashboard)
library(DT)
library(RColorBrewer)

# Set a professional color palette
custom_palette <- brewer.pal(8, "Set2")

# Function to read and prepare data
prepare_data <- function(file_path = NULL) {
  # If no file is provided, use sample data
  if (is.null(file_path)) {
    # Create sample data
    set.seed(123)
    
    # Create a list of drivers
    drivers <- c("Carlos Silva", "Maria Oliveira", "João Santos", "Ana Pereira", "Roberto Almeida")
    
    # Create a date range for the last 12 months
    end_date <- Sys.Date()
    start_date <- end_date - months(11)
    months_seq <- seq(start_date, end_date, by = "month")
    
    # Generate sample data
    sample_data <- data.frame()
    
    for (driver in drivers) {
      # Base mileage for this driver (some drivers drive more than others)
      base_mileage <- runif(1, 1000, 3000)
      
      # Generate monthly data with some randomness and seasonal patterns
      for (i in 1:length(months_seq)) {
        month_date <- months_seq[i]
        
        # Add seasonal variation (more driving in summer months)
        month_num <- month(month_date)
        seasonal_factor <- ifelse(month_num >= 6 & month_num <= 8, 1.2, 
                                 ifelse(month_num >= 12 | month_num <= 2, 0.8, 1))
        
        # Add some random variation
        random_factor <- runif(1, 0.8, 1.2)
        
        # Calculate mileage for this month
        mileage <- base_mileage * seasonal_factor * random_factor
        
        # Add a row to the data frame
        sample_data <- rbind(sample_data, data.frame(
          driver = driver,
          date = month_date,
          mileage = round(mileage)
        ))
      }
    }
    
    return(sample_data)
  } else {
    # Read actual data from file
    data <- read.csv(file_path)
    
    # Process the data as needed
    # This would depend on the actual structure of your data
    
    return(data)
  }
}

# Function to create the line plot
create_line_plot <- function(data) {
  # Format the date for better display
  data$month <- format(data$date, "%b %Y")
  data$month <- factor(data$month, levels = unique(data$month))
  
  # Create the base plot
  p <- ggplot(data, aes(x = month, y = mileage, group = driver, color = driver)) +
    geom_line(size = 1) +
    geom_point(size = 3, shape = 21, fill = "white") +
    
    # Add smooth trend lines
    geom_smooth(method = "loess", se = FALSE, linetype = "dashed", alpha = 0.5) +
    
    # Customize the theme
    theme_minimal() +
    theme(
      text = element_text(family = "Arial", color = "#333333"),
      plot.title = element_text(size = 16, face = "bold", hjust = 0.5),
      plot.subtitle = element_text(size = 12, hjust = 0.5, margin = margin(b = 20)),
      axis.title = element_text(size = 12, face = "bold"),
      axis.text.x = element_text(angle = 45, hjust = 1, size = 10),
      axis.text.y = element_text(size = 10),
      panel.grid.major = element_line(color = "#e5e5e5"),
      panel.grid.minor = element_line(color = "#f0f0f0"),
      legend.position = "right",
      legend.title = element_text(size = 12, face = "bold"),
      legend.text = element_text(size = 10),
      legend.background = element_rect(fill = "#f8f8f8", color = NA),
      legend.key = element_rect(fill = NA, color = NA),
      plot.background = element_rect(fill = "white", color = NA),
      panel.background = element_rect(fill = "white", color = NA)
    ) +
    
    # Add labels
    labs(
      title = "Monthly Mileage per Driver",
      subtitle = paste("Period:", format(min(data$date), "%b %Y"), "to", format(max(data$date), "%b %Y")),
      x = "Month",
      y = "Total Kilometers",
      color = "Driver"
    ) +
    
    # Format y-axis with comma separator
    scale_y_continuous(labels = comma, 
                      breaks = pretty_breaks(n = 10),
                      expand = expansion(mult = c(0, 0.1))) +
    
    # Use a professional color palette
    scale_color_manual(values = custom_palette)
  
  return(p)
}

# Function to create an interactive version with plotly
create_interactive_plot <- function(data) {
  # Create the ggplot object
  p <- create_line_plot(data)
  
  # Convert to plotly for interactivity
  p_interactive <- ggplotly(p, tooltip = c("driver", "mileage", "month")) %>%
    layout(
      hoverlabel = list(
        bgcolor = "white",
        font = list(family = "Arial", size = 12, color = "#333333"),
        bordercolor = "transparent"
      ),
      legend = list(
        orientation = "v",
        x = 1.02,
        y = 0.5
      )
    )
  
  return(p_interactive)
}

# Function to highlight significant changes
highlight_significant_changes <- function(data, threshold_percent = 20) {
  # Calculate month-to-month changes for each driver
  changes <- data %>%
    arrange(driver, date) %>%
    group_by(driver) %>%
    mutate(
      prev_mileage = lag(mileage),
      change = mileage - prev_mileage,
      percent_change = ifelse(is.na(prev_mileage) | prev_mileage == 0, 0, (change / prev_mileage) * 100),
      significant = abs(percent_change) > threshold_percent
    )
  
  # Create a plot with highlighted significant changes
  p <- ggplot(changes, aes(x = format(date, "%b %Y"), y = mileage, group = driver, color = driver)) +
    geom_line(size = 1) +
    geom_point(size = 3, aes(shape = significant), fill = "white") +
    
    # Highlight significant changes
    geom_point(data = subset(changes, significant == TRUE), 
              aes(size = abs(percent_change)), 
              color = "red", alpha = 0.5) +
    
    # Customize the theme
    theme_minimal() +
    theme(
      text = element_text(family = "Arial", color = "#333333"),
      plot.title = element_text(size = 16, face = "bold", hjust = 0.5),
      plot.subtitle = element_text(size = 12, hjust = 0.5, margin = margin(b = 20)),
      axis.title = element_text(size = 12, face = "bold"),
      axis.text.x = element_text(angle = 45, hjust = 1, size = 10),
      axis.text.y = element_text(size = 10),
      panel.grid.major = element_line(color = "#e5e5e5"),
      panel.grid.minor = element_line(color = "#f0f0f0"),
      legend.position = "right",
      legend.title = element_text(size = 12, face = "bold"),
      legend.text = element_text(size = 10)
    ) +
    
    # Add labels
    labs(
      title = "Monthly Mileage with Significant Changes Highlighted",
      subtitle = paste("Significant change threshold:", threshold_percent, "%"),
      x = "Month",
      y = "Total Kilometers",
      color = "Driver",
      size = "% Change",
      shape = "Significant Change"
    ) +
    
    # Format y-axis with comma separator
    scale_y_continuous(labels = comma) +
    
    # Use a professional color palette
    scale_color_manual(values = custom_palette) +
    
    # Configure size scale for significant changes
    scale_size_continuous(range = c(3, 8))
  
  return(p)
}

# Create a Shiny app for interactive visualization
create_shiny_app <- function() {
  ui <- dashboardPage(
    dashboardHeader(title = "Driver Mileage Analysis"),
    dashboardSidebar(
      sidebarMenu(
        menuItem("Dashboard", tabName = "dashboard", icon = icon("dashboard")),
        menuItem("Data Table", tabName = "data", icon = icon("table")),
        menuItem("Settings", tabName = "settings", icon = icon("sliders"))
      ),
      dateRangeInput("date_range", "Date Range:",
                    start = Sys.Date() - months(11),
                    end = Sys.Date()),
      selectInput("threshold", "Significance Threshold (%)",
                 choices = c(10, 15, 20, 25, 30),
                 selected = 20),
      checkboxGroupInput("drivers", "Select Drivers:",
                        choices = NULL,
                        selected = NULL),
      downloadButton("downloadData", "Export Data"),
      downloadButton("downloadPlot", "Export Plot")
    ),
    dashboardBody(
      tabItems(
        tabItem(tabName = "dashboard",
               fluidRow(
                 box(plotlyOutput("mileagePlot", height = 400), width = 12),
                 box(plotOutput("changePlot", height = 400), width = 12)
               )),
        tabItem(tabName = "data",
               fluidRow(
                 box(DTOutput("dataTable"), width = 12)
               )),
        tabItem(tabName = "settings",
               fluidRow(
                 box(
                   title = "Visualization Settings",
                   sliderInput("lineSize", "Line Size:", min = 0.5, max = 3, value = 1, step = 0.1),
                   sliderInput("pointSize", "Point Size:", min = 1, max = 5, value = 3, step = 0.1),
                   selectInput("colorPalette", "Color Palette:",
                              choices = c("Set1", "Set2", "Set3", "Dark2", "Paired", "Accent"),
                              selected = "Set2"),
                   checkboxInput("showTrendline", "Show Trend Lines", value = TRUE),
                   width = 6
                 ),
                 box(
                   title = "Export Settings",
                   selectInput("exportFormat", "Export Format:",
                              choices = c("PNG", "PDF", "SVG", "JPEG"),
                              selected = "PNG"),
                   sliderInput("exportWidth", "Width (inches):", min = 5, max = 20, value = 10),
                   sliderInput("exportHeight", "Height (inches):", min = 3, max = 15, value = 6),
                   sliderInput("exportRes", "Resolution (dpi):", min = 72, max = 600, value = 300),
                   width = 6
                 )
               ))
      )
    )
  )
  
  server <- function(input, output, session) {
    # Prepare data
    data <- reactive({
      prepare_data()
    })
    
    # Update driver choices
    observe({
      driver_choices <- unique(data()$driver)
      updateCheckboxGroupInput(session, "drivers",
                              choices = driver_choices,
                              selected = driver_choices)
    })
    
    # Filter data based on inputs
    filtered_data <- reactive({
      req(input$drivers)
      
      data() %>%
        filter(
          driver %in% input$drivers,
          date >= input$date_range[1],
          date <= input$date_range[2]
        )
    })
    
    # Create the main mileage plot
    output$mileagePlot <- renderPlotly({
      req(filtered_data())
      
      p <- ggplot(filtered_data(), aes(x = format(date, "%b %Y"), y = mileage, group = driver, color = driver)) +
        geom_line(size = input$lineSize) +
        geom_point(size = input$pointSize, shape = 21, fill = "white") +
        
        # Add trend lines if selected
        {if(input$showTrendline) geom_smooth(method = "loess", se = FALSE, linetype = "dashed", alpha = 0.5)} +
        
        # Customize the theme
        theme_minimal() +
        theme(
          text = element_text(family = "Arial", color = "#333333"),
          plot.title = element_text(size = 16, face = "bold", hjust = 0.5),
          plot.subtitle = element_text(size = 12, hjust = 0.5, margin = margin(b = 20)),
          axis.title = element_text(size = 12, face = "bold"),
          axis.text.x = element_text(angle = 45, hjust = 1, size = 10),
          axis.text.y = element_text(size = 10),
          panel.grid.major = element_line(color = "#e5e5e5"),
          panel.grid.minor = element_line(color = "#f0f0f0"),
          legend.position = "right",
          legend.title = element_text(size = 12, face = "bold"),
          legend.text = element_text(size = 10)
        ) +
        
        # Add labels
        labs(
          title = "Monthly Mileage per Driver",
          subtitle = paste("Period:", format(min(filtered_data()$date), "%b %Y"), 
                          "to", format(max(filtered_data()$date), "%b %Y")),
          x = "Month",
          y = "Total Kilometers",
          color = "Driver"
        ) +
        
        # Format y-axis with comma separator
        scale_y_continuous(labels = comma) +
        
        # Use selected color palette
        scale_color_brewer(palette = input$colorPalette)
      
      ggplotly(p, tooltip = c("driver", "mileage", "x")) %>%
        layout(
          hoverlabel = list(
            bgcolor = "white",
            font = list(family = "Arial", size = 12, color = "#333333"),
            bordercolor = "transparent"
          ),
          legend = list(
            orientation = "v",
            x = 1.02,
            y = 0.5
          )
        )
    })
    
    # Create the significant changes plot
    output$changePlot <- renderPlot({
      req(filtered_data())
      
      # Calculate month-to-month changes for each driver
      changes <- filtered_data() %>%
        arrange(driver, date) %>%
        group_by(driver) %>%
        mutate(
          prev_mileage = lag(mileage),
          change = mileage - prev_mileage,
          percent_change = ifelse(is.na(prev_mileage) | prev_mileage == 0, 0, (change / prev_mileage) * 100),
          significant = abs(percent_change) > as.numeric(input$threshold)
        )
      
      # Create a plot with highlighted significant changes
      ggplot(changes, aes(x = format(date, "%b %Y"), y = mileage, group = driver, color = driver)) +
        geom_line(size = input$lineSize) +
        geom_point(size = input$pointSize, aes(shape = significant), fill = "white") +
        
        # Highlight significant changes
        geom_point(data = subset(changes, significant == TRUE), 
                  aes(size = abs(percent_change)), 
                  color = "red", alpha = 0.5) +
        
        # Customize the theme
        theme_minimal() +
        theme(
          text = element_text(family = "Arial", color = "#333333"),
          plot.title = element_text(size = 16, face = "bold", hjust = 0.5),
          plot.subtitle = element_text(size = 12, hjust = 0.5, margin = margin(b = 20)),
          axis.title = element_text(size = 12, face = "bold"),
          axis.text.x = element_text(angle = 45, hjust = 1, size = 10),
          axis.text.y = element_text(size = 10),
          panel.grid.major = element_line(color = "#e5e5e5"),
          panel.grid.minor = element_line(color = "#f0f0f0"),
          legend.position = "right",
          legend.title = element_text(size = 12, face = "bold"),
          legend.text = element_text(size = 10)
        ) +
        
        # Add labels
        labs(
          title = "Monthly Mileage with Significant Changes Highlighted",
          subtitle = paste("Significant change threshold:", input$threshold, "%"),
          x = "Month",
          y = "Total Kilometers",
          color = "Driver",
          size = "% Change",
          shape = "Significant Change"
        ) +
        
        # Format y-axis with comma separator
        scale_y_continuous(labels = comma) +
        
        # Use selected color palette
        scale_color_brewer(palette = input$colorPalette) +
        
        # Configure size scale for significant changes
        scale_size_continuous(range = c(3, 8))
    })
    
    # Create the data table
    output$dataTable <- renderDT({
      req(filtered_data())
      
      # Prepare data for the table
      table_data <- filtered_data() %>%
        mutate(
          Month = format(date, "%b %Y"),
          Date = format(date, "%Y-%m-%d"),
          Driver = driver,
          `Kilometers Driven` = mileage
        ) %>%
        select(Date, Month, Driver, `Kilometers Driven`)
      
      # Create the data table
      datatable(
        table_data,
        options = list(
          pageLength = 15,
          autoWidth = TRUE,
          dom = 'Bfrtip',
          buttons = c('copy', 'csv', 'excel', 'pdf')
        ),
        rownames = FALSE,
        filter = 'top',
        class = 'cell-border stripe'
      ) %>%
        formatRound(columns = 'Kilometers Driven', digits = 0)
    })
    
    # Download handlers
    output$downloadData <- downloadHandler(
      filename = function() {
        paste("driver-mileage-data-", Sys.Date(), ".csv", sep = "")
      },
      content = function(file) {
        write.csv(filtered_data(), file, row.names = FALSE)
      }
    )
    
    output$downloadPlot <- downloadHandler(
      filename = function() {
        paste("driver-mileage-plot-", Sys.Date(), ".", tolower(input$exportFormat), sep = "")
      },
      content = function(file) {
        # Create the plot
        p <- ggplot(filtered_data(), aes(x = format(date, "%b %Y"), y = mileage, group = driver, color = driver)) +
          geom_line(size = input$lineSize) +
          geom_point(size = input$pointSize, shape = 21, fill = "white") +
          
          # Add trend lines if selected
          {if(input$showTrendline) geom_smooth(method = "loess", se = FALSE, linetype = "dashed", alpha = 0.5)} +
          
          # Customize the theme
          theme_minimal() +
          theme(
            text = element_text(family = "Arial", color = "#333333"),
            plot.title = element_text(size = 16, face = "bold", hjust = 0.5),
            plot.subtitle = element_text(size = 12, hjust = 0.5, margin = margin(b = 20)),
            axis.title = element_text(size = 12, face = "bold"),
            axis.text.x = element_text(angle = 45, hjust = 1, size = 10),
            axis.text.y = element_text(size = 10),
            panel.grid.major = element_line(color = "#e5e5e5"),
            panel.grid.minor = element_line(color = "#f0f0f0"),
            legend.position = "right",
            legend.title = element_text(size = 12, face = "bold"),
            legend.text = element_text(size = 10)
          ) +
          
          # Add labels
          labs(
            title = "Monthly Mileage per Driver",
            subtitle = paste("Period:", format(min(filtered_data()$date), "%b %Y"), 
                            "to", format(max(filtered_data()$date), "%b %Y")),
            x = "Month",
            y = "Total Kilometers",
            color = "Driver"
          ) +
          
          # Format y-axis with comma separator
          scale_y_continuous(labels = comma) +
          
          # Use selected color palette
          scale_color_brewer(palette = input$colorPalette)
        
        # Save the plot in the selected format
        ggsave(file, plot = p, width = input$exportWidth, height = input$exportHeight, 
              dpi = input$exportRes, device = tolower(input$exportFormat))
      }
    )
  }
  
  shinyApp(ui, server)
}

# Function to export data to various formats
export_mileage_data <- function(data, format = "csv", file_name = "driver_mileage_data") {
  file_path <- paste0(file_name, ".", format)
  
  if (format == "csv") {
    write.csv(data, file_path, row.names = FALSE)
  } else if (format == "excel") {
    library(writexl)
    write_xlsx(data, file_path)
  } else if (format == "json") {
    library(jsonlite)
    write_json(data, file_path)
  }
  
  return(file_path)
}

# Main execution
if (!interactive()) {
  # When running as a script
  data <- prepare_data()
  
  # Create and save the basic plot
  p <- create_line_plot(data)
  ggsave("driver_mileage_plot.png", p, width = 10, height = 6, dpi = 300)
  
  # Create and save the interactive plot
  p_interactive <- create_interactive_plot(data)
  htmlwidgets::saveWidget(p_interactive, "driver_mileage_interactive.html")
  
  # Create and save the significant changes plot
  p_changes <- highlight_significant_changes(data)
  ggsave("driver_mileage_changes.png", p_changes, width = 10, height = 6, dpi = 300)
  
  # Export the data
  export_mileage_data(data, "csv")
} else {
  # When running interactively, launch the Shiny app
  create_shiny_app()
}