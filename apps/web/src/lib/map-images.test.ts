import { describe, expect, it, vi } from "vitest";
import { blankMissingImages } from "./map-images";

function fakeMap(existing: string[] = []) {
  const images = new Map<string, unknown>(existing.map((id) => [id, {}]));
  let resolver: ((id: string) => void | Promise<void>) | null = null;
  const map = {
    setMissingStyleImageResolver: vi.fn((r: typeof resolver) => {
      resolver = r;
    }),
    hasImage: (id: string) => images.has(id),
    addImage: vi.fn((id: string, image: unknown) => {
      images.set(id, image);
    }),
  };
  return { map, images, resolve: (id: string) => resolver?.(id) };
}

describe("blankMissingImages", () => {
  it("registers a transparent pixel for an icon the style's sprite lacks", async () => {
    // GIVEN a map with the resolver installed
    const { map, images, resolve } = fakeMap();
    blankMissingImages(map as never);

    // WHEN the style asks for an icon it has no image for
    await resolve("bollard");

    // THEN that id gets a 1×1 fully transparent image, so MapLibre neither warns nor fires styleimagemissing
    expect(images.get("bollard")).toEqual({ width: 1, height: 1, data: new Uint8Array(4) });
  });

  it("leaves an image that is already there alone", async () => {
    // GIVEN a map that already has the image (e.g. added between the request and the resolver call)
    const { map, resolve } = fakeMap(["gate"]);
    blankMissingImages(map as never);

    // WHEN the resolver runs for it
    await resolve("gate");

    // THEN it adds nothing (addImage would throw on a duplicate id)
    expect(map.addImage).not.toHaveBeenCalled();
  });
});
