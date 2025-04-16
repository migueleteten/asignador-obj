// public/parser/parseOBJ.js
(function () {

  // Helper function to get bounding box of vertices (using x, y)
  function getBounds(vertices) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    vertices.forEach(({ x, y }) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });
    return { minX, minY, maxX, maxY };
  }

  // Helper function to normalize vertices to fit within width/height with padding
  // Also handles Y-axis inversion for screen coordinates and applies transformations
  function normalize(vertices, width, height, padding = 20) { // Increased padding slightly
    if (!vertices || vertices.length === 0) {
        console.warn("Normalize called with empty or invalid vertices array.");
        return [];
    }
    const { minX, minY, maxX, maxY } = getBounds(vertices);

    // Handle cases where points are collinear or coincident
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;

    // Avoid division by zero or near-zero if all points are the same or on a line
    const effectiveRangeX = rangeX < 1e-6 ? 1 : rangeX;
    const effectiveRangeY = rangeY < 1e-6 ? 1 : rangeY;

    const availableWidth = width - 2 * padding;
    const availableHeight = height - 2 * padding;

    // Calculate scale, ensuring it's positive
    const scaleX = availableWidth > 0 ? availableWidth / effectiveRangeX : 1;
    const scaleY = availableHeight > 0 ? availableHeight / effectiveRangeY : 1;
    const scale = Math.max(1e-6, Math.min(scaleX, scaleY)); // Ensure scale is positive

    // Calculate offsets for centering
    const offsetX = padding + (availableWidth - rangeX * scale) / 2;
    const offsetY = padding + (availableHeight - rangeY * scale) / 2;

    return vertices.map(({ x, y }) => ({
      // Apply transformation: (x - minX) * scale centers relative to min point, then add offsetX
      x: (x - minX) * scale + offsetX,
      // Apply transformation and Y-inversion:
      // 1. (y - minY) * scale: Scale relative distance from min Y
      // 2. + offsetY: Add bottom/left padding and centering offset
      // 3. height - (...): Invert Y axis so positive Y goes down
      y: height - ((y - minY) * scale + offsetY)
    }));
  }


  // Helper function to order points by angle around their centroid
  function ordenarPorAngulo(puntos) {
    if (!puntos || puntos.length < 3) return puntos; // Need at least 3 points for a polygon centroid

    // Calculate centroid
    let sumX = 0, sumY = 0;
    puntos.forEach(p => {
        sumX += p.x;
        sumY += p.y;
    });
    const cx = sumX / puntos.length;
    const cy = sumY / puntos.length;

    // Sort based on angle relative to centroid
    return puntos.slice().sort((a, b) => {
      const angA = Math.atan2(a.y - cy, a.x - cx);
      const angB = Math.atan2(b.y - cy, b.x - cx);
      return angA - angB;
    });
  }

  // --- Main Parsing Function ---
  window.parseOBJ = function (textoOBJ, width = 500, height = 500) {
    console.log("📄 .OBJ recibido (primeros 300 chars):", textoOBJ.slice(0, 300));

    const lines = textoOBJ.split("\n");
    const ceilingVerticesPorRoom = {}; // Stores raw {x, y, z} vertices for ceiling groups
    const verticesPorPuntoOriginal = {}; // Maps original "x,z" coords to Set<wallId>
    const precisionFactor = 10000; // For creating reliable keys from floats

    let currentRoom = null;
    let currentWall = null;
    let isParsingCeiling = false;

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
        return; // Skip empty lines and comments
      }

      if (trimmedLine.startsWith("g ")) {
        const partes = trimmedLine.split(/\s+/);
        // Reset state for the new group
        currentRoom = null;
        currentWall = null;
        isParsingCeiling = false;

        partes.forEach(p => {
          const pLower = p.toLowerCase();
          if (/^room\d+$/.test(pLower)) {
            currentRoom = pLower;
          } else if (/^wall\d+$/.test(pLower)) {
            currentWall = pLower;
          } else if (pLower === 'ceiling') {
            isParsingCeiling = true;
          }
        });

        // Initialize room if it's the first time we see it in a ceiling context
        if (currentRoom && isParsingCeiling && !ceilingVerticesPorRoom[currentRoom]) {
          ceilingVerticesPorRoom[currentRoom] = [];
        }

      } else if (trimmedLine.startsWith("v ")) {
        try {
            const [, xStr, yStr, zStr] = trimmedLine.split(/\s+/);
            // Use parseFloat for robustness, handle potential errors
            const x = parseFloat(xStr);
            const y = parseFloat(yStr);
            const z = parseFloat(zStr);

            if (isNaN(x) || isNaN(y) || isNaN(z)) {
               // console.warn("Skipping invalid vertex line:", trimmedLine);
                return;
            }

            // Round to avoid floating point precision issues in keys
            const xFixed = Math.round(x * precisionFactor) / precisionFactor;
            const zFixed = Math.round(z * precisionFactor) / precisionFactor;
            const vertice = { x: xFixed, y: parseFloat(y.toFixed(5)), z: zFixed }; // Keep original Y for potential future use

            if (isParsingCeiling && currentRoom) {
              // Store the vertex if we are inside a 'g roomX ceiling' block
              ceilingVerticesPorRoom[currentRoom].push(vertice);
            }

            // Regardless of ceiling, if this vertex is part of a wall, record it
            // This builds the lookup for wall association later
            if (currentWall) { // Only associate if the vertex is explicitly within a wall group
                const key = `${vertice.x},${vertice.z}`; // Use ORIGINAL x, z for the lookup key
                if (!verticesPorPuntoOriginal[key]) {
                verticesPorPuntoOriginal[key] = new Set();
                }
                verticesPorPuntoOriginal[key].add(currentWall);
            }
        } catch (e) {
           // console.error("Error parsing vertex line:", trimmedLine, e);
        }
      }
      // Ignore other line types like 'vn', 'vt', 'f', 's', 'usemtl', etc. for this parser
    });

    console.log("🔍 Vertices por punto original:", verticesPorPuntoOriginal); // Debug log

    // --- Process Geometry Per Room ---
    window.geometriaPorRoom = {};

    for (const room in ceilingVerticesPorRoom) {
      const verticesCrudos = ceilingVerticesPorRoom[room];
      if (verticesCrudos.length === 0) {
          console.warn(`Room ${room} tiene grupo ceiling pero no vertices 'v'. Saltando.`);
          continue;
      }

      // 1. & 6. Obtener vértices del techo (ceiling) y aplicar transformación inicial
      //    OBJ(x, z) -> Intermediate(x', y') = (-x, -z) -> Rotación 180º en plano XZ
      //    Usamos estos puntos transformados (x', y') para el resto del proceso (unicos, ordenar, normalizar)
      const puntosXZTransformados = verticesCrudos.map(v => ({
        x: -v.x, // Negate X
        y: -v.z  // Negate Z (becomes intermediate Y)
      }));

      // 2. Filtrar por valores únicos (usando los puntos transformados)
      const clavesUnicas = new Set();
      const puntosUnicos = puntosXZTransformados.filter(p => {
        // Use fixed precision for uniqueness check
        const clave = `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
        if (clavesUnicas.has(clave)) return false;
        clavesUnicas.add(clave);
        return true;
      });

       if (puntosUnicos.length < 3) {
           console.warn(`Room ${room} tiene menos de 3 puntos únicos en el techo después del filtrado (${puntosUnicos.length}). Saltando.`);
           continue;
       }

      // 3. Ordenar por ángulo ATAN2 (usando los puntos transformados)
      const puntosOrdenados = ordenarPorAngulo(puntosUnicos);

      // 4. & 5. Crear tramos y asignar paredes
      const tramos = [];
      for (let i = 0; i < puntosOrdenados.length; i++) {
        const p1 = puntosOrdenados[i];
        const p2 = puntosOrdenados[(i + 1) % puntosOrdenados.length]; // Wrap around for the last segment

        // Para buscar en verticesPorPuntoOriginal, necesitamos las coordenadas ORIGINALES (x, z)
        // Como p1.x = -originalX y p1.y = -originalZ, entonces originalX = -p1.x y originalZ = -p1.y
        const originalX1 = -p1.x;
        const originalZ1 = -p1.y;
        const originalX2 = -p2.x;
        const originalZ2 = -p2.y;

        // Recrear las claves usando las coordenadas originales redondeadas como se hizo al poblar el lookup
        const keyP1 = `${Math.round(originalX1 * precisionFactor) / precisionFactor},${Math.round(originalZ1 * precisionFactor) / precisionFactor}`;
        const keyP2 = `${Math.round(originalX2 * precisionFactor) / precisionFactor},${Math.round(originalZ2 * precisionFactor) / precisionFactor}`;

        // 5.1 & 5.2 Obtener lista de paredes para cada punto (original)
        const wallsP1 = verticesPorPuntoOriginal[keyP1] || new Set();
        const wallsP2 = verticesPorPuntoOriginal[keyP2] || new Set();

        // 5.3 Comparar y obtener la pared común
        const comunes = [...wallsP1].filter(w => wallsP2.has(w));
        const wallId = comunes.length > 0 ? comunes[0] : null; // Tomar la primera si hay varias (o null)

        // Almacenar el tramo con sus puntos TRANSFORMADOS (los que se usarán para normalizar)
        tramos.push({
          x1: p1.x, y1: p1.y, // Coords transformadas (-x, -z)
          x2: p2.x, y2: p2.y, // Coords transformadas (-x, -z)
          wallId: wallId
        });

        // Debug log per segment
        // console.log(`  Tramo ${i}: (${p1.x.toFixed(2)}, ${p1.y.toFixed(2)})[${keyP1}] -> (${p2.x.toFixed(2)}, ${p2.y.toFixed(2)})[${keyP2}] | Walls P1: {${[...wallsP1]}} | Walls P2: {${[...wallsP2]}} | Común: ${wallId}`);
      }

      // 7. Construir el objeto para el SVG (Normalización)
      // Normalizamos los puntos del *suelo* (que son los puntos únicos ordenados y transformados)
      const sueloNormalizado = normalize(puntosOrdenados, width, height);

      // Normalizamos los *extremos de las paredes* (tramos)
      // Primero, creamos una lista plana de todos los puntos extremos de los tramos
      const puntosParedes = tramos.flatMap(t => [{ x: t.x1, y: t.y1 }, { x: t.x2, y: t.y2 }]);
      const extremosNormalizados = normalize(puntosParedes, width, height);

       if (!extremosNormalizados || extremosNormalizados.length !== tramos.length * 2) {
            console.error(`Error en la normalización de paredes para room ${room}. Se esperaban ${tramos.length * 2} puntos normalizados, se obtuvieron ${extremosNormalizados?.length}. Saltando paredes.`);
            window.geometriaPorRoom[room] = {
                 suelo: sueloNormalizado,
                 paredes: [] // Dejar paredes vacío si la normalización falló
            };
            continue; // Pasar al siguiente room
       }


      // Reconstruimos los tramos (paredes) con las coordenadas normalizadas
      const paredesNormalizadas = [];
      for (let i = 0; i < tramos.length; i++) {
        const p1Norm = extremosNormalizados[i * 2];
        const p2Norm = extremosNormalizados[i * 2 + 1];
        paredesNormalizadas.push({
          x1: p1Norm.x, y1: p1Norm.y,
          x2: p2Norm.x, y2: p2Norm.y,
          wallId: tramos[i].wallId // Mantener el wallId asociado
        });
      }

      // Almacenar resultado final
      window.geometriaPorRoom[room] = {
        suelo: sueloNormalizado,     // Polígono del suelo normalizado
        paredes: paredesNormalizadas // Segmentos de pared normalizados con wallId
      };
    }

    console.log("✅ OBJ parseado y geometría interpretada. Rooms:", Object.keys(window.geometriaPorRoom));
    console.log(" Geometría final:", window.geometriaPorRoom); // Log final data
  };

})(); // Fin IIFE