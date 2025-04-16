// Este archivo depende de que parseOBJ.js se haya ejecutado antes

function generarPlanoEstancia(roomId, divId) {
  console.log("🧩 Generando plano para roomId:", roomId, "div destino:", divId);
  // console.log("📦 Geometría disponible:", window.geometriaPorRoom); // Puede ser muy verboso, opcional

  const contenedor = document.getElementById(divId);
  if (!contenedor) {
      console.error("❌ No se encontró el contenedor con id:", divId); // Usar error para problemas críticos
      return;
  }

  const geometria = window.geometriaPorRoom?.[roomId];
  if (!geometria || !geometria.suelo || !geometria.paredes) { // Verificar también la existencia de suelo/paredes
      console.warn(`⚠️ No hay geometría completa (suelo/paredes) para ${roomId} en geometriaPorRoom`);
      contenedor.innerHTML = `<p style='color: #999; padding: 10px;'>No hay datos suficientes para generar el plano de ${roomId}.</p>`;
      return;
  }

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 500 500"); // Coincide con normalize
  svg.setAttribute("width", "100%");
  // Ajustar altura si es necesario, o usar aspect ratio con viewBox
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet"); // Mejor para responsividad
  svg.setAttribute("data-room-id", roomId);
  svg.style.maxWidth = "500px"; // Limitar tamaño máximo si se desea
  svg.style.display = "block"; // Evitar espacio extra debajo del SVG
  svg.style.margin = "auto"; // Centrar si es necesario


  // Dibujar suelo primero
  if (Array.isArray(geometria.suelo) && geometria.suelo.length > 0) {
      const suelo = document.createElementNS(svgNS, "polygon");
      // --- CORRECCIÓN: Usar p.y en lugar de p.z ---
      const puntos = geometria.suelo.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
      suelo.setAttribute("points", puntos);
      suelo.setAttribute("fill", "#ffffff"); // Un gris más claro
      suelo.setAttribute("stroke", "#cccccc"); // Borde más sutil
      suelo.setAttribute("stroke-width", "15"); // Ancho de borde más fino
      suelo.setAttribute("class", "suelo");
      suelo.style.cursor = "pointer";
      suelo.addEventListener("click", (event) => {
        if (window.productoEnAsignacion) {
            realizarAsignacion('floor', 'floor', event.target); // 'floor' como idSuperficie
        } else {
            console.log("Click en suelo (sin producto para asignar)");
        }
    });
      svg.appendChild(suelo);
  } else {
      console.warn(`Suelo para ${roomId} no es un array válido o está vacío.`);
  }

  // Dibujar paredes
  if (Array.isArray(geometria.paredes)) {
      geometria.paredes.forEach((pared, i) => {
          // --- CORRECCIÓN: Desestructurar y1, y2 en lugar de z1, z2 ---
          const { x1, y1, x2, y2, wallId } = pared;

          // --- CORRECCIÓN: Usar y1, y2 para calcular dy ---
          const dx = x2 - x1;
          const dy = y2 - y1; // Usar y1, y2
          const distancia = Math.sqrt(dx * dx + dy * dy);

          // Descartar líneas muy cortas (puede ser útil si hay vértices duplicados cercanos)
          if (distancia < 0.1) { // Umbral muy pequeño
               // console.log(`Descartando pared ${wallId || i} por ser muy corta: ${distancia.toFixed(3)}`);
               return;
          }

          const linea = document.createElementNS(svgNS, "line");
          // --- CORRECCIÓN: Establecer atributos y1, y2 ---
          linea.setAttribute("x1", x1.toFixed(2));
          linea.setAttribute("y1", y1.toFixed(2)); // Usar y1
          linea.setAttribute("x2", x2.toFixed(2));
          linea.setAttribute("y2", y2.toFixed(2)); // Usar y2

          linea.setAttribute("stroke", "#888888"); // Un gris más oscuro para las paredes
          linea.setAttribute("stroke-width", "15"); // Hacerlas un poco más gruesas
          linea.setAttribute("stroke-linecap", "round"); // Extremos redondeados
          if (wallId) { // Solo añadir data-wall si existe
               linea.setAttribute("data-wall", wallId);
          } else {
               console.warn(`Pared ${i} en ${roomId} no tiene wallId asignado.`);
               linea.setAttribute("stroke", "#ff0000"); // Marcar en rojo paredes sin ID?
          }
          linea.setAttribute("class", "pared");
          linea.style.cursor = "pointer";

          if (wallId) { // Solo añadir listener si la pared tiene ID
            linea.addEventListener("click", (event) => {
                event.stopPropagation();
                if (window.productoEnAsignacion) {
                    realizarAsignacion('wall', wallId, event.target);
                } else {
                    console.log(`Click en pared ${wallId} (sin producto para asignar)`);
                }
            });
            linea.style.cursor = "pointer"; // Hacerla clickable solo si tiene ID y listener
        }
          svg.appendChild(linea);
      });
  } else {
       console.warn(`Paredes para ${roomId} no es un array válido.`);
  }

  contenedor.innerHTML = ""; // Limpiar antes de añadir
  contenedor.appendChild(svg);
  console.log(`✅ Plano SVG para ${roomId} generado en ${divId}.`);
}

