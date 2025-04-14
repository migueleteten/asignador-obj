// ***********************************************
// asignadorEstancias.js
// ***********************************************

// Diccionario de colores techo por tipo (en mayúsculas para facilitar la comparación)
const COLORES_TECHO_ESTANCIA = {
    "BAÑO": "d5d5d5",
    "COCINA": "cccccc",
    "PASILLO": "9c9c9c",
    "SALÓN": "e8e8e8",
    "DORMITORIO": "a8a8a8"
  };
  
  // Función para detectar el tipo de estancia según el color (comprobada y con logs)
  function detectarTipoEstanciaPorColor(colorHex) {
    if (!colorHex || typeof colorHex !== "string") {
      console.warn("detectarTipoEstanciaPorColor: colorHex inválido:", colorHex);
      return "Otro";
    }
    const original = colorHex;
    colorHex = colorHex.toLowerCase().replace("#", "");
    console.log(`detectarTipoEstanciaPorColor: comparando '${original}' formateado como '${colorHex}'`);
  
    const coincidencia = Object.entries(COLORES_TECHO_ESTANCIA)
      .find(([tipo, color]) => color === colorHex);
  
    if (coincidencia) {
      console.log("detectarTipoEstanciaPorColor: coincidencia encontrada:", coincidencia[0]);
      return coincidencia[0];
    } else {
      console.warn("detectarTipoEstanciaPorColor: No se encontró coincidencia para:", colorHex);
      return "Otro";
    }
  }
  
  // Función para preparar el CSV: convierte el texto CSV en un array de objetos {nombre, paredes, area}
  // Los valores se extraen de:
  //  - Columna 0: Room name
  //  - Columna 1: Walls (se parsea a entero)
  //  - Columna 7: Area [m²] (se parsea a float)
  function prepararEstanciasDesdeCSV(textoCSV) {
    console.log("prepararEstanciasDesdeCSV: iniciando parsing del CSV...");
    if (typeof textoCSV !== "string") {
      console.error("prepararEstanciasDesdeCSV: textoCSV no es string:", textoCSV);
      return [];
    }
    
    const lineas = textoCSV.split("\n");
    const indiceEncabezado = lineas.findIndex(l => l.startsWith("Room name"));
    if (indiceEncabezado < 0) {
      console.error("prepararEstanciasDesdeCSV: No se encontró línea de encabezado 'Room name'");
      return [];
    }
    console.log("prepararEstanciasDesdeCSV: encabezado encontrado en línea", indiceEncabezado);
    
    const estancias = [];
    for (let j = indiceEncabezado + 1; j < lineas.length; j++) {
      const linea = lineas[j];
      if (!linea.trim() || linea.replaceAll(",", "").trim() === "") break;
      const partes = linea.split(",");
      const nombre = partes[0]?.trim();
      const paredes = parseInt(partes[1]?.trim());
      const area = parseFloat(partes[7]?.trim());
      if (!nombre || isNaN(paredes) || isNaN(area)) {
        console.warn(`prepararEstanciasDesdeCSV: línea inválida en ${j}:`, linea);
        continue;
      }
      estancias.push({ nombre, paredes, area });
    }
    console.log("prepararEstanciasDesdeCSV: estancias preparadas:", estancias);
    return estancias;
  }
  
  // Función para calcular el área de un polígono plano dado un conjunto de vértices (considerando solo x y z)
  function calcularAreaSuelo(vertices) {
    if (!vertices || vertices.length < 3) {
      console.warn("calcularAreaSuelo: no hay suficientes vértices para calcular el área.", vertices);
      return 0;
    }
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const [x1, , z1] = vertices[i];
      const [x2, , z2] = vertices[(i + 1) % vertices.length];
      area += (x1 * z2 - x2 * z1);
    }
    const areaCalculada = Math.abs(area / 2);
    console.log("calcularAreaSuelo: área calculada =", areaCalculada);
    return areaCalculada;
  }
  
  // Función principal para detectar las estancias usando el OBJ y el array de estancias CSV
  // Recibe: textoOBJ (string) y estanciasCSV (array de objetos {nombre, paredes, area})
  // Devuelve un objeto con pares roomId: {estancia, tipo}
  function detectarEstanciasDesdeOBJ(textoOBJ, estanciasCSV) {
    console.log("detectarEstanciasDesdeOBJ: iniciando con OBJ y CSV preparados");
    const habitacionesOBJ = parsearOBJ(textoOBJ);
    console.log("detectarEstanciasDesdeOBJ: habitaciones parseadas:", habitacionesOBJ);
    const resultado = {};
  
    for (const roomId in habitacionesOBJ) {
      const habitacion = habitacionesOBJ[roomId];
  
      // Filtrar habitaciones que no sean válidas
      if (!habitacion.color || habitacion.paredes === 0 || habitacion.verticesSuelo.length === 0) {
        console.warn("detectarEstanciasDesdeOBJ: Ignorando habitación inválida:", roomId, habitacion);
        continue;
      }
  
      // Buscar el mejor match en estanciasCSV usando diferencias en paredes y área
      const mejorMatch = estanciasCSV.reduce((mejor, estancia) => {
        const diffParedes = Math.abs(estancia.paredes - habitacion.paredes);
        const diffArea = Math.abs(estancia.area - habitacion.area);
        const score = diffParedes * 10 + diffArea;
        console.log(`Comparando para ${roomId}: entrada ${estancia.nombre} tiene score = ${score} (paredes diff: ${diffParedes}, area diff: ${diffArea})`);
        return (!mejor || score < mejor.score) ? { ...estancia, score } : mejor;
      }, null);
  
      if (!mejorMatch) {
        console.warn(`detectarEstanciasDesdeOBJ: No se encontró match para ${roomId}`);
      }
      resultado[roomId] = {
        estancia: mejorMatch?.nombre || roomId,
        tipo: detectarTipoEstanciaPorColor(habitacion.color)
      };
    }
  
    console.log("detectarEstanciasDesdeOBJ: resultado final:", resultado);
    return resultado;
  }
  
