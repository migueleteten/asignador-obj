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
  
// ====================
// Helpers para el cálculo 2D
// ====================

// Deduplica un array de vértices 3D
function deduplicarVertices(vertices) {
    return vertices.filter((p, i, arr) =>
      i === arr.findIndex(pt => pt[0] === p[0] && pt[1] === p[1] && pt[2] === p[2])
    );
  }
  
  // Proyecta vértices 3D a 2D tomando solo X y Z.
  function proyectarXZ(vertices) {
    return vertices.map(([x, , z]) => [x, z]);
  }
  
  // Implementa el algoritmo de "Monotone Chain" para el Convex Hull 2D.
  function convexHull2D(puntos) {
    // Ordenamos por X; si igual, por Y.
    const pts = [...puntos].sort((a, b) => {
      return a[0] === b[0] ? a[1] - b[1] : a[0] - b[0];
    });
    // Función de producto cruzado.
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    
    const lower = [];
    for (let p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }
    
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }
    
    // Quitar los últimos puntos duplicados.
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }
  
  // Calcula el área de un polígono 2D usando la fórmula de Shoelace.
  function areaShoelace(polygon) {
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
      const [x1, y1] = polygon[i];
      const [x2, y2] = polygon[(i + 1) % polygon.length];
      area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area / 2);
  }
  
  // ====================
  // Función parsearOBJ con mejoras
  // ====================
  function parsearOBJ(textoOBJ) {
    console.log("parsearOBJ: iniciando parsing del OBJ...");
    const lines = textoOBJ.split("\n");
    const vertices = [];
    const habitaciones = {};
  
    let currentRoom = null;
    let currentGroup = null;
    let currentMaterial = null;
  
    // Procesamos cada línea del OBJ.
    for (const line of lines) {
      // Línea de vértices
      if (line.startsWith("v ")) {
        const partes = line.trim().split(/\s+/);
        // Se espera formato: "v x y z"
        const x = parseFloat(partes[1]);
        const y = parseFloat(partes[2]);
        const z = parseFloat(partes[3]);
        vertices.push([x, y, z]);
      }
      // Grupo: define currentGroup y currentRoom
      else if (line.startsWith("g ")) {
        const partes = line.trim().split(" ");
        currentGroup = partes[1];
        currentRoom = partes[2] || null;
        // Inicializamos la habitación si no existe.
        if (currentRoom && !habitaciones[currentRoom]) {
          habitaciones[currentRoom] = {
            color: null,
            verticesSuelo: [],
            wallGroups: new Set()
          };
        }
      }
      // Asigna el material (color) cuando se está en un grupo "ceiling"
      else if (line.startsWith("usemtl ")) {
        currentMaterial = line.split(" ")[1].trim().toLowerCase();
        if (currentGroup === "ceiling" && currentRoom) {
          if (!habitaciones[currentRoom]) {
            habitaciones[currentRoom] = {
              color: null,
              verticesSuelo: [],
              wallGroups: new Set()
            };
          }
          habitaciones[currentRoom].color = currentMaterial;
          console.log(`parsearOBJ: Asignado color '${currentMaterial}' a habitación '${currentRoom}' en grupo 'ceiling'`);
        }
      }
      // Procesa las caras (faces)
      else if (line.startsWith("f ") && currentRoom) {
        // Extrae índices. Usa la división por "//" (para ignorar normales)
        const indices = line.slice(2).trim().split(" ").map(f => {
          const idx = f.split("//")[0];
          let index = parseInt(idx);
          // Ajuste para índices negativos (se cuentan desde el final)
          if (index < 0) {
            return vertices.length + index;
          } else {
            return index - 1;
          }
        });
        if (!habitaciones[currentRoom]) {
          habitaciones[currentRoom] = {
            color: null,
            verticesSuelo: [],
            wallGroups: new Set()
          };
        }
        if (currentGroup === "floor") {
          // Agregar los vértices de la cara del piso
          const faceVertices = indices.map(i => vertices[i]);
          habitaciones[currentRoom].verticesSuelo.push(...faceVertices);
          console.log(`parsearOBJ: Agregados ${faceVertices.length} puntos de suelo a '${currentRoom}'`);
        }
        if (currentGroup && currentGroup.startsWith("wall")) {
          // Agrega el grupo de muro al Set (para contar paredes únicas)
          habitaciones[currentRoom].wallGroups.add(currentGroup);
        }
      }
    }
  
    // Postprocesamiento: para cada habitación, deduplicar vértices, calcular el área y paredes.
    for (const id in habitaciones) {
      // Deduplicar vértices del piso
      let vs = deduplicarVertices(habitaciones[id].verticesSuelo);
      // Proyectar a 2D tomando solo X y Z
      let vs2D = proyectarXZ(vs);
      // Calcular el Convex Hull de los puntos 2D
      const hull = convexHull2D(vs2D);
      // Calcular el área con la fórmula de Shoelace
      const area = areaShoelace(hull);
      habitaciones[id].area = area;
      // Asignar el número de paredes como el tamaño del set wallGroups
      habitaciones[id].paredes = habitaciones[id].wallGroups ? habitaciones[id].wallGroups.size : 0;
      console.log(`parsearOBJ: Para habitación ${id}, paredes = ${habitaciones[id].paredes}, área calculada = ${area}`);
    }
    console.log("parsearOBJ: habitaciones finales:", habitaciones);
    return habitaciones;
  }
  
  // ***********************************************
  // FIN DE asignadorEstancias.js
  // ***********************************************  