function asignarASuperficie(codigo, color, event) {
  // Si ya estábamos asignando otro producto, cancelar la asignación anterior
  if (window.productoEnAsignacion) {
      cancelarAsignacion();
  }

  window.productoEnAsignacion = { codigo: codigo, color: color };
  window.botonOrigenAsignacion = event.target; // Guardar referencia al botón

  console.log(`Listo para asignar producto ${codigo} (Color: ${color}). Haz clic en una pared o suelo del plano correspondiente.`);

  // Feedback visual: Cambiar cursor en TODOS los contenedores de plano
  document.querySelectorAll(".plano-estancia").forEach(cont => {
      cont.style.cursor = 'crosshair';
      cont.classList.add('modo-asignacion'); // Añadir clase para posible resaltado CSS
  });

   // Opcional: Resaltar el producto que se está asignando
   event.target.closest('.cromo-producto')?.classList.add('asignando-ahora');

  // Opcional: Añadir listener para cancelar con clic fuera del SVG? Más complejo.
}

// --- 4. Nueva Función: `cancelarAsignacion` ---

function cancelarAsignacion() {
  if (!window.productoEnAsignacion) return; // No hay nada que cancelar

  console.log("Asignación cancelada para", window.productoEnAsignacion.codigo);
  // Quitar resaltado del producto
  const cromoAsignando = document.querySelector('.cromo-producto.asignando-ahora');
   if(cromoAsignando) cromoAsignando.classList.remove('asignando-ahora');

  window.productoEnAsignacion = null;
  window.botonOrigenAsignacion = null;

  // Restaurar cursor en todos los planos
  document.querySelectorAll(".plano-estancia").forEach(cont => {
      cont.style.cursor = 'default';
      cont.classList.remove('modo-asignacion');
  });
}

// Listener para cancelar con tecla ESC
document.addEventListener('keydown', (event) => {
  if (event.key === "Escape" && window.productoEnAsignacion) {
      cancelarAsignacion();
  }
});

// --- 5. Nueva Función: `realizarAsignacion` (Llamada por clicks en SVG) ---

// --- DENTRO de generarPlanoEstancia.js ---

