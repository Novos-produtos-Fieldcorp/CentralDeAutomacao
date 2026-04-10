import React from "react";

export interface ListRefreshSkeletonColumn {
  width: string;
  headerWidth?: string;
  cellType?:
    | "text"
    | "double"
    | "checkbox"
    | "pill"
    | "toggle"
    | "actions"
    | "avatar-text"
    | "icon-text"
    | "checkbox-text"
    | "icon-toggle"
    | "actions-toggle";
  align?: "left" | "center" | "right";
  cellClassName?: string;
}

interface ListRefreshSkeletonProps {
  rows?: number;
  columns?: number;
  schema?: ListRefreshSkeletonColumn[];
  bodyCellClassName?: string;
  rowClassName?: string;
}

export type ListRefreshSkeletonVariant =
  | "agregados"
  | "motoristas"
  | "contratados"
  | "inativos";

interface ListRefreshSkeletonPreset {
  rows: number;
  bodyCellClassName: string;
  rowClassName: string;
  schema: ListRefreshSkeletonColumn[];
}

const DEFAULT_ROW_CLASS_NAME = "bg-white dark:bg-gray-800";
const DEFAULT_BODY_CELL_CLASS_NAME = "px-6 py-4";
const COMPACT_BODY_CELL_CLASS_NAME = "px-4 py-3";

export const LIST_REFRESH_SKELETON_PRESETS: Record<
  ListRefreshSkeletonVariant,
  ListRefreshSkeletonPreset
> = {
  agregados: {
    rows: 7,
    bodyCellClassName: DEFAULT_BODY_CELL_CLASS_NAME,
    rowClassName: DEFAULT_ROW_CLASS_NAME,
    schema: [
      { width: "56px", headerWidth: "16px", cellType: "checkbox", align: "center", cellClassName: "whitespace-nowrap" },
      { width: "2.15fr", headerWidth: "34%", cellType: "avatar-text" },
      { width: "0.95fr", headerWidth: "36%", cellType: "text", cellClassName: "whitespace-nowrap" },
      { width: "1.45fr", headerWidth: "44%", cellType: "double" },
      { width: "1fr", headerWidth: "34%", cellType: "pill", cellClassName: "whitespace-nowrap" },
      { width: "130px", headerWidth: "44%", cellType: "pill", cellClassName: "px-3 py-4 whitespace-nowrap w-[130px] max-w-[130px]" },
      { width: "0.95fr", headerWidth: "40%", cellType: "text", cellClassName: "whitespace-nowrap" },
      { width: "1.35fr", headerWidth: "54%", cellType: "double" },
      { width: "1.05fr", headerWidth: "38%", cellType: "double" },
      { width: "1.05fr", headerWidth: "44%", cellType: "pill", cellClassName: "whitespace-nowrap" },
      { width: "0.95fr", headerWidth: "52%", cellType: "text", cellClassName: "whitespace-nowrap" },
      { width: "132px", headerWidth: "36%", cellType: "actions-toggle", align: "right", cellClassName: "whitespace-nowrap text-right text-sm font-medium" },
    ],
  },
  motoristas: {
    rows: 7,
    bodyCellClassName: DEFAULT_BODY_CELL_CLASS_NAME,
    rowClassName: DEFAULT_ROW_CLASS_NAME,
    schema: [
      { width: "56px", headerWidth: "16px", cellType: "checkbox", align: "center", cellClassName: "whitespace-nowrap" },
      { width: "2.2fr", headerWidth: "34%", cellType: "avatar-text" },
      { width: "1fr", headerWidth: "30%", cellType: "text", cellClassName: "whitespace-nowrap" },
      { width: "1.45fr", headerWidth: "42%", cellType: "double" },
      { width: "1fr", headerWidth: "34%", cellType: "pill", cellClassName: "whitespace-nowrap" },
      { width: "1.05fr", headerWidth: "40%", cellType: "pill", cellClassName: "whitespace-nowrap" },
      { width: "0.95fr", headerWidth: "46%", cellType: "pill", cellClassName: "whitespace-nowrap" },
      { width: "0.95fr", headerWidth: "34%", cellType: "text", cellClassName: "whitespace-nowrap" },
      { width: "0.95fr", headerWidth: "48%", cellType: "text", cellClassName: "whitespace-nowrap" },
      { width: "132px", headerWidth: "36%", cellType: "actions-toggle", align: "right", cellClassName: "whitespace-nowrap text-right text-sm font-medium" },
    ],
  },
  contratados: {
    rows: 7,
    bodyCellClassName: DEFAULT_BODY_CELL_CLASS_NAME,
    rowClassName: DEFAULT_ROW_CLASS_NAME,
    schema: [
      { width: "72px", headerWidth: "16px", cellType: "checkbox", align: "center", cellClassName: "sticky left-0 z-10 whitespace-nowrap bg-white dark:bg-gray-800" },
      { width: "2fr", headerWidth: "34%", cellType: "avatar-text" },
      { width: "0.95fr", headerWidth: "30%", cellType: "text", cellClassName: "whitespace-nowrap" },
      { width: "1.4fr", headerWidth: "42%", cellType: "double" },
      { width: "1fr", headerWidth: "34%", cellType: "pill", cellClassName: "whitespace-nowrap" },
      { width: "1fr", headerWidth: "40%", cellType: "pill", cellClassName: "whitespace-nowrap" },
      { width: "0.9fr", headerWidth: "34%", cellType: "text", cellClassName: "whitespace-nowrap" },
      { width: "1.1fr", headerWidth: "56%", cellType: "checkbox-text", cellClassName: "whitespace-nowrap" },
      { width: "1.1fr", headerWidth: "58%", cellType: "checkbox-text", cellClassName: "whitespace-nowrap" },
      { width: "0.95fr", headerWidth: "40%", cellType: "double" },
      { width: "0.95fr", headerWidth: "48%", cellType: "text", cellClassName: "whitespace-nowrap" },
      { width: "132px", headerWidth: "36%", cellType: "icon-toggle", align: "right", cellClassName: "whitespace-nowrap text-right text-sm font-medium" },
    ],
  },
  inativos: {
    rows: 6,
    bodyCellClassName: COMPACT_BODY_CELL_CLASS_NAME,
    rowClassName: DEFAULT_ROW_CLASS_NAME,
    schema: [
      { width: "56px", headerWidth: "16px", cellType: "checkbox", align: "center", cellClassName: "whitespace-nowrap" },
      { width: "1.75fr", headerWidth: "34%", cellType: "icon-text" },
      { width: "0.95fr", headerWidth: "30%", cellType: "text", cellClassName: "whitespace-nowrap" },
      { width: "1.45fr", headerWidth: "42%", cellType: "double" },
      { width: "1.05fr", headerWidth: "34%", cellType: "text", cellClassName: "whitespace-nowrap" },
      { width: "0.95fr", headerWidth: "34%", cellType: "pill", cellClassName: "whitespace-nowrap" },
      { width: "104px", headerWidth: "38%", cellType: "toggle", align: "right", cellClassName: "whitespace-nowrap text-right" },
    ],
  },
};

