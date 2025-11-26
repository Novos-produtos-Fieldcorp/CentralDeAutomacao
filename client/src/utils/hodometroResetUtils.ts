/**
 * Hodômetro Reset Detection Utilities
 * 
 * Detects odometer resets (when the reading decreases) and provides
 * baseline values after the last reset for accurate km_rodado calculations.
 */

// Input types
export interface HodometroReadingInput {
  data: string;
  hora: string;
  hod_lido?: string | null;
  trip_lida?: string | null;
  bateria?: string | number | null;
}

// Output types
export interface OdometerSegment {
  startReading: number;
  startDate: string;
  startHora: string;
  endReading: number | null;
  endDate: string | null;
  endHora: string | null;
  kmRodado: number;
}

export interface OdometerTimelineResult {
  vehicleType: 'automovel' | 'ciclomotor';
  baseline: number | null; // First reading after last reset
  baselineDate: string | null;
  baselineHora: string | null;
  latestReading: number | null;
  latestDate: string | null;
  latestHora: string | null;
  totalKmRodado: number; // From baseline to latest
  segments: OdometerSegment[]; // All segments (separated by resets)
}

/**
 * Safely parse string or number to float
 */
function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Minimum decrease in km to be considered a true reset (not just a data entry error).
 * Decreases smaller than this threshold are ignored as likely input mistakes.
 */
const RESET_TOLERANCE_KM = 100;

/**
 * Builds an odometer timeline with reset detection for a single vehicle.
 * 
 * @param readings - Chronologically sorted readings for a single vehicle
 * @returns Timeline with baseline, segments, and total km_rodado
 * 
 * Algorithm:
 * 1. Determine vehicle type (automovel vs ciclomotor)
 * 2. Iterate through chronological readings
 * 3. Detect resets when value decreases by more than RESET_TOLERANCE_KM
 * 4. Create new segment at each reset
 * 5. Return baseline (after last reset) and total km_rodado
 */
export function buildOdometerTimeline(
  readings: HodometroReadingInput[]
): OdometerTimelineResult {
  if (readings.length === 0) {
    return {
      vehicleType: 'automovel',
      baseline: null,
      baselineDate: null,
      baselineHora: null,
      latestReading: null,
      latestDate: null,
      latestHora: null,
      totalKmRodado: 0,
      segments: []
    };
  }

  // Determine vehicle type based on bateria field
  const vehicleType = readings.some(r => r.bateria !== null && r.bateria !== undefined)
    ? 'ciclomotor'
    : 'automovel';

  const segments: OdometerSegment[] = [];
  let currentSegment: OdometerSegment | null = null;
  let previousValue = -1;

  for (const reading of readings) {
    const currentValue = vehicleType === 'ciclomotor'
      ? parseNumber(reading.trip_lida)
      : parseNumber(reading.hod_lido);

    // Skip null/zero readings
    if (currentValue === 0) continue;

    // Detect reset: current value is significantly less than previous value
    // Small decreases (< RESET_TOLERANCE_KM) are treated as data entry errors and ignored
    const decrease = previousValue - currentValue;
    if (previousValue > 0 && decrease > RESET_TOLERANCE_KM) {
      // Reset detected! Close current segment and start new one
      if (currentSegment) {
        currentSegment.endReading = previousValue;
        currentSegment.kmRodado = previousValue - currentSegment.startReading;
        segments.push(currentSegment);
      }

      // Start new segment
      currentSegment = {
        startReading: currentValue,
        startDate: reading.data,
        startHora: reading.hora,
        endReading: null,
        endDate: null,
        endHora: null,
        kmRodado: 0
      };
      previousValue = currentValue;
    } else if (currentSegment === null) {
      // First valid reading ever
      currentSegment = {
        startReading: currentValue,
        startDate: reading.data,
        startHora: reading.hora,
        endReading: null,
        endDate: null,
        endHora: null,
        kmRodado: 0
      };
      previousValue = currentValue;
    } else {
      // Normal progression
      currentSegment.endReading = currentValue;
      currentSegment.endDate = reading.data;
      currentSegment.endHora = reading.hora;
      previousValue = currentValue;
    }
  }

  // Close final segment
  if (currentSegment) {
    if (currentSegment.endReading === null) {
      // Single reading in this segment
      currentSegment.endReading = currentSegment.startReading;
      currentSegment.endDate = currentSegment.startDate;
      currentSegment.endHora = currentSegment.startHora;
    }
    currentSegment.kmRodado = currentSegment.endReading - currentSegment.startReading;
    segments.push(currentSegment);
  }

  // Get the last (active) segment
  const activeSegment = segments[segments.length - 1] || null;

  // Calculate total km_rodado from baseline to latest
  const totalKmRodado = activeSegment
    ? (activeSegment.endReading || 0) - activeSegment.startReading
    : 0;

  return {
    vehicleType,
    baseline: activeSegment?.startReading || null,
    baselineDate: activeSegment?.startDate || null,
    baselineHora: activeSegment?.startHora || null,
    latestReading: activeSegment?.endReading || null,
    latestDate: activeSegment?.endDate || null,
    latestHora: activeSegment?.endHora || null,
    totalKmRodado: Math.max(0, totalKmRodado), // Ensure non-negative
    segments
  };
}

/**
 * Calculate km_rodado for a specific date range using readings within the period.
 * 
 * @param timeline - Result from buildOdometerTimeline (used for vehicle type detection)
 * @param startDate - Start date of the period (YYYY-MM-DD)
 * @param endDate - End date of the period (YYYY-MM-DD)
 * @param readingsInPeriod - Readings within the specified period
 * @returns km_rodado for the period (última leitura - primeira leitura do período)
 */
export function calculateKmRodadoForPeriod(
  timeline: OdometerTimelineResult,
  startDate: string,
  endDate: string,
  readingsInPeriod: HodometroReadingInput[]
): number {
  if (readingsInPeriod.length === 0) {
    return 0;
  }

  // Find first and last valid readings in period
  let firstInPeriod: number | null = null;
  let latestInPeriod: number | null = null;
  let firstDate: string | null = null;
  let latestDate: string | null = null;

  for (const reading of readingsInPeriod) {
    if (reading.data >= startDate && reading.data <= endDate) {
      const value = timeline.vehicleType === 'ciclomotor'
        ? parseNumber(reading.trip_lida)
        : parseNumber(reading.hod_lido);
      
      if (value > 0) {
        // Track latest reading (highest value in period)
        if (latestInPeriod === null || value > latestInPeriod) {
          latestInPeriod = value;
          latestDate = reading.data;
        }
        
        // Track first reading (lowest value in period, considering chronological order)
        if (firstInPeriod === null || value < firstInPeriod) {
          firstInPeriod = value;
          firstDate = reading.data;
        }
      }
    }
  }

  if (latestInPeriod === null || firstInPeriod === null) {
    return 0;
  }

  // Calculate km_rodado: última leitura do período - primeira leitura do período
  const kmRodado = latestInPeriod - firstInPeriod;
  return Math.max(0, kmRodado);
}
