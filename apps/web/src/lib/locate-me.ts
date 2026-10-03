import type { DevicePosition, LocateFailure, LocateResult } from "@/lib/native/geolocation";

/**
 * State of the map's "show my location" button. The position lives only here, in the browser, and only to
 * centre the map: it is never stored or sent.
 */
export type LocateMeState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "located"; position: Pick<DevicePosition, "latitude" | "longitude"> }
  | { status: "failed"; reason: LocateFailure };

export type LocateMeAction = { type: "start" } | { type: "finish"; result: LocateResult } | { type: "dismiss" };

export const locateMeIdle: LocateMeState = { status: "idle" };

export function locateMeReducer(state: LocateMeState, action: LocateMeAction): LocateMeState {
  switch (action.type) {
    case "start":
      return { status: "locating" };
    case "finish":
      if (state.status !== "locating") return state;
      return action.result.ok
        ? { status: "located", position: action.result.position }
        : { status: "failed", reason: action.result.reason };
    case "dismiss":
      return state.status === "failed" ? locateMeIdle : state;
  }
}