async function realizarAsignacion(tipoSuperficie, idSuperficie, elementoClicado) {
  // --- Obtener datos esenciales ---
  const expedienteActual = sessionStorage.getItem("expedienteSeleccionado");
  if (!window.productoEnAsignacion || !window.botonOrigenAsignacion || !expedienteActual) {
      console.error("Estado inválido (falta producto, botón o expediente).", window.productoEnAsignacion, window.botonOrigenAsignacion, expedienteActual);
      cancelarAsignacion(); // Limpia estado (productoEnAsignacion, etc.)
      return;
  }

  const { codigo: codigoProducto, color } = window.productoEnAsignacion;
  const botonOriginal = window.botonOrigenAsignacion;

  const svgElement = elementoClicado.closest('svg[data-room-id]');
  if (!svgElement) {
      console.error("No se pudo encontrar el SVG padre.");
      cancelarAsignacion();
      return;
  }
  const roomId = svgElement.getAttribute('data-room-id');

  // --- Obtener datos geométricos necesarios para el NUEVO detalle ---
  // (Estas funciones DEBEN estar implementadas y funcionar correctamente)
  const alturaDefault = getRoomHeight(roomId) || 2.5; // Obtener altura (o fallback)
  const longitudObtenida = getSegmentLength(idSuperficie, roomId) || 0; // Obtener longitud (o fallback)

  console.log(`Asignando ${codigoProducto} a ${idSuperficie} (${tipoSuperficie}) en ${roomId} [Exp: ${expedienteActual}]`);
  console.log(` - Altura default: ${alturaDefault}, Longitud superficie: ${longitudObtenida}`);

  // Mostrar feedback visual inmediato (opcional)
  if (elementoClicado) elementoClicado.style.opacity = '0.5'; // Atenuar pared/suelo clicado

  // --- Preparar datos para guardar el NUEVO detalle por PRIMERA VEZ ---
  const detalleDataInicial = {
      expediente: expedienteActual,
      estancia: roomId,
      codigoProducto: codigoProducto,
      idSuperficie: idSuperficie,
      cotaInferior: 0, // Default inicial
      cotaSuperior: alturaDefault, // Default inicial
      longitudSuperficie: +longitudObtenida.toFixed(4), // Guardar longitud obtenida
      huecosJSON: [] // Sin huecos inicialmente (se guardará como '[]')
      // cantidadCalculadaM2 se calcula en el backend
  };

  // --- LLAMAR A LA FUNCIÓN BACKEND CORRECTA ---
  google.script.run
      .withSuccessHandler(function(respuestaBackend) {
          console.log("Respuesta de guardarDetalleSuperficie:", respuestaBackend);
           if (elementoClicado) elementoClicado.style.opacity = '1'; // Restaurar opacidad

          if (respuestaBackend && respuestaBackend.status === "success") {
              // --- ÉXITO AL GUARDAR ---

              // 1. Dibujar Indicador Visual (usando la función ya modificada con offset)
              let elementoVisualAsignacion;
              if (tipoSuperficie === 'wall') {
                  const lineaOriginal = svgElement.querySelector(`line.pared[data-wall="${idSuperficie}"]`);
                  if (lineaOriginal) {
                      elementoVisualAsignacion = dibujarIndicadorPared(lineaOriginal, codigoProducto, idSuperficie, color);
                  } else console.error("No se encontró línea original para dibujar indicador pared", idSuperficie);
              } else { // floor
                  const poligonoOriginal = svgElement.querySelector('polygon.suelo');
                   if (poligonoOriginal) {
                      elementoVisualAsignacion = dibujarIndicadorSuelo(poligonoOriginal, codigoProducto, color);
                  } else console.error("No se encontró polígono original para dibujar indicador suelo");
              }

              // 2. Crear el Mini-Formulario UI (¡Este es el paso que falta!)
              if (elementoVisualAsignacion) {
                  // --- !! PASO SIGUIENTE: IMPLEMENTAR ESTO !! ---
                  // Necesitamos encontrar el contenedor correcto bajo el cromo del producto
                  const contenedorFormularios = findMiniFormContainer(roomId, codigoProducto); // NECESITAMOS ESTA FUNCIÓN
                  if (contenedorFormularios) {
                       const miniFormElement = crearMiniFormularioSuperficie(detalleDataInicial, contenedorFormularios, roomId, codigoProducto);
                       if (miniFormElement) {
                           // attachListenersToMiniForm(miniFormElement.id); // Adjuntar listeners (Paso futuro)
                       }
                  } else {
                       console.error(`No se encontró el contenedor para mini-forms de ${codigoProducto} en ${roomId}`);
                  }
                   // --- FIN PASO SIGUIENTE ---

                   // Añadir listener al elemento visual para eliminar (si se creó bien)
                   elementoVisualAsignacion.addEventListener('click', (event) => {
                       event.stopPropagation();
                       handleDeleteSurfaceAssignment(elementoVisualAsignacion.id); // Asume que el ID se puso bien en dibujarIndicador...
                   });
                   elementoVisualAsignacion.style.cursor = 'pointer';

              } else {
                  console.error("No se pudo dibujar el indicador visual, no se creará mini-form.");
              }


              // 3. Actualizar Botón Original (si no se ha modificado ya por otra asignación)
              if (botonOriginal && botonOriginal.classList.contains('asignar')) { // Solo cambiar si AÚN es "Asignar"
                   botonOriginal.textContent = "Eliminar asignación"; // OJO: Este botón ahora debería DESCARTAR, no eliminar detalles? Revisar lógica de botones
                   botonOriginal.classList.remove("asignar");
                   botonOriginal.classList.add("eliminar"); // ¿O clase 'descartar'?
                   // El onclick debería ser para descartar el producto, no para eliminar superficie
                   // botonOriginal.onclick = () => descartarProducto(codigoProducto, roomId); // Revisar si esto es correcto
                   console.warn("Lógica del botón principal 'Eliminar asignación' necesita revisión para nueva funcionalidad.");
              }

               // 4. Actualizar Cantidad Total (Paso futuro)
               // updateTotalQuantityDisplay(expedienteActual, roomId, codigoProducto);


          } else {
              // El backend devolvió un error controlado
              console.error("Error guardando detalle superficie:", respuestaBackend?.message || "Error desconocido");
              alert("Error al guardar la asignación de superficie: " + (respuestaBackend?.message || "Error desconocido"));
          }

           // Limpiar estado de asignación independientemente del éxito del UI
           cancelarAsignacion();

      })
      .withFailureHandler(error => {
          // Error en la llamada google.script.run en sí
           if (elementoClicado) elementoClicado.style.opacity = '1'; // Restaurar opacidad
           handleScriptError(error); // Usar el manejador genérico
           cancelarAsignacion(); // Limpiar estado también si falla la llamada
      })
      .guardarDetalleSuperficie(detalleDataInicial); // <--- LLAMAR A LA FUNCIÓN CORRECTA

}

/**
 * Encuentra el div contenedor específico para los mini-formularios de un producto.
 * Busca relativo al botón "Asignar/Eliminar" de ese producto.
 * @param {string} roomId - El ID de la habitación (puede no ser necesario con esta estrategia).
 * @param {string} codigoProducto - El código del producto.
 * @returns {HTMLElement|null} El elemento div contenedor o null si no se encuentra.
 */
