/** A map point typed by a person: "25.5941, 85.1376", or a Google Maps link (the pin's own coordinates when the link has them, else the
 * map's centre or its search). Short links (maps.app.goo.gl/…) carry no coordinates: null, and the caller asks for the full link. */
export function parseMapPoint(
  text: string,
): { latitude: number; longitude: number } | null {
  const t = text.trim();
  const num = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
  const patterns = [
    new RegExp(String.raw`^${num}\s*,\s*${num}$`), // plain "lat, lng"
    new RegExp(String.raw`!3d${num}!4d${num}`), // a dropped pin inside a place link
    new RegExp(
      String.raw`[?&](?:q|query|ll|destination)=${num}(?:,|%2C)\s*${num}`,
      "i",
    ),
    new RegExp(String.raw`@${num},${num}`), // the map's centre
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;
    const latitude = Number(m[1]);
    const longitude = Number(m[2]);
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180)
      return { latitude, longitude };
  }
  return null;
}

/** A Google Maps link that drops a pin on the point, to check it by eye. */
export const mapLink = (latitude: number, longitude: number) =>
  `https://www.google.com/maps?q=${latitude},${longitude}`;