// ============================
// Helpers para el cálculo 2D
// ============================

// Elimina vértices duplicados (por igualdad exacta de coordenadas)
function deduplicarVertices(vertices) {
    return vertices.filter((p, i, arr) =>
      i === arr.findIndex(pt => pt[0] === p[0] && pt[1] === p[1] && pt[2] === p[2])
    );
  }
  
  // Proyecta vértices 3D a 2D usando solo las coordenadas [x, z]
  function proyectarXZ(vertices) {
    return vertices.map(([x, , z]) => [x, z]);
  }
  
  // Calcula el área de un polígono 2D con la fórmula de Shoelace
  function areaShoelace(polygon) {
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
      const [x1, y1] = polygon[i];
      const [x2, y2] = polygon[(i + 1) % polygon.length];
      area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area / 2);
  }
  
  // ============================
  // Función parsearOBJ con unión de caras (usando martinez)
  // ============================
  function parsearOBJ(textoOBJ) {
    console.log("parsearOBJ: iniciando parsing del OBJ...");
    const lines = textoOBJ.split("\n");
    const vertices = [];
    const habitaciones = {};
  
    let currentRoom = null;
    let currentGroup = null;
    let currentMaterial = null;
  
    // Procesamos línea a línea del OBJ
    for (const line of lines) {
      if (line.startsWith("v ")) {
        // Línea de vértices: "v x y z"
        const partes = line.trim().split(/\s+/);
        const x = parseFloat(partes[1]);
        const y = parseFloat(partes[2]);
        const z = parseFloat(partes[3]);
        vertices.push([x, y, z]);
      } else if (line.startsWith("g ")) {
        // Línea de grupo: define currentGroup y currentRoom
        const partes = line.trim().split(" ");
        currentGroup = partes[1];
        currentRoom = partes[2] || null;
        if (currentRoom && !habitaciones[currentRoom]) {
          habitaciones[currentRoom] = {
            color: null,
            faces: [],         // Guardaremos cada cara "floor" separada
            wallGroups: new Set()
          };
        }
      } else if (line.startsWith("usemtl ")) {
        // Línea de material: obtenemos el color (en minúsculas)
        currentMaterial = line.split(" ")[1].trim().toLowerCase();
        // Si estamos en grupo "ceiling", asigna el color
        if (currentGroup === "ceiling" && currentRoom) {
          if (!habitaciones[currentRoom]) {
            habitaciones[currentRoom] = {
              color: null,
              faces: [],
              wallGroups: new Set()
            };
          }
          habitaciones[currentRoom].color = currentMaterial;
          console.log(`parsearOBJ: Asignado color '${currentMaterial}' a habitación '${currentRoom}' en grupo 'ceiling'`);
        }
      } else if (line.startsWith("f ") && currentRoom) {
        // Línea de cara (face)
        const indices = line.slice(2).trim().split(" ").map(f => {
          const idx = f.split("//")[0];
          let index = parseInt(idx);
          return index < 0 ? vertices.length + index : index - 1;
        });
        if (!habitaciones[currentRoom]) {
          habitaciones[currentRoom] = {
            color: null,
            faces: [],
            wallGroups: new Set()
          };
        }
        if (currentGroup === "floor") {
          // Almacenar cada cara del piso como un polígono independiente
          const faceVertices = indices.map(i => vertices[i]);
          habitaciones[currentRoom].faces.push(faceVertices);
          console.log(`parsearOBJ: Agregada cara del piso a '${currentRoom}' con ${faceVertices.length} vértices`);
        }
        if (currentGroup && currentGroup.startsWith("wall")) {
          // Agregar el identificador del grupo de muro a un Set para contar paredes únicas
          habitaciones[currentRoom].wallGroups.add(currentGroup);
        }
      }
    }
  
    // Postprocesamiento: Para cada habitación, unir las caras floor y calcular el área y paredes.
    for (const id in habitaciones) {
      const room = habitaciones[id];
      let allPolygons = [];
      // Para cada cara floor, deduplicar vértices y proyectar a 2D.
      for (const face of room.faces) {
        const deduped = deduplicarVertices(face);
        let proj = proyectarXZ(deduped);
        // Aseguramos que el polígono esté cerrado (el primer punto se repite al final)
        if (proj.length > 0) {
          const first = proj[0];
          const last = proj[proj.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            proj.push(first);
          }
        }
        // En formato compatible con martinez: un polígono es un array con un ring
        allPolygons.push([proj]);
      }
      let area = 0;
      if (allPolygons.length === 0) {
        area = 0;
      } else {
        // Unir secuencialmente todos los polígonos usando martinez.union
        let unionPoly = allPolygons[0];
        for (let i = 1; i < allPolygons.length; i++) {
          unionPoly = martinez.union(unionPoly, allPolygons[i]);
          if (Array.isArray(unionPoly) && unionPoly.length > 0) {
            unionPoly = unionPoly[0];
          }
        }
        // unionPoly es un anillo lineal (array de puntos); calcular el área con la fórmula de Shoelace.
        area = areaShoelace(unionPoly);
      }
      room.area = area;
      // Asignar paredes como el tamaño del set wallGroups.
      room.paredes = room.wallGroups ? room.wallGroups.size : 0;
      console.log(`parsearOBJ: Para habitación ${id}, paredes = ${room.paredes}, área calculada = ${area}`);
    }
    console.log("parsearOBJ: habitaciones finales:", habitaciones);
    return habitaciones;
  }  