function findMiniFormContainer(roomId, codigoProducto) {
  // 1. Encontrar un elemento distintivo del producto (el botón es buena opción)
  // Usamos data-codigo que añadimos al botón
  const botonProducto = document.querySelector(`button[data-codigo="${codigoProducto}"]`);
  if (!botonProducto) {
      console.error(`findMiniFormContainer: No se encontró el botón para ${codigoProducto}`);
      return null;
  }
  // 2. Subir al contenedor del tipo de producto (<details class="bloque-tipo">)
  const detailElement = botonProducto.closest('.bloque-tipo');
  if (!detailElement) {
       console.error(`findMiniFormContainer: No se encontró el <details> padre (.bloque-tipo) para ${codigoProducto}`);
       return null;
  }
  // 3. Buscar DENTRO de ese <details> el div contenedor específico
  const selector = `.mini-forms-container[data-codigo-producto="${codigoProducto}"]`;
  const contenedor = detailElement.querySelector(selector);

  if (!contenedor) {
      // Este log es útil si el contenedor no se creó bien en procesarAsignaciones
      console.error(`findMiniFormContainer: Contenedor no encontrado con selector: ${selector} DENTRO del detail`);
  }
  return contenedor || null; // Devuelve el contenedor o null
}

// --- 6. Funciones Auxiliares de Dibujo ---

/**
 * Dibuja el indicador visual para una pared asignada, aplicando offset si ya existen otros.
 * @param {SVGLineElement} lineaOriginal - El elemento <line> de la pared base.
 * @param {string} codigo - El código del producto asignado.
 * @param {string} wallId - El ID de la pared (ej. "wall111").
 * @param {string} color - El color CSS para el indicador.
 * @returns {SVGLineElement|null} El nuevo elemento <line> creado o null si hay error.
 */
function dibujarIndicadorPared(lineaOriginal, codigo, wallId, color) {
  const svgElement = lineaOriginal.closest('svg[data-room-id]'); // Encuentra el SVG padre
  if (!svgElement) {
      console.error("dibujarIndicadorPared: No se encontró SVG padre para", lineaOriginal);
      return null;
  }
  const svgNS = "http://www.w3.org/2000/svg";

  // --- NUEVO: Lógica de Offset ---
  // Buscar indicadores existentes para esta MISMA pared
  const selector = `.indicador-asignacion[data-asignacion-tipo="wall"][data-asignacion-id="${wallId}"]`;
  const existingIndicators = svgElement.querySelectorAll(selector);
  const offsetIndex = existingIndicators.length; // 0 para el primero, 1 para el segundo, etc.

  const baseOffset = 10; // Desplazamiento base en píxeles SVG
  const stepOffset = 8; // Desplazamiento adicional por cada indicador existente
  const finalOffset = baseOffset + offsetIndex * stepOffset;
  console.log(`Dibujando indicador para ${wallId} (Producto ${codigo}). Índice: ${offsetIndex}, Offset: ${finalOffset}`);
  // --- FIN Lógica de Offset ---

  const x1 = parseFloat(lineaOriginal.getAttribute('x1'));
  const y1 = parseFloat(lineaOriginal.getAttribute('y1'));
  const x2 = parseFloat(lineaOriginal.getAttribute('x2'));
  const y2 = parseFloat(lineaOriginal.getAttribute('y2'));

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) return null;

  // Calcular vector normal unitario (perpendicular) e intentar apuntar hacia adentro
  let nx = -dy / len;
  let ny = dx / len;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const vecToCenter = { x: 250 - midX, y: 250 - midY }; // Asume centro en 250,250
  if ((nx * vecToCenter.x + ny * vecToCenter.y) < 0) {
      nx = -nx;
      ny = -ny;
  }

  const newLine = document.createElementNS(svgNS, "line");
  // Aplicar el offset FINAL calculado
  newLine.setAttribute('x1', (x1 + finalOffset * nx).toFixed(2));
  newLine.setAttribute('y1', (y1 + finalOffset * ny).toFixed(2));
  newLine.setAttribute('x2', (x2 + finalOffset * nx).toFixed(2));
  newLine.setAttribute('y2', (y2 + finalOffset * ny).toFixed(2));

  newLine.setAttribute('stroke', color);
  newLine.setAttribute('stroke-width', '8');
  newLine.setAttribute('stroke-linecap', 'round');
  newLine.setAttribute('class', 'indicador-asignacion pared-asignada');

  // Datos para identificar esta asignación específica
  newLine.setAttribute('data-asignacion-codigo', codigo);
  newLine.setAttribute('data-asignacion-tipo', 'wall');
  newLine.setAttribute('data-asignacion-id', wallId);
  // Generamos un ID único para poder referenciarlo fácilmente (ej, para borrarlo)
  const visualId = `asignacion-${codigo}-${wallId}-${Date.now()}`;
  newLine.setAttribute("id", visualId);


  // Insertar DESPUÉS de la línea original
  lineaOriginal.insertAdjacentElement('afterend', newLine);

  return newLine; // Devolver la línea creada
}

