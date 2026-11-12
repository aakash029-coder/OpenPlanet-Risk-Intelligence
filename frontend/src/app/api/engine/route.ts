import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine';

const ALLOWED = ['/api/predict', '/api/climate-risk', '/api/research-analysis'];

export async function POST(req: NextRequest) {
  try {
    const { endpoint, payload } = await req.json();

    if (!ALLOWED.includes(endpoint)) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    const engineBase = getEngineBaseUrl();
    const response = await fetch(`${engineBase}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'OpenPlanet-Frontend/2.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Engine ${response.status}: ${errorText.slice(0, 200)}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Proxy failed' },
      { status: 500 }
    );
  }
}