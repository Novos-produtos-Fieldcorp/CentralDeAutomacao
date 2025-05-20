/**
 * Calculates pagination parameters for database queries
 * 
 * @param page Current page number (1-based)
 * @param pageSize Number of items per page
 * @returns Object with limit and offset values
 */
export const getPaginationParams = (page: number = 1, pageSize: number = 20) => {
  const limit = pageSize;
  const offset = (page - 1) * pageSize;
  
  return {
    limit,
    offset
  };
};

/**
 * Formats pagination response data
 * 
 * @param data Array of records
 * @param page Current page number
 * @param pageSize Number of items per page
 * @param totalCount Total number of records
 * @returns Formatted pagination response
 */
export const formatPaginationResponse = <T>(
  data: T[],
  page: number,
  pageSize: number,
  totalCount: number
) => {
  return {
    records: data,
    totalCount,
    currentPage: page,
    hasMore: page * pageSize < totalCount
  };
};