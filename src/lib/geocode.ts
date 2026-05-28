// Network call ONLY during an explicit place search. Once the resolved
// place is saved to localStorage, the app reverts to fully offline.
// See project memory for the local-first lock relaxation note.

export interface GeocodingResult {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

interface GeocodingResponse {
  results?: GeocodingResult[];
}

const MAX_QUERY_LENGTH = 100;

export async function searchPlaces(query: string): Promise<GeocodingResult[]> {
  if (!query || query.length < 2) return [];

  const capped = query.slice(0, MAX_QUERY_LENGTH);
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(capped)}&count=8`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding search failed');

  const data: GeocodingResponse = await res.json();
  return data.results || [];
}
