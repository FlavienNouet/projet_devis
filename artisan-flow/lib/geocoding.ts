interface Coordinates {
  lat: number;
  lng: number;
}

interface NominatimResult {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    postcode?: string;
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
  };
}

export interface AddressSuggestion {
  label: string;
  postcode: string;
  city: string;
  lat: number;
  lng: number;
}

export const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  const query = address.trim();

  if (!query) {
    return null;
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'artisan-flow/1.0',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as NominatimResult[];
    const first = Array.isArray(data) ? data[0] : null;

    if (!first?.lat || !first?.lon) {
      return null;
    }

    const lat = Number(first.lat);
    const lng = Number(first.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return { lat, lng };
  } catch {
    return null;
  }
};

export const suggestAddresses = async (
  query: string,
  limit = 6
): Promise<AddressSuggestion[]> => {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 3) {
    return [];
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(normalizedQuery)}&limit=${limit}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'artisan-flow/1.0',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as NominatimResult[];

    return (Array.isArray(data) ? data : [])
      .map((result): AddressSuggestion | null => {
        const lat = Number(result.lat);
        const lng = Number(result.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return null;
        }

        const postcode = result.address?.postcode || '';
        const city = result.address?.city
          || result.address?.town
          || result.address?.village
          || result.address?.municipality
          || '';

        const road = result.address?.road || '';
        const houseNumber = result.address?.house_number || '';

        const label = [houseNumber, road].filter(Boolean).join(' ').trim() || result.display_name || '';

        return {
          label,
          postcode,
          city,
          lat,
          lng,
        };
      })
      .filter((value): value is AddressSuggestion => Boolean(value));
  } catch {
    return [];
  }
};
