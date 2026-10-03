import { PbfReader } from "pbf";

// Decodes the parts of a GTFS-Realtime FeedMessage we use (https://gtfs.org/realtime/reference/). Field numbers come
// from gtfs-realtime.proto; unknown fields are skipped by the reader.

/** `VehicleDescriptor.wheelchair_accessible`: 0 NO_VALUE, 1 UNKNOWN, 2 WHEELCHAIR_ACCESSIBLE, 3 WHEELCHAIR_INACCESSIBLE. */
export type WheelchairFlag = 0 | 1 | 2 | 3;

export type RtVehicle = { id?: string; label?: string; wheelchair?: WheelchairFlag };

export type RtTrip = { tripId?: string; routeId?: string };

export type RtStopTime = {
  stopId?: string;
  /** POSIX seconds. */
  arrival?: number;
  departure?: number;
  delaySeconds?: number;
  /** 1 = SKIPPED, 2 = NO_DATA. */
  scheduleRelationship: number;
};

export type RtTripUpdate = { trip: RtTrip; vehicle?: RtVehicle; stopTimes: RtStopTime[] };

export type RtVehiclePosition = { trip?: RtTrip; vehicle?: RtVehicle; timestamp?: number };

export type FeedMessage = {
  /** POSIX seconds; when the producer created the feed. */
  timestamp?: number;
  tripUpdates: RtTripUpdate[];
  vehicles: RtVehiclePosition[];
};

type Read<T> = (tag: number, result: T, pbf: PbfReader) => void;

const readTrip: Read<RtTrip> = (tag, trip, pbf) => {
  if (tag === 1) trip.tripId = pbf.readString();
  else if (tag === 5) trip.routeId = pbf.readString();
};

const readVehicle: Read<RtVehicle> = (tag, vehicle, pbf) => {
  if (tag === 1) vehicle.id = pbf.readString();
  else if (tag === 2) vehicle.label = pbf.readString();
  else if (tag === 4) vehicle.wheelchair = pbf.readVarint() as WheelchairFlag;
};

type StopTimeEvent = { time?: number; delay?: number };
const readEvent: Read<StopTimeEvent> = (tag, event, pbf) => {
  if (tag === 1) event.delay = pbf.readVarint(true);
  else if (tag === 2) event.time = pbf.readVarint(true);
};

const readStopTime: Read<RtStopTime> = (tag, stopTime, pbf) => {
  if (tag === 2 || tag === 3) {
    const event = pbf.readMessage(readEvent, {} as StopTimeEvent);
    if (tag === 2) stopTime.arrival = event.time;
    else stopTime.departure = event.time;
    if (event.delay !== undefined) stopTime.delaySeconds = event.delay;
  } else if (tag === 4) stopTime.stopId = pbf.readString();
  else if (tag === 5) stopTime.scheduleRelationship = pbf.readVarint();
};

const readTripUpdate: Read<RtTripUpdate> = (tag, update, pbf) => {
  if (tag === 1) update.trip = pbf.readMessage(readTrip, {});
  else if (tag === 2) update.stopTimes.push(pbf.readMessage(readStopTime, { scheduleRelationship: 0 }));
  else if (tag === 3) update.vehicle = pbf.readMessage(readVehicle, {});
};

const readPosition: Read<RtVehiclePosition> = (tag, position, pbf) => {
  if (tag === 1) position.trip = pbf.readMessage(readTrip, {});
  else if (tag === 5) position.timestamp = pbf.readVarint();
  else if (tag === 8) position.vehicle = pbf.readMessage(readVehicle, {});
};

type Entity = { tripUpdate?: RtTripUpdate; vehicle?: RtVehiclePosition; deleted?: boolean };
const readEntity: Read<Entity> = (tag, entity, pbf) => {
  if (tag === 2) entity.deleted = pbf.readBoolean();
  else if (tag === 3) entity.tripUpdate = pbf.readMessage(readTripUpdate, { trip: {}, stopTimes: [] });
  else if (tag === 4) entity.vehicle = pbf.readMessage(readPosition, {});
};

const readHeader: Read<{ timestamp?: number }> = (tag, header, pbf) => {
  if (tag === 3) header.timestamp = pbf.readVarint();
};

/** Decodes a GTFS-Realtime `FeedMessage`; throws on bytes that aren't one. */
export function decodeFeed(bytes: Uint8Array): FeedMessage {
  const feed: FeedMessage = { tripUpdates: [], vehicles: [] };
  new PbfReader(bytes).readFields(
    (tag, result, pbf) => {
      if (tag === 1) result.timestamp = pbf.readMessage(readHeader, {} as { timestamp?: number }).timestamp;
      else if (tag === 2) {
        const entity = pbf.readMessage(readEntity, {} as Entity);
        if (entity.deleted) return;
        if (entity.tripUpdate) result.tripUpdates.push(entity.tripUpdate);
        if (entity.vehicle) result.vehicles.push(entity.vehicle);
      }
    },
    feed,
  );
  return feed;
}
