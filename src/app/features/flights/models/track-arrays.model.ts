export interface TrackArrays {
  /**
   * Time of each fix in seconds since midnight UTC.
   */
  timeSec: Int32Array;

  /**
   * Latitude in degrees * 10,000,000.
   */
  latE7: Int32Array;

  /**
   * Longitude in degrees * 10,000,000.
   */
  lonE7: Int32Array;

  /**
   * GPS altitude in centimeters.
   */
  altGpsCm: Int32Array;

  /**
   * Barometric altitude in centimeters.
   */
  altBaroCm: Int32Array;
}