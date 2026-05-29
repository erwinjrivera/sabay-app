export const fetchOSRMRoute = async (startCoord, endCoord, maxRetries = 2) => {
    let lastError = null;
    
    // A direct fallback 2-point line
    const fallbackRoute = [[startCoord.lat, startCoord.lon], [endCoord.lat, endCoord.lon]];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            
            const url = `https://router.project-osrm.org/route/v1/driving/${startCoord.lon},${startCoord.lat};${endCoord.lon},${endCoord.lat}?geometries=geojson&overview=full`;
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!res.ok) throw new Error(`OSRM HTTP Error: ${res.status}`);
            
            const data = await res.json();
            if (data.routes && data.routes.length > 0) {
                const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                // A valid road route should have more than 2 points unless it's extremely short.
                // But OSRM typically returns detailed polyline with more points.
                // If it returns exactly 2 points, it might be a straight line fallback (or very short).
                // Let's accept it if it's the only thing returned without error, but if it's 2 points and distance is far, it's suspicious.
                // For simplicity, OSRM rarely returns just 2 points unless start/end are basically identical.
                // We will return it if successful.
                return coords;
            }
            throw new Error("No routes returned by OSRM");
        } catch (err) {
            lastError = err;
            if (err.name !== 'AbortError' && attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1500)); // 1.5s delay before retry
            }
        }
    }
    
    console.error("OSRM Route Exhausted Retries:", lastError);
    return fallbackRoute;
};
