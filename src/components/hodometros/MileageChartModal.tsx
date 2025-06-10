import React from 'react';
import { X, BarChart2, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

interface MonthlyData {
  month: string;
  km: number;
}

interface MileageChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: MonthlyData[];
  driverName: string;
}

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const MileageChartModal: React.FC<MileageChartModalProps> = ({ 
  isOpen, 
  onClose, 
  data,
  driverName
}) => {
  const chartRef = React.useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const exportToPDF = async () => {
    if (!chartRef.current) return;
    
    try {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 280;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.setFontSize(16);
      pdf.text(`Quilometragem Mensal: ${driverName}`, 15, 15);
      
      pdf.addImage(imgData, 'PNG', 10, 25, imgWidth, imgHeight);
      pdf.save(`quilometragem_${driverName.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error exporting chart to PDF:', error);
    }
  };

  // Format number with dot as thousands separator
  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR');
  };

  // ApexCharts options
  const chartOptions: ApexOptions = {
    chart: {
      type: 'bar',
      height: 350,
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: false,
          zoomin: false,
          zoomout: false,
          pan: false,
          reset: false
        }
      },
      background: 'transparent'
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '60%',
      }
    },
    colors: ['#3B82F6'],
    dataLabels: {
      enabled: true,
      formatter: function(val) {
        return formatNumber(val as number);
      },
      style: {
        colors: ['#fff'],
        fontSize: '12px'
      },
      offsetY: -20
    },
    xaxis: {
      categories: data.map(item => item.month),
      labels: {
        style: {
          colors: '#9CA3AF'
        },
        rotate: -45,
        rotateAlways: false,
        hideOverlappingLabels: true,
        trim: true,
        maxHeight: 120
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      labels: {
        formatter: function(val) {
          return formatNumber(val);
        },
        style: {
          colors: '#9CA3AF'
        }
      }
    },
    grid: {
      borderColor: '#374151',
      opacity: 0.1,
      strokeDashArray: 3
    },
    theme: {
      mode: 'dark'
    },
    title: {
      text: `Quilometragem Mensal: ${driverName}`,
      align: 'center',
      style: {
        fontSize: '16px',
        color: '#fff'
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            Análise de Quilometragem
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToPDF}
              className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Exportar como PDF"
            >
              <Download size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="p-6" ref={chartRef}>
          <div className="h-64 w-full mb-6">
            {data.length > 0 && (
              <Chart
                options={chartOptions}
                series={[{
                  name: 'Quilômetros',
                  data: data.map(item => item.km)
                }]}
                type="bar"
                height={350}
              />
            )}
          </div>
          
          {/* Data table */}
          <div className="mt-8">
            <h4 className="text-base font-medium text-gray-900 dark:text-white mb-4">
              Dados Detalhados
            </h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Mês
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Quilômetros Rodados
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {data.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {item.month}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-blue-600 dark:text-blue-400">
                        {formatNumber(item.km)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      Total
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-blue-600 dark:text-blue-400">
                      {formatNumber(data.reduce((sum, item) => sum + item.km, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MileageChartModal;