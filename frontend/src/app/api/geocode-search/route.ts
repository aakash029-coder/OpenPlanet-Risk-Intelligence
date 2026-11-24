import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const trimmed = q.trim();

  // Tier 1 & Backend Engine: Query python backend first
  try {
    const engineBase = getEngineBaseUrl();
    const upstream = await fetch(
      `${engineBase}/api/geocode-search?q=${encodeURIComponent(trimmed)}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'OpenPlanet-Frontend/2.0',
        },
        next: { revalidate: 300 },
      }
    );

    if (upstream.ok) {
      const data = await upstream.json();
      if (data.results && Array.isArray(data.results) && data.results.length > 0) {
        return NextResponse.json(data);
      }
    }
  } catch {
    // Engine unreachable; fall through to direct fallback
  }

  // Tier 2 Direct Fallback: Open-Meteo Geocoding API
  try {
    const omRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=8&language=en&format=json`,
      {
        headers: { 'User-Agent': 'OpenPlanet-Climate/2.0 (climate@openplanet.dev)' },
        next: { revalidate: 300 },
      }
    );
    if (omRes.ok) {
      const omData = await omRes.json();
      if (omData.results && Array.isArray(omData.results) && omData.results.length > 0) {
        const results = omData.results
          .filter((item: { latitude?: number; longitude?: number }) => {
            const lat = Number(item.latitude);
            const lng = Number(item.longitude);
            return Number.isFinite(lat) && Number.isFinite(lng) && (Math.abs(lat) >= 0.001 || Math.abs(lng) >= 0.001);
          })
          .map((item: { id?: string | number; name: string; country?: string; country_code?: string; latitude: number; longitude: number }) => ({
            id: `om-${item.id || item.name}`,
            name: item.name,
            display_name: `${item.name}, ${item.country || ''}`,
            country: item.country || '',
            country_code: (item.country_code || '').toUpperCase(),
            latitude: item.latitude,
            longitude: item.longitude,
            source: 'openmeteo',
          }));
        if (results.length > 0) {
          return NextResponse.json({ results });
        }
      }
    }
  } catch {
    // Open-Meteo direct fetch failed
  }

  // Tier 3 Direct Fallback: Nominatim OpenStreetMap Search
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=5&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'OpenPlanet-Climate/2.0 (contact@openplanet.network)',
          'Accept': 'application/json',
        },
        next: { revalidate: 300 },
      }
    );
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        const results = nomData
          .filter((item: { lat?: string; lon?: string }) => {
            const lat = parseFloat(item.lat || '0');
            const lng = parseFloat(item.lon || '0');
            return Number.isFinite(lat) && Number.isFinite(lng) && (Math.abs(lat) >= 0.001 || Math.abs(lng) >= 0.001);
          })
          .map((item: { place_id?: string | number; display_name: string; address?: { city?: string; town?: string; village?: string; country?: string; country_code?: string }; lat: string; lon: string }) => {
            const addr = item.address || {};
            const cityName = addr.city || addr.town || addr.village || item.display_name.split(',')[0].trim();
            const countryName = addr.country || '';
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);
            return {
              id: `nom-${item.place_id}`,
              name: cityName,
              display_name: item.display_name,
              country: countryName,
              country_code: (addr.country_code || '').toUpperCase(),
              latitude: lat,
              longitude: lng,
              source: 'nominatim',
            };
          });
        if (results.length > 0) {
          return NextResponse.json({ results });
        }
      }
    }
  } catch {
    // Nominatim fallback failed
  }

  return NextResponse.json({ results: [] });
}

