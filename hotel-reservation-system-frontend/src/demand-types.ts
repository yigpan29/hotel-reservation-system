export interface DemandContext { hotelId: number | null; dataKind: 'OPERATIONAL' | 'SYNTHETIC_DEMO' | 'MIXED'; currentActiveRooms: number; invalidStayRecords: number; limitations: string[]; syntheticReservations: number; operationalReservations: number; syntheticBatches: string[] }
export interface DemandHistory {
  context: DemandContext; startDate: string; endDate: string
  summary: { totalReservations: number; confirmedReservations: number; cancelledReservations: number; unknownStateReservations: number; roomNights: number; dailyAverage: number; capacityReferencePercent: number | null; deduplicatedRoomNights: number; peakDates: string[]; lowDates: string[] }
  days: { date: string; roomNights: number; capacityReferencePercent: number | null }[]
}
export interface DemandForecast {
  context: DemandContext; referenceDate: string; trainingStart: string; trainingEnd: string; horizonStart: string; horizonEnd: string; earliestKnownStay: string | null
  status: 'AVAILABLE' | 'INSUFFICIENT_HISTORY'; message: string; method: string
  weekdayAverages: { weekday: string; observations: number; roomNights: number; average: number }[]
  days: { date: string; estimatedRoomNights: number; confirmedRoomNights: number; capacityReferencePercent: number | null; level: 'HIGH' | 'LOW' | 'MODERATE' | 'UNAVAILABLE' }[]
}
