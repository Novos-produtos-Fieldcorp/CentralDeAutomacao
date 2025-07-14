/**
 * Utility functions for converting between Brasilia time (UTC-3) and UTC time
 */

/**
 * Converts a time string in Brasilia timezone (UTC-3) to UTC
 * @param timeString Time string in HH:MM format (Brasilia time)
 * @returns Time string in HH:MM format (UTC time)
 */
export function convertBrasiliaToUTC(timeString: string): string {
  // Parse the time string
  const [hours, minutes] = timeString.split(':').map(Number);
  
  // Convert to UTC (add 3 hours)
  let utcHours = hours + 3;
  
  // Handle day boundary
  if (utcHours >= 24) {
    utcHours -= 24;
  }
  
  // Format as HH:MM
  return `${utcHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Converts a time string in UTC to Brasilia timezone (UTC-3)
 * @param timeString Time string in HH:MM format (UTC time)
 * @returns Time string in HH:MM format (Brasilia time)
 */
export function convertUTCToBrasilia(timeString: string): string {
  // Parse the time string
  const [hours, minutes] = timeString.split(':').map(Number);
  
  // Convert to Brasilia time (subtract 3 hours)
  let brasiliaHours = hours - 3;
  
  // Handle day boundary
  if (brasiliaHours < 0) {
    brasiliaHours += 24;
  }
  
  // Format as HH:MM
  return `${brasiliaHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}