/**
 * Dibuja el indicador visual para el suelo asignado.
 * Nota: Para el suelo, simplemente superponemos polígonos con opacidad.
 * El último asignado será el más visible, pero todos existen en el DOM.
 * @param {SVGPolygonElement} poligonoOriginal - El elemento <polygon> del suelo base.
 * @param {string} codigo - El código del producto asignado.
 * @param {string} color - El color CSS para el indicador.
 * @returns {SVGPolygonElement|null} El nuevo elemento <polygon> creado o null si hay error.
 */
function dibujarIndicadorSuelo(poligonoOriginal, codigo, color) {
  const svgElement = poligonoOriginal.closest('svg[data-room-id]');
  if (!svgElement) {
     console.error("dibujarIndicadorSuelo: No se encontró SVG padre para", poligonoOriginal);
     return null;
  }
 const svgNS = "http://www.w3.org/2000/svg";

 // --- Lógica de Opacidad (Alternativa a Offset para suelo) ---
 // Buscar indicadores de suelo existentes
 const selector = '.indicador-asignacion[data-asignacion-tipo="floor"]';
 const existingIndicators = svgElement.querySelectorAll(selector);
 const baseOpacity = 0.6;
 const opacityStep = 0.05; // Reducir opacidad ligeramente por cada capa
 const finalOpacity = Math.max(0.1, baseOpacity - existingIndicators.length * opacityStep); // Evitar opacidad 0 o negativa
  console.log(`Dibujando indicador para suelo (Producto ${codigo}). Capa: ${existingIndicators.length}, Opacidad: ${finalOpacity}`);
 // --- Fin Lógica de Opacidad ---


 const newPolygon = document.createElementNS(svgNS, "polygon");
 newPolygon.setAttribute('points', poligonoOriginal.getAttribute('points'));

 newPolygon.setAttribute('fill', color);
 newPolygon.setAttribute('fill-opacity', finalOpacity.toFixed(2)); // Aplicar opacidad calculada
 newPolygon.setAttribute('stroke', 'none'); // Sin borde para que no se acumulen
 newPolygon.setAttribute('class', 'indicador-asignacion suelo-asignado');

 // Datos para identificar esta asignación específica
 newPolygon.setAttribute('data-asignacion-codigo', codigo);
 newPolygon.setAttribute('data-asignacion-tipo', 'floor');
 newPolygon.setAttribute('data-asignacion-id', 'floor'); // ID genérico para suelo
 // Generamos un ID único
 const visualId = `asignacion-${codigo}-floor-${Date.now()}`;
 newPolygon.setAttribute("id", visualId);

 // Insertar DESPUÉS del polígono original (o del último indicador de suelo)
 if (existingIndicators.length > 0) {
    existingIndicators[existingIndicators.length - 1].insertAdjacentElement('afterend', newPolygon);
 } else {
    poligonoOriginal.insertAdjacentElement('afterend', newPolygon);
 }


 return newPolygon;
}

// --- DENTRO de generarPlanoEstancia.js ---

/**
 * Calcula la cantidad neta para un detalle de superficie.
 * @param {number} longitud - Longitud de la superficie.
 * @param {number} cotaInf - Cota inferior.
 * @param {number} cotaSup - Cota superior.
 * @param {Array<object>} huecosArray - Array de objetos hueco, ej: [{largo: 1, alto: 1}, ...].
 * @returns {number} La cantidad calculada en m², redondeada a 3 decimales.
 */
function calcularCantidadDetalle(longitud, cotaInf, cotaSup, huecosArray) {
  const long = parseFloat(longitud) || 0;
  const cInf = parseFloat(cotaInf) || 0;
  const cSup = parseFloat(cotaSup) || 0;
  let restaHuecos = 0;

  // Sumar el área de los huecos válidos
  if (Array.isArray(huecosArray)) {
      huecosArray.forEach(h => {
          const largo = parseFloat(h?.largo) || 0;
          const alto = parseFloat(h?.alto) || 0;
          if (largo > 0 && alto > 0) {
              restaHuecos += (largo * alto);
          }
      });
  }

  const alturaNeta = cSup - cInf;
  // Asegurarse que la altura neta no sea negativa
  if (alturaNeta < 0) {
       console.warn(`Cálculo cantidad: Cota superior (${cSup}) es menor que inferior (${cInf}). Usando altura 0.`);
       return 0;
  }

  const cantidadBruta = long * alturaNeta;
  const cantidadNeta = Math.max(0, cantidadBruta - restaHuecos); // Evitar cantidades negativas

  // Devolver como número redondeado
  return +cantidadNeta.toFixed(3);
}


