import { describe, expect, it } from "vitest";
import { resolveStageS3Config } from "./storage";

describe("stage S3 configuration", () => {
  it("keeps managed Forge storage as the default when no stage variables exist", () => {
    expect(resolveStageS3Config({})).toBeNull();
  });

  it("requires every S3 setting once staging storage is enabled", () => {
    expect(() => resolveStageS3Config({ TAKEOFF_S3_ENDPOINT: "http://minio:9000" })).toThrow("STAGE_S3_CONFIG_INCOMPLETE");
  });

  it("accepts a complete S3-compatible MinIO configuration", () => {
    expect(resolveStageS3Config({
      TAKEOFF_S3_ENDPOINT: "http://takeoff-stage-minio:9000",
      TAKEOFF_S3_BUCKET: "takeoff-stage",
      TAKEOFF_S3_REGION: "us-east-1",
      TAKEOFF_S3_ACCESS_KEY: "stage-access",
      TAKEOFF_S3_SECRET_KEY: "stage-secret",
    })).toEqual({
      endpoint: "http://takeoff-stage-minio:9000",
      bucket: "takeoff-stage",
      region: "us-east-1",
      accessKeyId: "stage-access",
      secretAccessKey: "stage-secret",
    });
  });
});
