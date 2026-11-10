import { Collection } from 'mongodb';
import { RideEvent } from './event.js';
import { withSpan } from './tracing.js';

export interface RideEventDocument {
  eventId: string;
  rideId: string;
  eventType: string;
  occurredAt: string;
  correlationId: string | null;
  payload: RideEvent['payload'];
  processedAt: string;
}

export class HistoryStore {
  constructor(private readonly events: Collection<RideEventDocument>) {}

  async record(event: RideEvent): Promise<'processed' | 'duplicate'> {
    return withSpan('mongo ride event', { ride_id: event.payload.rideId, event_id: event.eventId }, async () => {
      try {
        await this.events.insertOne({
          eventId: event.eventId,
          rideId: event.payload.rideId,
          eventType: event.eventType,
          occurredAt: event.occurredAt,
          correlationId: event.correlationId,
          payload: event.payload,
          processedAt: new Date().toISOString(),
        });
        return 'processed';
      } catch (error) {
        if (isDuplicate(error)) return 'duplicate';
        throw error;
      }
    });
  }
}

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 11000;
}