/**
* Crea y añade el HTML del mini-formulario para un detalle de superficie.
* @param {object} detalleData - Objeto con los datos del detalle (puede tener valores por defecto si es nuevo).
* Ej: { idDetalle?, idSuperficie, cotaInferior?, cotaSuperior?, longitudSuperficie?, huecosJSON? }
* @param {HTMLElement} contenedorDOM - El elemento HTML donde se añadirá este formulario.
* @param {string} roomId - El ID de la habitación.
* @param {string} codigoProducto - El código del producto asociado.
* @returns {HTMLElement|null} El elemento div principal del formulario creado o null si hay error.
*/
function crearMiniFormularioSuperficie(detalleData, contenedorDOM, roomId, codigoProducto) {
  console.log(`Creando mini-form para:`, { detalleData, roomId, codigoProducto });

  // --- Obtener valores o establecer defaults ---
  // Usar ID_Detalle real si existe (al restaurar), o uno temporal si es nuevo
  const idSuperficie = detalleData.idSuperficie;
  const idDetalle = detalleData.idDetalle || `new-${idSuperficie}-${Date.now()}`;
  if (!idSuperficie) {
       console.error("Error crítico: Falta idSuperficie para crear mini-form.");
       return null;
   }

  const cotaInf = detalleData.cotaInferior !== undefined ? detalleData.cotaInferior : 0;

  // Obtener altura por defecto (NECESITA IMPLEMENTACIÓN de getRoomHeight)
  // Asumimos 2.5 como fallback si getRoomHeight no está lista o falla
  const alturaDefault = getRoomHeight(roomId) || 2.50;
  const cotaSup = detalleData.cotaSuperior !== undefined ? detalleData.cotaSuperior : alturaDefault;

  // Obtener longitud (NECESITA IMPLEMENTACIÓN de getSegmentLength)
  // Asumimos 0 como fallback si getSegmentLength no está lista o falla
  const longitud = detalleData.longitudSuperficie !== undefined ? detalleData.longitudSuperficie : (getSegmentLength(idSuperficie, roomId) || 0);

  // Huecos: Asegurarse que es un array
  const huecos = Array.isArray(detalleData.huecosJSON) ? detalleData.huecosJSON : [];

  // Calcular cantidad inicial
  const cantidadInicial = calcularCantidadDetalle(longitud, cotaInf, cotaSup, huecos);

  // ID único para el contenedor del formulario
  const formId = `miniform-${roomId}-${codigoProducto}-${idSuperficie.replace(/[^a-zA-Z0-9]/g, '')}`; // Crear ID válido para HTML

  // --- Crear estructura HTML ---
  const divForm = document.createElement('div');
  divForm.className = 'mini-form-superficie'; // Clase principal para estilos
  divForm.id = formId;
  // Guardar datos clave en atributos data-* para fácil acceso desde listeners
  divForm.dataset.idDetalle = idDetalle; // Puede ser 'new-...' inicialmente
  divForm.dataset.idSuperficie = idSuperficie;
  divForm.dataset.codigoProducto = codigoProducto;
  divForm.dataset.roomId = roomId;
  divForm.dataset.longitud = longitud.toFixed(4); // Guardar longitud como data attribute

  let formHTML = `
      <div class="mini-form-header">
          <strong>Superficie: ${idSuperficie}</strong>
          <span class="longitud-display">(Long: ${longitud.toFixed(2)} m)</span>
      </div>
      <div class="mini-form-row cotas-row">
          <label for="${formId}-cotaInf">Cota Inf (m):</label>
          <input type="number" id="${formId}-cotaInf" class="cota-input" data-prop="cotaInferior" step="0.01" min="0" value="${cotaInf}">
          <label for="${formId}-cotaSup">Cota Sup (m):</label>
          <input type="number" id="${formId}-cotaSup" class="cota-input" data-prop="cotaSuperior" step="0.01" min="0" value="${cotaSup}">
      </div>
      <div class="mini-form-huecos">
          <strong class="huecos-titulo">Huecos a restar:</strong>
          <div class="huecos-container">`; // Contenedor para filas de huecos

  // --- Añadir filas para huecos existentes ---
  huecos.forEach((hueco, index) => {
      // Generar ID único para la fila del hueco
       const huecoRowId = `${formId}-hueco-${index}`;
       // Usamos comillas simples dentro del onclick para el formId
       formHTML += `
          <div class="hueco-row" id="${huecoRowId}" data-hueco-index="${index}">
              <label>H${index + 1} (m):</label>
              L: <input type="number" class="hueco-input" data-prop="largo" step="0.01" min="0" value="${hueco.largo || ''}" placeholder="Largo">
              &times; Al: <input type="number" class="hueco-input" data-prop="alto" step="0.01" min="0" value="${hueco.alto || ''}" placeholder="Alto">
              <button type="button" class="remove-hueco-btn" title="Eliminar Hueco" onclick="removeHueco('${huecoRowId}', '${formId}')">&times;</button>
          </div>`;
  });

  // Cerrar divs y añadir botón para añadir hueco
  formHTML += `
          </div> {/* Fin huecos-container */}
          <button type="button" class="add-hueco-btn" onclick="addHueco('${formId}')">+ Restar hueco</button>
      </div> {/* Fin mini-form-huecos */}
      <div class="mini-form-resultado">
          <strong>Cantidad (m²):</strong>
          <span class="cantidad-calculada-display">${cantidadInicial.toFixed(3)}</span>
      </div>
      <div class="mini-form-actions">
           <button type="button" class="delete-surface-btn" title="Eliminar asignación de esta superficie" onclick="handleDeleteSurfaceAssignment('${formId}')">Eliminar Superficie</button>
      </div>
  `;

  divForm.innerHTML = formHTML;

  // --- Añadir al DOM ---
  if (contenedorDOM && contenedorDOM.appendChild) {
      contenedorDOM.appendChild(divForm);
      console.log(`Mini-form ${formId} añadido al DOM.`);
      // --- Adjuntar Listeners (próximo paso) ---
      // Aquí llamaríamos a la función que añade los listeners de input, etc.
      // attachListenersToMiniForm(formId);
      return divForm; // Devolver el elemento creado
  } else {
      console.error("Contenedor DOM no válido para el mini-formulario:", contenedorDOM);
      return null;
  }
}

