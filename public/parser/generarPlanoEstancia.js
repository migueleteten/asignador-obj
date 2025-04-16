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

function realizarAsignacion(tipoSuperficie, idSuperficie, elementoClicado) {
  if (!window.productoEnAsignacion || !window.botonOrigenAsignacion || !window.expedienteActual) {
      console.error("Estado inválido para realizar asignación.", window.productoEnAsignacion, window.botonOrigenAsignacion, window.expedienteActual);
      cancelarAsignacion();
      return;
  }

  const { codigo, color } = window.productoEnAsignacion;
  const botonOriginal = window.botonOrigenAsignacion;

  // Obtener roomId del SVG padre del elemento clicado
  const svgElement = elementoClicado.closest('svg[data-room-id]');
  if (!svgElement) {
       console.error("No se pudo encontrar el SVG padre con data-room-id.");
       cancelarAsignacion();
       return;
  }
  const roomId = svgElement.getAttribute('data-room-id');

  console.log(`Intentando asignar ${codigo} a ${tipoSuperficie} ${idSuperficie} en room ${roomId}`);

  // --- Validar que no exista ya esta asignación EXACTA (opcional, backend también valida) ---
  const selectorExistente = `[data-asignacion-codigo="${codigo}"][data-asignacion-id="${idSuperficie}"]`;
  if (svgElement.querySelector(selectorExistente)) {
       console.warn(`El producto ${codigo} ya está asignado visualmente a ${idSuperficie} en este plano.`);
       alert(`Este producto ya está asignado a esta superficie.`);
       cancelarAsignacion();
       return;
   }


  // 1. Dibujar Indicador Visual
  let elementoVisualAsignacion;
  if (tipoSuperficie === 'wall') {
      // Necesitamos la línea original de la pared, no solo el elemento clicado (que podría ser el indicador si hubiera error)
      const lineaOriginal = svgElement.querySelector(`line.pared[data-wall="${idSuperficie}"]`);
      if (!lineaOriginal) {
          console.error(`No se encontró la línea original de la pared con wallId: ${idSuperficie}`);
          cancelarAsignacion();
          return;
      }
      elementoVisualAsignacion = dibujarIndicadorPared(lineaOriginal, codigo, idSuperficie, color);
  } else if (tipoSuperficie === 'floor') {
      // Necesitamos el polígono original del suelo
      const poligonoOriginal = svgElement.querySelector('polygon.suelo');
       if (!poligonoOriginal) {
          console.error(`No se encontró el polígono original del suelo.`);
          cancelarAsignacion();
          return;
      }
      elementoVisualAsignacion = dibujarIndicadorSuelo(poligonoOriginal, codigo, color);
  }

  if (!elementoVisualAsignacion) {
      console.error("No se pudo crear el elemento visual de asignación.");
      cancelarAsignacion();
      return;
  }
  // Generar un ID único para este elemento visual específico (útil para el botón eliminar)
  const visualId = `asignacion-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  elementoVisualAsignacion.setAttribute("id", visualId);


  // 2. Registrar en Google Sheet
  const datosAsignacion = {
      expediente: window.expedienteActual,
      codigoProducto: codigo,
      estancia: roomId, // Usar el roomId obtenido del SVG
      superficie: idSuperficie, // wallId o 'floor'
      estado: 'asignado', // O mantener el estado que tuviera el producto? Mejor 'asignado' aquí.
      origen: 'webapp-svg',
      // cantidad, comentarios: podrían añadirse si se recogen de algún sitio
  };

  // Mostrar feedback inmediato (ej. spinner) - Opcional
  elementoVisualAsignacion.style.opacity = '0.5'; // Indicar que está procesando

  google.script.run
      .withSuccessHandler(respuesta => {
          console.log("Asignación registrada en Sheet:", respuesta);
          elementoVisualAsignacion.style.opacity = '1'; // Restaurar opacidad

          // 3. Actualizar Botón Original
          botonOriginal.textContent = "Eliminar asignación";
          botonOriginal.classList.remove("asignar");
          botonOriginal.classList.add("eliminar");
          // El onclick ahora llama a eliminar, pasando los datos necesarios Y el ID del elemento visual
          botonOriginal.onclick = () => eliminarAsignacion(codigo, tipoSuperficie, idSuperficie, roomId, visualId);

           // 4. Añadir listener al nuevo elemento visual para eliminar
           elementoVisualAsignacion.addEventListener('click', (event) => {
               event.stopPropagation();
               // Pasar el ID del elemento visual para encontrarlo fácilmente
               eliminarAsignacion(codigo, tipoSuperficie, idSuperficie, roomId, visualId);
           });
           elementoVisualAsignacion.style.cursor = 'pointer';

      })
      .withFailureHandler(error => {
          console.error("Error al registrar en Sheet:", error);
          alert(`Error al guardar la asignación para ${codigo}: ${error.message || error}`);
          // Eliminar el indicador visual si falla el guardado
          if (elementoVisualAsignacion && elementoVisualAsignacion.parentNode) {
              elementoVisualAsignacion.parentNode.removeChild(elementoVisualAsignacion);
          }
          // NO cambiar el botón original si falló
      })
      .registrarOActualizarAsignacion(datosAsignacion);

  // 5. Limpiar Estado de Asignación (se hace independientemente del éxito/fallo del backend)
  cancelarAsignacion(); // Llama a la función que limpia estado y UI
}


// --- 6. Funciones Auxiliares de Dibujo ---

function dibujarIndicadorPared(lineaOriginal, codigo, wallId, color) {
  const svg = lineaOriginal.closest('svg');
  if (!svg) return null;
  const svgNS = "http://www.w3.org/2000/svg";

  const x1 = parseFloat(lineaOriginal.getAttribute('x1'));
  const y1 = parseFloat(lineaOriginal.getAttribute('y1'));
  const x2 = parseFloat(lineaOriginal.getAttribute('x2'));
  const y2 = parseFloat(lineaOriginal.getAttribute('y2'));

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) return null; // Evitar división por cero

  // Calcular vector normal unitario (perpendicular)
  // Nota: La dirección "interior" puede depender del orden de los vértices del OBJ.
  // Prueba (-dy, dx). Si las líneas salen hacia afuera, prueba (dy, -dx).
  let nx = -dy / len;
  let ny = dx / len;

  // --- Heurística simple para intentar apuntar hacia adentro ---
  // Asume que el centro del viewBox (250, 250) está "dentro"
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const vecToCenter = { x: 250 - midX, y: 250 - midY };
  // Si el producto punto de la normal y el vector al centro es negativo,
  // apuntan en direcciones opuestas (la normal apunta "hacia afuera"). Invertir.
  if ((nx * vecToCenter.x + ny * vecToCenter.y) < 0) {
      nx = -nx;
      ny = -ny;
  }
  // -----------------------------------------------------------

  const offset = 4; // Desplazamiento en píxeles SVG

  const newLine = document.createElementNS(svgNS, "line");
  newLine.setAttribute('x1', (x1 + offset * nx).toFixed(2));
  newLine.setAttribute('y1', (y1 + offset * ny).toFixed(2));
  newLine.setAttribute('x2', (x2 + offset * nx).toFixed(2));
  newLine.setAttribute('y2', (y2 + offset * ny).toFixed(2));

  newLine.setAttribute('stroke', color);
  newLine.setAttribute('stroke-width', '2'); // Más fina que la pared
  newLine.setAttribute('stroke-linecap', 'round');
  newLine.setAttribute('class', 'indicador-asignacion pared-asignada'); // Clases para estilo/selección

  // Datos para identificar esta asignación
  newLine.setAttribute('data-asignacion-codigo', codigo);
  newLine.setAttribute('data-asignacion-tipo', 'wall');
  newLine.setAttribute('data-asignacion-id', wallId); // wallId

  // Insertar DESPUÉS de la línea original para que se vea encima si hay solapamiento
  lineaOriginal.insertAdjacentElement('afterend', newLine);

  return newLine;
}

function dibujarIndicadorSuelo(poligonoOriginal, codigo, color) {
  const svg = poligonoOriginal.closest('svg');
   if (!svg) return null;
  const svgNS = "http://www.w3.org/2000/svg";

  const newPolygon = document.createElementNS(svgNS, "polygon");
  newPolygon.setAttribute('points', poligonoOriginal.getAttribute('points')); // Mismos puntos

  newPolygon.setAttribute('fill', color);
  newPolygon.setAttribute('fill-opacity', '0.6'); // Semitransparente
  newPolygon.setAttribute('stroke', color);       // Borde del mismo color
  newPolygon.setAttribute('stroke-width', '1');
  newPolygon.setAttribute('class', 'indicador-asignacion suelo-asignado');

  // Datos para identificar esta asignación
  newPolygon.setAttribute('data-asignacion-codigo', codigo);
  newPolygon.setAttribute('data-asignacion-tipo', 'floor');
  newPolygon.setAttribute('data-asignacion-id', 'floor'); // Id genérico para suelo

  // Insertar DESPUÉS del polígono original
  poligonoOriginal.insertAdjacentElement('afterend', newPolygon);

  return newPolygon;
}


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