import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export const STATUS_MAPPING = {
  'Funcionando': {
    color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200',
    icon: CheckCircle2,
    severity: 1
  },
  'Queimado': {
    color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200',
    icon: XCircle,
    severity: 3
  },
  'Bom': {
    color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200',
    icon: CheckCircle2,
    severity: 1
  },
  'Quebrado': {
    color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200',
    icon: XCircle,
    severity: 3
  },
  'Ruim': {
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200',
    icon: AlertTriangle,
    severity: 2
  },
  'Meia Vida': {
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200',
    icon: AlertTriangle,
    severity: 2
  },
  'Pneu Dianteiro Esquerdo': {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
    icon: CheckCircle2,
    severity: 1
  },
  'Pneu Dianteiro Direito': {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
    icon: CheckCircle2,
    severity: 1
  },
  'Pneu Traseiro Esquerdo': {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
    icon: CheckCircle2,
    severity: 1
  },
  'Pneu Traseiro Direito': {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
    icon: CheckCircle2,
    severity: 1
  },
  'Queimado esquerdo': {
    color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200',
    icon: XCircle,
    severity: 3
  },
  'Queimado direito': {
    color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200',
    icon: XCircle,
    severity: 3
  },
  'Acima do nível': {
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200',
    icon: AlertTriangle,
    severity: 2
  },
  'No nível': {
    color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200',
    icon: CheckCircle2,
    severity: 1
  },
  'Abaixo do nível': {
    color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200',
    icon: XCircle,
    severity: 3
  },
  'Sim': {
    color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200',
    icon: CheckCircle2,
    severity: 1
  },
  'Não': {
    color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200',
    icon: XCircle,
    severity: 3
  },
  'Falta Macaco': {
    color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200',
    icon: XCircle,
    severity: 3
  }
} as const;

type StatusKey = keyof typeof STATUS_MAPPING;

export const getStatusInfo = (status: string) => {
  return STATUS_MAPPING[status as StatusKey] || {
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200',
    icon: AlertTriangle,
    severity: 0
  };
};

export const getStatusSeverityClass = (status: string) => {
  const info = getStatusInfo(status);
  switch (info.severity) {
    case 3:
      return 'border-red-200 dark:border-red-800';
    case 2:
      return 'border-yellow-200 dark:border-yellow-800';
    case 1:
      return 'border-green-200 dark:border-green-800';
    default:
      return 'border-gray-200 dark:border-gray-700';
  }
};