// --- FUNCIONES PLACEHOLDER (NECESITAN IMPLEMENTACIÓN) ---

function getRoomHeight(roomId) {
  // TODO: Implementar lógica para obtener la altura de window.geometriaPorRoom
  const roomData = window.geometriaPorRoom ? window.geometriaPorRoom[roomId] : null;
  if (roomData && roomData.alturaTecho !== undefined) {
      return roomData.alturaTecho;
  }
  console.warn(`getRoomHeight: No se encontró altura para room ${roomId}. Usando fallback 2.5`);
  return 2.5; // Valor por defecto temporal
}

function getSegmentLength(idSuperficie, roomId) {
   // TODO: Implementar lógica para obtener la longitud de window.geometriaPorRoom
   if (idSuperficie === 'floor') return 0; // Suelo no tiene longitud lineal definida así
   const roomData = window.geometriaPorRoom ? window.geometriaPorRoom[roomId] : null;
   const pared = roomData?.paredes?.find(p => p.wallId === idSuperficie);
   if (pared && pared.longitudOriginal !== undefined) {
       return pared.longitudOriginal;
   }
   console.warn(`getSegmentLength: No se encontró longitud para superficie ${idSuperficie} en room ${roomId}. Usando fallback 0`);
   return 0; // Valor por defecto temporal
}

// --- FIN FUNCIONES PLACEHOLDER ---

// --- 7. Nueva Función: `eliminarAsignacion` (Llamada por botón o click en indicador) ---

function eliminarAsignacion(codigo, tipoSuperficie, idSuperficie, roomId, visualElementId) {
  console.log(`Solicitando eliminar asignación de ${codigo} de ${tipoSuperficie} ${idSuperficie} en ${roomId}`);

  const elementoVisual = document.getElementById(visualElementId);
  if (!elementoVisual) {
      console.warn(`No se encontró el elemento visual con ID: ${visualElementId} para eliminar.`);
      // Opcional: intentar restaurar el botón si no se encuentra el elemento visual?
      // restaurarBotonAsignar(codigo); // Necesitaría esta función auxiliar
      // return; // Salir si no encontramos qué eliminar visualmente
  }

  // Mostrar feedback (ej. atenuar) - Opcional
  if(elementoVisual) elementoVisual.style.opacity = '0.3';

  const datosParaEliminar = {
      expediente: window.expedienteActual,
      codigoProducto: codigo,
      estancia: roomId,
      superficie: idSuperficie
  };

  google.script.run
      .withSuccessHandler(respuesta => {
          console.log("Asignación eliminada/actualizada en Sheet:", respuesta);
          if (respuesta.status === "deleted" || respuesta.status === "not_found") { // Si se borró o no existía
              // Eliminar Elemento Visual
              if (elementoVisual && elementoVisual.parentNode) {
                  elementoVisual.parentNode.removeChild(elementoVisual);
              }
              // Restaurar Botón Original
              restaurarBotonAsignar(codigo); // Usar función auxiliar
          } else {
               console.error("Respuesta inesperada del backend al eliminar:", respuesta);
                if(elementoVisual) elementoVisual.style.opacity = '1'; // Restaurar opacidad si algo raro pasó
                alert("Ocurrió un error inesperado al intentar eliminar la asignación.");
          }
      })
      .withFailureHandler(error => {
          console.error("Error al eliminar/actualizar en Sheet:", error);
          alert(`Error al eliminar la asignación para ${codigo}: ${error.message || error}`);
          // Restaurar opacidad si falla
          if(elementoVisual) elementoVisual.style.opacity = '1';
      })
      .eliminarAsignacion(datosParaEliminar);
}

