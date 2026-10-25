const EARTH_RADIUS_M = 6371000

const toRadians = (degrees) => (degrees * Math.PI) / 180

/** Jarak dua titik (meter) dengan rumus haversine. Titik berbentuk { latitude, longitude }. */
export const distanceInMeters = (from, to) => {
  const dLat = toRadians(to.latitude - from.latitude)
  const dLng = toRadians(to.longitude - from.longitude)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2

  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a))))
}

/**
 * Kotak pembatas di sekitar titik pusat. Dipakai untuk menyaring kasar di database
 * (memanfaatkan index latitude/longitude), lalu disaring pasti dengan distanceInMeters.
 * Cukup akurat untuk skala kota (tidak menangani kutub / garis bujur 180).
 */
export const boundingBox = ({ latitude, longitude }, radiusM) => {
  const latDelta = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI)
  const lngDelta = latDelta / Math.cos(toRadians(latitude))

  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLng: longitude - lngDelta,
    maxLng: longitude + lngDelta,
  }
}