export const getListRefreshSkeletonPreset = (
  variant: ListRefreshSkeletonVariant,
): ListRefreshSkeletonPreset => LIST_REFRESH_SKELETON_PRESETS[variant];

const ListRefreshSkeleton = ({
  rows = 6,
  columns = 5,
  schema,
  bodyCellClassName = "px-6 py-4",
  rowClassName = "bg-white dark:bg-gray-800",
}: ListRefreshSkeletonProps) => {
  const primaryWidthPattern = ["84%", "78%", "72%", "80%", "68%", "76%"];
  const secondaryWidthPattern = ["70%", "62%", "58%", "66%", "54%", "60%"];
  const baseBar = "animate-pulse rounded-lg bg-gray-200/95 dark:bg-gray-700/85";
  const primaryBarClass = `${baseBar} h-[18px]`;
  const secondaryBarClass = `${baseBar} h-[14px]`;

  const effectiveSchema: ListRefreshSkeletonColumn[] =
    schema ||
    Array.from({ length: columns }).map(() => ({
      width: "minmax(0, 1fr)",
      cellType: "text",
      align: "left",
    }));

  const getContainerAlignmentClass = (
    align?: ListRefreshSkeletonColumn["align"],
  ) => {
    if (align === "center") return "items-center justify-center";
    if (align === "right") return "items-end justify-center";
    return "items-start justify-center";
  };

  const getTextAlignmentClass = (align?: ListRefreshSkeletonColumn["align"]) => {
    if (align === "center") return "text-center";
    if (align === "right") return "text-right";
    return "text-left";
  };

  const renderCell = (
    column: ListRefreshSkeletonColumn,
    rowIndex: number,
    columnIndex: number,
  ) => {
    const barWidth =
      primaryWidthPattern[
        (rowIndex + columnIndex) % primaryWidthPattern.length
      ];
    const secondaryWidth =
      secondaryWidthPattern[
        (rowIndex + columnIndex + 2) % secondaryWidthPattern.length
      ];

    switch (column.cellType) {
      case "checkbox":
        return (
          <div className="h-[18px] w-[18px] animate-pulse rounded-md border border-gray-300 bg-gray-100/90 dark:border-gray-600 dark:bg-gray-700/80" />
        );
      case "pill":
        return (
          <div className="h-7 w-[74px] animate-pulse rounded-full bg-gray-200/95 dark:bg-gray-700/85" />
        );
      case "toggle":
        return (
          <div className="flex h-7 w-12 items-center rounded-full bg-gray-200/95 px-0.5 dark:bg-gray-700/85">
            <div className="h-6 w-6 animate-pulse rounded-full bg-white/95 dark:bg-gray-500/80" />
          </div>
        );
      case "actions":
        return (
          <div className="flex items-center gap-2.5">
            <div className="h-[18px] w-[18px] animate-pulse rounded-full bg-gray-200/95 dark:bg-gray-700/85" />
            <div className="h-[18px] w-[18px] animate-pulse rounded-full bg-gray-200/95 dark:bg-gray-700/85" />
          </div>
        );
      case "actions-toggle":
        return (
          <div className="flex items-center gap-3">
            <div className="h-[18px] w-[18px] animate-pulse rounded-full bg-gray-200/95 dark:bg-gray-700/85" />
            <div className="h-[18px] w-[18px] animate-pulse rounded-full bg-gray-200/95 dark:bg-gray-700/85" />
            <div className="flex h-7 w-12 items-center rounded-full bg-gray-200/95 px-0.5 dark:bg-gray-700/85">
              <div className="h-6 w-6 animate-pulse rounded-full bg-white/95 dark:bg-gray-500/80" />
            </div>
          </div>
        );
      case "icon-toggle":
        return (
          <div className="flex items-center gap-3">
            <div className="h-[18px] w-[18px] animate-pulse rounded-full bg-gray-200/95 dark:bg-gray-700/85" />
            <div className="flex h-7 w-12 items-center rounded-full bg-gray-200/95 px-0.5 dark:bg-gray-700/85">
              <div className="h-6 w-6 animate-pulse rounded-full bg-white/95 dark:bg-gray-500/80" />
            </div>
          </div>
        );
      case "icon-text":
        return (
          <div className="flex w-full items-center gap-2">
            <div className="h-[18px] w-[18px] flex-shrink-0 animate-pulse rounded-full bg-gray-200/95 dark:bg-gray-700/85" />
            <div className={primaryBarClass} style={{ width: barWidth }} />
          </div>
        );
      case "checkbox-text":
        return (
          <div className="flex w-full items-center gap-2">
            <div className="h-[18px] w-[18px] flex-shrink-0 animate-pulse rounded-md border border-gray-300 bg-gray-100/90 dark:border-gray-600 dark:bg-gray-700/80" />
            <div className={primaryBarClass} style={{ width: secondaryWidth }} />
          </div>
        );
      case "avatar-text":
        return (
          <div className="flex w-full items-center gap-3">
            <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-gray-200/95 dark:bg-gray-700/85" />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <div className={primaryBarClass} style={{ width: "74%" }} />
              <div className={secondaryBarClass} style={{ width: "56%" }} />
            </div>
          </div>
        );
      case "double":
        return (
          <div className="flex w-full flex-col gap-2.5">
            <div className={primaryBarClass} style={{ width: barWidth }} />
            <div className={secondaryBarClass} style={{ width: secondaryWidth }} />
          </div>
        );
      default:
        return <div className={primaryBarClass} style={{ width: barWidth }} />;
    }
  };

  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={`skeleton-row-${rowIndex}`} className={rowClassName} aria-hidden="true">
          {effectiveSchema.map((column, columnIndex) => (
            <td
              key={`skeleton-cell-${rowIndex}-${columnIndex}`}
              className={`${bodyCellClassName} ${getTextAlignmentClass(column.align)} align-middle ${column.cellClassName || ""}`.trim()}
            >
              <div className={`flex min-h-11 ${getContainerAlignmentClass(column.align)}`}>
                {renderCell(column, rowIndex, columnIndex)}
              </div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export default ListRefreshSkeleton;