// --- 8. Función Auxiliar: `restaurarBotonAsignar` ---
function restaurarBotonAsignar(codigo) {
  const boton = document.querySelector(`button.eliminar[data-codigo="${codigo}"]`); // Buscar botón en estado "eliminar"
  if (boton) {
      boton.textContent = "Asignar a superficie";
      boton.classList.remove("eliminar");
      boton.classList.add("asignar");
      // Recuperar el color asociado a este producto (necesitamos encontrarlo en el DOM o tenerlo accesible)
      let color = '#808080'; // Color por defecto si no lo encontramos
      const cromo = boton.closest('.cromo-producto');
      const colorBadge = cromo?.querySelector('.color-badge');
      if (colorBadge) {
          color = colorBadge.style.backgroundColor;
      }
      // Restaurar listener original
      boton.onclick = (event) => asignarASuperficie(codigo, color, event);
  } else {
      console.warn(`No se encontró el botón 'Eliminar asignación' para el código ${codigo} para restaurar.`);
  }
}


// --- 9. Nueva Función: `restaurarAsignacionesVisuales` (Llamada después de generar plano) ---

function restaurarAsignacionesVisuales(roomId, divId) {
  console.log(`Restaurando asignaciones visuales para ${roomId} en ${divId}`);
  const svgElement = document.querySelector(`#${divId} > svg[data-room-id="${roomId}"]`);
  if (!svgElement || !window.expedienteActual) {
      console.warn("No se encontró SVG o falta expediente para restaurar asignaciones de", roomId);
      return;
  }

  google.script.run
      .withSuccessHandler(asignacionesGuardadas => {
          console.log(`Asignaciones recuperadas para ${window.expedienteActual}:`, asignacionesGuardadas);
          const asignacionesRoom = asignacionesGuardadas.filter(asig => asig.estancia === roomId && asig.superficie); // Filtrar por room y que tengan superficie

          asignacionesRoom.forEach(asig => {
              const { codigoProducto, superficie: idSuperficie, tipo, color: colorGuardado } = asig; // Asume que la func backend devuelve tipo y color si es posible
              const tipoSuperficie = idSuperficie === 'floor' ? 'floor' : 'wall';

               // --- Validar que no exista ya visulamente (por si acaso) ---
               const selectorExistente = `[data-asignacion-codigo="${codigoProducto}"][data-asignacion-id="${idSuperficie}"]`;
               if (svgElement.querySelector(selectorExistente)) {
                    console.log(`Asignación para ${codigoProducto} en ${idSuperficie} ya está dibujada, saltando.`);
                    return; // Ya está dibujado (quizás por una ejecución anterior), no duplicar
               }


              // Necesitamos el color. La función backend NO lo devuelve ahora.
              // Estrategia: buscar el color en el cromo correspondiente
              let color = '#808080'; // Gris por defecto
              const botonAsignar = document.querySelector(`button[data-codigo="${codigoProducto}"]`);
              const cromo = botonAsignar?.closest('.cromo-producto');
              const colorBadge = cromo?.querySelector('.color-badge');
               if (colorBadge) {
                   color = colorBadge.style.backgroundColor || color;
               } else {
                   console.warn(`No se pudo encontrar el color para el producto ${codigoProducto} al restaurar.`);
               }


              // Dibujar el indicador
              let elementoVisualAsignacion;
              if (tipoSuperficie === 'wall') {
                  const lineaOriginal = svgElement.querySelector(`line.pared[data-wall="${idSuperficie}"]`);
                  if (lineaOriginal) {
                      elementoVisualAsignacion = dibujarIndicadorPared(lineaOriginal, codigoProducto, idSuperficie, color);
                  } else {
                      console.warn(`Al restaurar, no se encontró la pared original ${idSuperficie} para ${codigoProducto}`);
                  }
              } else { // floor
                  const poligonoOriginal = svgElement.querySelector('polygon.suelo');
                  if (poligonoOriginal) {
                      elementoVisualAsignacion = dibujarIndicadorSuelo(poligonoOriginal, codigoProducto, color);
                  } else {
                       console.warn(`Al restaurar, no se encontró el suelo original para ${codigoProducto}`);
                  }
              }

              // Si se dibujó, añadir listener y actualizar botón
              if (elementoVisualAsignacion) {
                   // Generar ID único también al restaurar
                   const visualId = `asignacion-${Date.now()}-${Math.random().toString(16).slice(2)}`;
                   elementoVisualAsignacion.setAttribute("id", visualId);

                   elementoVisualAsignacion.addEventListener('click', (event) => {
                       event.stopPropagation();
                       eliminarAsignacion(codigoProducto, tipoSuperficie, idSuperficie, roomId, visualId);
                   });
                   elementoVisualAsignacion.style.cursor = 'pointer';

                   // Actualizar el botón correspondiente
                   if (botonAsignar && botonAsignar.classList.contains('asignar')) {
                       botonAsignar.textContent = "Eliminar asignación";
                       botonAsignar.classList.remove("asignar");
                       botonAsignar.classList.add("eliminar");
                       botonAsignar.onclick = () => eliminarAsignacion(codigoProducto, tipoSuperficie, idSuperficie, roomId, visualId);
                   }
              }
          });
      })
      .withFailureHandler(error => {
          console.error("Error al obtener asignaciones enriquecidas para restaurar:", error);
      })
      .obtenerAsignacionesEnriquecidasConSuperficie(window.expedienteActual); // Nueva función backend
}