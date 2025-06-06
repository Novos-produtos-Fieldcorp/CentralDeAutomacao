import React, { useState, useEffect } from 'react';
import { Loader2, Download, RefreshCw, Calendar, Filter, ChevronDown } from 'lucide-react';

interface RVisualizationEmbedProps {
  visualizationType: 'line' | 'changes' | 'interactive';
  title?: string;
  description?: string;
  imagePath?: string;
  htmlPath?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
  dateRange?: { startDate: string; endDate: string };
  onDateRangeChange?: (range: { startDate: string; endDate: string }) => void;
  downloadOptions?: {
    pngUrl?: string;
    csvUrl?: string;
    pdfUrl?: string;
  };
  className?: string;
}

const RVisualizationEmbed: React.FC<RVisualizationEmbedProps> = ({
  visualizationType,
  title = 'Driver Mileage Visualization',
  description,
  imagePath,
  htmlPath,
  onRefresh,
  isLoading = false,
  dateRange,
  onDateRangeChange,
  downloadOptions,
  className = ''
}) => {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [localDateRange, setLocalDateRange] = useState(dateRange || {
    startDate: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (dateRange) {
      setLocalDateRange(dateRange);
    }
  }, [dateRange]);

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const newRange = { ...localDateRange, [field]: value };
    setLocalDateRange(newRange);
    if (onDateRangeChange) {
      onDateRangeChange(newRange);
    }
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Selector */}
          {onDateRangeChange && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Calendar className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type="date"
                  value={localDateRange.startDate}
                  onChange={(e) => handleDateChange('startDate', e.target.value)}
                  className="pl-10 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <span className="text-gray-500 dark:text-gray-400">to</span>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Calendar className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type="date"
                  value={localDateRange.endDate}
                  onChange={(e) => handleDateChange('endDate', e.target.value)}
                  className="pl-10 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          )}
          
          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh visualization"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
            </button>
          )}
          
          {/* Download Button */}
          {downloadOptions && (
            <div className="relative">
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                Download
                <ChevronDown className="w-4 h-4 ml-1" />
              </button>
              
              {showDownloadMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700">
                  <div className="py-1">
                    {downloadOptions.pngUrl && (
                      <a
                        href={downloadOptions.pngUrl}
                        download
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                        onClick={() => setShowDownloadMenu(false)}
                      >
                        Download as PNG
                      </a>
                    )}
                    {downloadOptions.pdfUrl && (
                      <a
                        href={downloadOptions.pdfUrl}
                        download
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                        onClick={() => setShowDownloadMenu(false)}
                      >
                        Download as PDF
                      </a>
                    )}
                    {downloadOptions.csvUrl && (
                      <a
                        href={downloadOptions.csvUrl}
                        download
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                        onClick={() => setShowDownloadMenu(false)}
                      >
                        Download Data (CSV)
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Visualization Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-80">
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading visualization...</p>
            </div>
          </div>
        ) : visualizationType === 'interactive' && htmlPath ? (
          <div className="w-full h-[600px] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <iframe
              src={htmlPath}
              className="w-full h-full"
              title={title}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ) : imagePath ? (
          <div className="w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <img
              src={imagePath}
              alt={title}
              className="w-full h-auto"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-80 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">No visualization available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RVisualizationEmbed;