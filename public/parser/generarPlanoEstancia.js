// Este archivo depende de que parseOBJ.js se haya ejecutado antes

/**
 * Genera el SVG del plano de una estancia y lo inserta en el div especificado.
 * MODIFICADO para leer datos del JSON consolidado cacheado en window.datosExpediente.
 * @param {string} roomId - El ID de la estancia (ej. "room108").
 * @param {string} divId - El ID del div contenedor donde se insertará el SVG.
 */
function generarPlanoEstancia(roomId, divId) {
  console.log(
    `🧩 Generando plano para roomId: ${roomId}, div destino: ${divId}`
  );

  const contenedor = document.getElementById(divId);
  if (!contenedor) {
    console.error(`❌ No se encontró el contenedor con id: ${divId}`);
    // Escribir error en el contenedor si existe la variable, si no, log extra
    if (typeof contenedor !== "undefined" && contenedor !== null) {
      contenedor.innerHTML =
        "<p style='color:red;'>Error: Contenedor no encontrado.</p>";
    } else {
      console.error(
        "La variable 'contenedor' es nula o no definida incluso antes de getElementById."
      );
    }
    return;
  }

  // --- LEER DATOS DEL JSON CONSOLIDADO CACHEADO ---
  // Accedemos a la estancia específica usando el roomId
  const estanciaData = window.datosExpediente?.estancias?.[roomId];
  // --- FIN LECTURA ---

  // Validar que tenemos los datos necesarios, incluyendo la geometría normalizada
  if (
    !estanciaData ||
    !estanciaData.geometriaPlanoNormalizada ||
    !estanciaData.geometriaPlanoNormalizada.suelo ||
    !estanciaData.geometriaPlanoNormalizada.paredes
  ) {
    console.warn(
      `⚠️ No hay geometría completa y normalizada para ${roomId} en window.datosExpediente.`
    );
    contenedor.innerHTML = `<p style='color: #999; padding: 10px;'>No hay datos de plano procesados o válidos para ${roomId}. Ejecute el procesamiento primero.</p>`;
    return;
  }

  // Acceder a la geometría normalizada para facilitar el acceso
  const geometriaNorm = estanciaData.geometriaPlanoNormalizada;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 500 500"); // Debe coincidir con la normalización
  svg.setAttribute("width", "100%");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet"); // Buena opción responsiva
  svg.setAttribute("data-room-id", roomId); // Guardar roomId en el SVG
  svg.style.maxWidth = "500px"; // Limitar tamaño opcionalmente
  svg.style.display = "block";
  svg.style.margin = "auto";
  svg.style.background = "#f8f8f8"; // Fondo muy claro para el SVG

  // --- Dibujar Suelo (Usando geometriaNorm.suelo) ---
  // La lógica es la misma, solo cambiamos la fuente de datos
  if (Array.isArray(geometriaNorm.suelo) && geometriaNorm.suelo.length >= 3) {
    const suelo = document.createElementNS(svgNS, "polygon");
    const puntosSuelo = geometriaNorm.suelo
      .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`) // Usar p.x, p.y
      .join(" ");
    suelo.setAttribute("points", puntosSuelo);
    suelo.setAttribute("fill", "#eeeeee"); // Gris claro suelo
    suelo.setAttribute("stroke", "#cccccc"); // Borde gris
    suelo.setAttribute("stroke-width", "15"); // Borde fino
    suelo.setAttribute("class", "suelo superficie-asignable"); // Añadir clase genérica?
    suelo.setAttribute("data-room-id", roomId); // Repetir roomId aquí es útil
    suelo.setAttribute("data-surface-id", "floor"); // ID estándar para suelo
    // Añadir área neta del suelo como data attribute
    suelo.setAttribute(
      "data-area-neta",
      estanciaData.areaOBJ_m2?.toFixed(3) || "N/A"
    );
    suelo.style.cursor = "pointer";
    suelo.addEventListener("click", (event) => {
      event.stopPropagation();
      if (window.productoEnAsignacion) {
        // Pasamos expediente, roomId, código producto, 'floor' y el target
        realizarAsignacion("floor", "floor", event.target);
      } else {
        console.log(`Click en suelo de ${roomId} (sin producto para asignar)`);
      }
    });
    svg.appendChild(suelo);
  } else {
    console.warn(`Datos de suelo inválidos para ${roomId}.`);
  }

  // --- Dibujar Paredes (Iterando sobre geometriaNorm.paredes) ---
  if (Array.isArray(geometriaNorm.paredes)) {
    geometriaNorm.paredes.forEach((paredData, i) => {
      // Extraer datos de la pared del objeto paredData del JSON
      const wallId = paredData.wallId_OBJ; // ID original del OBJ
      const puntos = paredData.puntosNormalizados; // Objeto {x1, y1, x2, y2}
      const longitud = paredData.longitudOriginal_m; // Longitud real
      const areaNeta = paredData.areaNetaCara_m2; // Área neta calculada

      // Validar datos esenciales
      if (
        !wallId ||
        !puntos ||
        typeof puntos.x1 !== "number" /* ... etc ... */
      ) {
        console.warn(
          `Datos incompletos para pared ${i} (${
            wallId || "sin ID"
          }) en ${roomId}.`
        );
        return; // Saltar esta pared
      }

      const { x1, y1, x2, y2 } = puntos;

      // Omitir líneas de longitud cero (visual)
      if (Math.hypot(x2 - x1, y2 - y1) < 0.1) {
        return;
      }

      const linea = document.createElementNS(svgNS, "line");
      linea.setAttribute("x1", x1.toFixed(2));
      linea.setAttribute("y1", y1.toFixed(2));
      linea.setAttribute("x2", x2.toFixed(2));
      linea.setAttribute("y2", y2.toFixed(2));
      linea.setAttribute("stroke", "#777777"); // Gris oscuro para paredes
      linea.setAttribute("stroke-width", "15"); // Grosor para que sea fácil hacer clic
      linea.setAttribute("stroke-linecap", "square");
      linea.setAttribute("class", "pared superficie-asignable"); // Clase genérica

      // --- AÑADIR ATRIBUTOS data-* con información clave ---
      linea.setAttribute("data-wall-id", wallId); // ID de la pared (ej. wall111)
      linea.setAttribute("data-wall-length", longitud?.toFixed(3) || "0"); // Longitud original
      linea.setAttribute("data-wall-net-area", areaNeta?.toFixed(3) || "0"); // Área neta
      linea.setAttribute("data-room-id", roomId); // ID de la estancia a la que pertenece
      // --- FIN ATRIBUTOS data-* ---

      linea.style.cursor = "pointer";

      // Añadir listener para asignar producto
      linea.addEventListener("click", (event) => {
        event.stopPropagation();
        if (window.productoEnAsignacion) {
          // Pasar wallId como idSuperficie y el target
          realizarAsignacion("wall", wallId, event.target);
        } else {
          console.log(
            `Click en pared ${wallId} de ${roomId} (sin producto para asignar)`
          );
          // Podríamos mostrar tooltip con info de la pared:
          // alert(`Pared: ${wallId}\nLongitud: ${longitud?.toFixed(2)}m\nÁrea Neta: ${areaNeta?.toFixed(2)}m²`);
        }
      });

      svg.appendChild(linea);
    });
  } else {
    console.warn(`Datos de paredes inválidos para ${roomId}.`);
  }

  // Limpiar contenedor e insertar nuevo SVG
  contenedor.innerHTML = "";
  contenedor.appendChild(svg);
  console.log(
    `✅ Plano SVG para ${roomId} generado en ${divId} usando datos consolidados.`
  );
}

function asignarASuperficie(codigo, color, event) {
  // Si ya estábamos asignando otro producto, cancelar la asignación anterior
  if (window.productoEnAsignacion) {
    cancelarAsignacion();
  }

  window.productoEnAsignacion = { codigo: codigo, color: color };
  window.botonOrigenAsignacion = event.target; // Guardar referencia al botón

  console.log(
    `Listo para asignar producto ${codigo} (Color: ${color}). Haz clic en una pared o suelo del plano correspondiente.`
  );

  // Feedback visual: Cambiar cursor en TODOS los contenedores de plano
  document.querySelectorAll(".plano-estancia").forEach((cont) => {
    cont.style.cursor = "crosshair";
    cont.classList.add("modo-asignacion"); // Añadir clase para posible resaltado CSS
  });

  // Opcional: Resaltar el producto que se está asignando
  event.target.closest(".cromo-producto")?.classList.add("asignando-ahora");

  // Opcional: Añadir listener para cancelar con clic fuera del SVG? Más complejo.
}

// --- 4. Nueva Función: `cancelarAsignacion` ---

function cancelarAsignacion() {
  if (!window.productoEnAsignacion) return; // No hay nada que cancelar

  console.log("Asignación cancelada para", window.productoEnAsignacion.codigo);
  // Quitar resaltado del producto
  const cromoAsignando = document.querySelector(
    ".cromo-producto.asignando-ahora"
  );
  if (cromoAsignando) cromoAsignando.classList.remove("asignando-ahora");

  window.productoEnAsignacion = null;
  window.botonOrigenAsignacion = null;

  // Restaurar cursor en todos los planos
  document.querySelectorAll(".plano-estancia").forEach((cont) => {
    cont.style.cursor = "default";
    cont.classList.remove("modo-asignacion");
  });
}

// Listener para cancelar con tecla ESC
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && window.productoEnAsignacion) {
    cancelarAsignacion();
  }
});

// --- 5. Nueva Función: `realizarAsignacion` (Llamada por clicks en SVG) ---

// --- DENTRO de generarPlanoEstancia.js ---

async function realizarAsignacion(
  tipoSuperficie,
  idSuperficie,
  elementoClicado
) {
  // --- Obtener datos esenciales ---
  const expedienteActual = sessionStorage.getItem("expedienteSeleccionado");
  if (
    !window.productoEnAsignacion ||
    !window.botonOrigenAsignacion ||
    !expedienteActual
  ) {
    console.error(
      "Estado inválido (falta producto, botón o expediente).",
      window.productoEnAsignacion,
      window.botonOrigenAsignacion,
      expedienteActual
    );
    cancelarAsignacion(); // Limpia estado (productoEnAsignacion, etc.)
    return;
  }

  const { codigo: codigoProducto, color } = window.productoEnAsignacion;
  const botonOriginal = window.botonOrigenAsignacion;

  const svgElement = elementoClicado.closest("svg[data-room-id]");
  if (!svgElement) {
    console.error("No se pudo encontrar el SVG padre.");
    cancelarAsignacion();
    return;
  }
  const roomId = svgElement.getAttribute("data-room-id");

  // --- Obtener datos geométricos necesarios para el NUEVO detalle ---
  // (Estas funciones DEBEN estar implementadas y funcionar correctamente)
  const alturaDefault = getRoomHeight(roomId) || 2.5; // Obtener altura (o fallback)
  const longitudObtenida = getSegmentLength(idSuperficie, roomId) || 0; // Obtener longitud (o fallback)

  console.log(
    `Asignando ${codigoProducto} a ${idSuperficie} (${tipoSuperficie}) en ${roomId} [Exp: ${expedienteActual}]`
  );
  console.log(
    ` - Altura default: ${alturaDefault}, Longitud superficie: ${longitudObtenida}`
  );

  // Mostrar feedback visual inmediato (opcional)
  if (elementoClicado) elementoClicado.style.opacity = "0.5"; // Atenuar pared/suelo clicado

  // --- Preparar datos para guardar el NUEVO detalle por PRIMERA VEZ ---
  const detalleDataInicial = {
    expediente: expedienteActual,
    estancia: roomId,
    codigoProducto: codigoProducto,
    idSuperficie: idSuperficie,
    cotaInferior: 0, // Default inicial
    cotaSuperior: alturaDefault, // Default inicial
    longitudSuperficie: +longitudObtenida.toFixed(4), // Guardar longitud obtenida
    huecosJSON: [], // Sin huecos inicialmente (se guardará como '[]')
    // cantidadCalculadaM2 se calcula en el backend
  };

  // --- LLAMAR A LA FUNCIÓN BACKEND CORRECTA ---
  google.script.run
    .withSuccessHandler(function (respuestaBackend) {
      console.log("Respuesta de guardarDetalleSuperficie:", respuestaBackend);
      if (elementoClicado) elementoClicado.style.opacity = "1"; // Restaurar opacidad

      if (respuestaBackend && respuestaBackend.status === "success") {
        // --- ÉXITO AL GUARDAR ---

        // 1. Dibujar Indicador Visual (usando la función ya modificada con offset)
        let elementoVisualAsignacion;
        if (tipoSuperficie === "wall") {
          const lineaOriginal = svgElement.querySelector(
            `line.pared[data-wall-id="${idSuperficie}"]`
          );
          if (lineaOriginal) {
            elementoVisualAsignacion = dibujarIndicadorPared(
              lineaOriginal,
              codigoProducto,
              idSuperficie,
              color
            );
          } else
            console.error(
              "No se encontró línea original para dibujar indicador pared",
              idSuperficie
            );
        } else {
          // floor
          const poligonoOriginal = svgElement.querySelector("polygon.suelo");
          if (poligonoOriginal) {
            elementoVisualAsignacion = dibujarIndicadorSuelo(
              poligonoOriginal,
              codigoProducto,
              color
            );
          } else
            console.error(
              "No se encontró polígono original para dibujar indicador suelo"
            );
        }

        // 2. Crear el Mini-Formulario UI (¡Este es el paso que falta!)
        if (elementoVisualAsignacion) {
          // --- !! PASO SIGUIENTE: IMPLEMENTAR ESTO !! ---
          // Necesitamos encontrar el contenedor correcto bajo el cromo del producto
          const contenedorFormularios = findMiniFormContainer(
            roomId,
            codigoProducto
          ); // NECESITAMOS ESTA FUNCIÓN
          if (contenedorFormularios) {
            // --- INICIO: Buscar Datos Estáticos para el Formulario ---
            const estanciaDataJson =
              window.datosExpediente?.estancias?.[roomId];
            let datosEstaticosParaForm = null;
            const esSuelo = idSuperficie === "floor";

            if (estanciaDataJson) {
              if (esSuelo) {
                datosEstaticosParaForm = {
                  areaNeta: estanciaDataJson.areaOBJ_m2 || 0, // Área del suelo
                  alturaTecho: estanciaDataJson.alturaTecho_m || 0,
                  longitudOriginal_m: 0, // Longitud no aplica al suelo
                };
              } else {
                // Es pared
                const paredDataJson =
                  estanciaDataJson.geometriaPlanoNormalizada?.paredes?.find(
                    (p) => p.wallId_OBJ === idSuperficie
                  );
                if (paredDataJson) {
                  datosEstaticosParaForm = {
                    areaNeta: paredDataJson.areaNetaCara_m2 || 0, // Área neta de la pared
                    alturaTecho: estanciaDataJson.alturaTecho_m || 0,
                    longitudOriginal_m: paredDataJson.longitudOriginal_m || 0, // Longitud de la pared
                  };
                }
              }
            }

            if (!datosEstaticosParaForm) {
              console.error(
                `Error crítico: No se encontraron datos estáticos para ${idSuperficie} en ${roomId}. No se puede crear mini-form.`
              );
              // Podríamos mostrar un alert aquí o simplemente no crear el form
            } else {
              // --- FIN: Buscar Datos Estáticos ---

              // Crear objeto con datos iniciales/devueltos por backend
              const datosParaForm = {
                idDetalle:
                  respuestaBackend.idDetalle ||
                  `new-<span class="math-inline">\{idSuperficie\}\-</span>{Date.now()}`,
                idSuperficie: idSuperficie,
                cotaInferior: 0, // Default para nuevo
                cotaSuperior: datosEstaticosParaForm.alturaTecho, // Default para nuevo
                huecosManuales: [], // Vacío para nuevo (solo aplica a suelo)
                cantidadCalculadaM2: respuestaBackend.cantidadCalculada, // Usar cantidad devuelta por backend
              };

              // --- LLAMADA MODIFICADA: Pasar datosEstaticosParaForm ---
              const miniFormElement = crearMiniFormularioSuperficie(
                datosParaForm, // Datos dinámicos/iniciales
                datosEstaticosParaForm, // Datos estáticos del JSON
                contenedorFormularios,
                roomId,
                codigoProducto
              );
              // --- FIN LLAMADA MODIFICADA ---
              // --- FIN USO DATOS BACKEND ---
              if (miniFormElement) {
                console.log(`Mini-form ${miniFormElement.id} creado.`);
                // Enlazar el ID del indicador visual al dataset del formulario
                miniFormElement.dataset.visualElementId =
                  elementoVisualAsignacion.id;
                console.log(
                  ` - Enlazado a visualElementId: ${elementoVisualAsignacion.id}`
                );

                // Adjuntar Listeners (Paso futuro)
                attachListenersToMiniForm(miniFormElement.id);

                // Actualiza el display de cantidad total del producto AHORA
                updateTotalQuantityDisplay(codigoProducto);

                // Añadir listener al elemento visual para que pueda borrar usando el ID del form
                // (Asegurarse que handleDeleteSurfaceAssignment usa el formId)
                elementoVisualAsignacion.addEventListener("click", (event) => {
                  event.stopPropagation();
                  console.log(
                    `Clic en indicador visual ${elementoVisualAsignacion.id}, llamando a borrar form ${miniFormElement.id}`
                  );
                  handleDeleteSurfaceAssignment(miniFormElement.id); // Llamar con el ID del FORM
                });
                elementoVisualAsignacion.style.cursor = "pointer";
              } else {
                console.error("Falló la creación del elemento mini-form.");
                // Si falla la creación del form, ¿deberíamos borrar el indicador visual que acabamos de crear?
                // elementoVisualAsignacion.remove(); // Opcional: limpiar indicador si form falla
              }
              // --- FIN MOVIDO AQUÍ ---
            }
          } else {
            console.error(
              `No se encontró el contenedor para mini-forms de ${codigoProducto} en ${roomId}`
            );
          }
          // --- FIN PASO SIGUIENTE ---

          // Añadir listener al elemento visual para eliminar (si se creó bien)
          elementoVisualAsignacion.addEventListener("click", (event) => {
            event.stopPropagation();
            handleDeleteSurfaceAssignment(elementoVisualAsignacion.id); // Asume que el ID se puso bien en dibujarIndicador...
          });
          elementoVisualAsignacion.style.cursor = "pointer";
        } else {
          console.error(
            "No se pudo dibujar el indicador visual, no se creará mini-form."
          );
        }

        // 3. Actualizar Botón Original (si no se ha modificado ya por otra asignación)
        /*if (botonOriginal && botonOriginal.classList.contains('asignar')) { // Solo cambiar si AÚN es "Asignar"
                   botonOriginal.textContent = "Eliminar asignación"; // OJO: Este botón ahora debería DESCARTAR, no eliminar detalles? Revisar lógica de botones
                   botonOriginal.classList.remove("asignar");
                   botonOriginal.classList.add("eliminar"); // ¿O clase 'descartar'?
                   // El onclick debería ser para descartar el producto, no para eliminar superficie
                   // botonOriginal.onclick = () => descartarProducto(codigoProducto, roomId); // Revisar si esto es correcto
                   console.warn("Lógica del botón principal 'Eliminar asignación' necesita revisión para nueva funcionalidad.");
              }*/

        // 4. Actualizar Cantidad Total (Paso futuro)
        // updateTotalQuantityDisplay(expedienteActual, roomId, codigoProducto);
      } else {
        // El backend devolvió un error controlado
        console.error(
          "Error guardando detalle superficie:",
          respuestaBackend?.message || "Error desconocido"
        );
        alert(
          "Error al guardar la asignación de superficie: " +
            (respuestaBackend?.message || "Error desconocido")
        );
      }

      // Limpiar estado de asignación independientemente del éxito del UI
      cancelarAsignacion();
    })
    .withFailureHandler((error) => {
      // Error en la llamada google.script.run en sí
      if (elementoClicado) elementoClicado.style.opacity = "1"; // Restaurar opacidad
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
  const botonProducto = document.querySelector(
    `button[data-codigo="${codigoProducto}"]`
  );
  if (!botonProducto) {
    console.error(
      `findMiniFormContainer: No se encontró el botón para ${codigoProducto}`
    );
    return null;
  }
  // 2. Subir al contenedor del tipo de producto (<details class="bloque-tipo">)
  const cromoElement = botonProducto.closest(".cromo-producto");
  if (!cromoElement) {
    console.error(
      `findMiniFormContainer: No se encontró el <details> padre (.bloque-tipo) para ${codigoProducto}`
    );
    return null;
  }
  // 3. Buscar DENTRO de ese <details> el div contenedor específico
  const selector = `.mini-forms-container[data-codigo-producto="${codigoProducto}"]`;
  const contenedor = cromoElement.querySelector(selector);

  if (!contenedor) {
    // Este log es útil si el contenedor no se creó bien en procesarAsignaciones
    console.error(
      `findMiniFormContainer: Contenedor no encontrado con selector: ${selector} DENTRO del detail`
    );
  }
  return contenedor || null; // Devuelve el contenedor o null
}

/**
 * Añade una nueva fila de inputs para un hueco en el mini-form especificado.
 * @param {HTMLElement} addButton - El botón "+" que fue clickeado.
 * @param {string} formId - El ID del mini-form padre.
 */
// --- DENTRO de generarPlanoEstancia.js ---

/**
 * Añade una nueva fila de inputs para un hueco manual (Largo x Ancho)
 * en el mini-form de un SUELO.
 * @param {HTMLElement} addButton - El botón "+" que fue clickeado (se recibe pero no se usa actualmente).
 * @param {string} formId - El ID del mini-form padre (`#miniform-roomId-codigoProd-floor...`).
 */
function addHueco(addButton, formId) {
  const divForm = document.getElementById(formId);
  // Doble verificación: ¿existe el form y es realmente un form de suelo?
  if (!divForm || divForm.dataset.idSuperficie !== "floor") {
    console.error(
      `addHueco: El form ${formId} no existe o no es de tipo 'floor'.`
    );
    return;
  }

  const huecosContainer = divForm.querySelector(".huecos-container");
  if (!huecosContainer) {
    console.error(
      `addHueco: No se encontró .huecos-container dentro de: ${formId}`
    );
    return;
  }

  // Determinar el índice del nuevo hueco
  const existingHuecos = huecosContainer.querySelectorAll(".hueco-row");
  const newIndex = existingHuecos.length;
  const huecoRowId = `${formId}-hueco-${newIndex}`; // ID único para la nueva fila

  // Crear el elemento div para la nueva fila
  const newRow = document.createElement("div");
  newRow.className = "hueco-row"; // Clase para estilos
  newRow.id = huecoRowId; // Asignar ID
  newRow.dataset.huecoIndex = newIndex; // Guardar índice (puede ser útil)

  // Generar el HTML interno con "Largo" y "Ancho"
  newRow.innerHTML = `
      <label>H${newIndex + 1}:</label>
      Largo: <input type="number" class="hueco-input" data-prop="largo" step="0.01" min="0" value="" placeholder="Largo (m)">
      &times; Ancho: <input type="number" class="hueco-input" data-prop="ancho" step="0.01" min="0" value="" placeholder="Ancho (m)">
      <button type="button" class="remove-hueco-btn" title="Eliminar Hueco" onclick="removeHueco('${huecoRowId}', '${formId}')">&times;</button>
  `;

  // Añadir la nueva fila al contenedor
  huecosContainer.appendChild(newRow);
  console.log(`Fila de hueco ${huecoRowId} añadida a ${formId}.`);

  // Adjuntar los listeners de input/change a los NUEVOS inputs
  // para que también disparen el recálculo y guardado automático (debounced)
  const newInputs = newRow.querySelectorAll(".hueco-input");
  newInputs.forEach((input) => {
    input.dataset.formId = formId; // Asociar al form padre para el handler
    input.addEventListener("input", handleMiniFormInputChange);
    input.addEventListener("change", handleMiniFormInputChange);
    // No marcamos listenerAttached aquí, asumimos que esta fila es nueva
  });

  // Opcional: Poner el foco en el primer input nuevo
  newRow.querySelector('input[data-prop="largo"]')?.focus();

  // Opcional: Recalcular inmediatamente al añadir la fila (aunque los valores sean 0)
  // recalculateAndUpdateMiniForm(formId, false); // Sin debounce
}

// --- NECESITARÁS ESTA FUNCIÓN DEBNounce (o una similar) ---
// Colócala en algún lugar accesible de tu script
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Definir la versión debounced de la llamada al backend ANTES de usarla
const guardarDetalleDebounced = debounce(function (detalleParaGuardar) {
  console.log("Llamando a guardar (DEBOUNCED):", detalleParaGuardar);
  google.script.run
    .withSuccessHandler((respuesta) => {
      console.log("Respuesta guardarDetalleSuperficie (debounced):", respuesta);
      if (respuesta && respuesta.status === "success") {
        // OK - Actualizar cantidad total del producto después de guardar
        updateTotalQuantityDisplay(detalleParaGuardar.codigoProducto);
        // Podríamos actualizar el idDetalle si era nuevo? El backend no lo devuelve ahora.
      } else {
        // Mostrar error si el guardado falla
        alert(
          "Error al guardar cambios en detalle de superficie: " +
            (respuesta?.message || "Error desconocido")
        );
        // Podríamos intentar revertir la UI? O marcarla como no guardada?
      }
    })
    .withFailureHandler(handleScriptError) // Usar manejador genérico
    .guardarDetalleSuperficie(detalleParaGuardar);
}, 1200); // Debounce de 1.2 segundos (ajusta si quieres)

/**
 * Lee valores actuales de un mini-form, recalcula cantidad neta,
 * actualiza el display del mini-form, y lanza el guardado debounced.
 * @param {string} formId - El ID del mini-form a procesar.
 * @param {boolean} [applyDebounce=true] - Indica si se debe usar debounce.
 */
function recalculateAndUpdateMiniForm(formId, applyDebounce = true) {
  const divForm = document.getElementById(formId);
  if (!divForm) {
    console.error(`recalculateAndUpdate: No se encontró form ${formId}`);
    return;
  }
  // console.log(`Recalculando para ${formId}...`); // Log opcional

  // --- Obtener Datos Clave y Estáticos del Formulario (desde dataset) ---
  const idSuperficie = divForm.dataset.idSuperficie;
  const esSuelo = idSuperficie === "floor";
  const codigoProducto = divForm.dataset.codigoProducto;
  const roomId = divForm.dataset.roomId;
  const expediente = sessionStorage.getItem("expedienteSeleccionado");
  const idDetalle = divForm.dataset.idDetalle; // ID existente o el temporal 'new-...'

  // Datos estáticos necesarios para el cálculo
  const datosEstaticos = {
    areaNeta: parseFloat(divForm.dataset.areaNeta) || 0,
    alturaTecho: parseFloat(divForm.dataset.alturaTecho) || 0,
    // Longitud no es necesaria para calcular cantidad neta
  };

  // --- Leer Datos Dinámicos del Formulario ---
  let cotaInf = 0,
    cotaSup = datosEstaticos.alturaTecho,
    huecosArray = [];
  // Objeto base para guardar, solo con claves identificativas
  let detalleParaGuardar = {
    expediente,
    estancia: roomId,
    codigoProducto,
    idSuperficie,
    idDetalle,
  };

  if (esSuelo) {
    // --- Lógica para Suelo ---
    huecosArray = []; // Resetear array de huecos
    divForm.querySelectorAll(".hueco-row").forEach((row) => {
      const largoInput = row.querySelector('.hueco-input[data-prop="largo"]');
      const anchoInput = row.querySelector('.hueco-input[data-prop="ancho"]'); // Usar ancho
      const largo = parseFloat(largoInput?.value) || 0;
      const ancho = parseFloat(anchoInput?.value) || 0;
      if (largo > 0 && ancho > 0) {
        // Guardar con precisión y asegurar que son números
        huecosArray.push({
          largo: +largo.toFixed(3),
          ancho: +ancho.toFixed(3),
        });
      }
    });
    // Añadir SOLO huecosJSON a los datos a guardar
    detalleParaGuardar.huecosJSON = huecosArray; // Guardar array de objetos
  } else {
    // --- Lógica para Pared ---
    const cotaInfInput = divForm.querySelector(
      '.cota-input[data-prop="cotaInferior"]'
    );
    const cotaSupInput = divForm.querySelector(
      '.cota-input[data-prop="cotaSuperior"]'
    );
    cotaInf = parseFloat(cotaInfInput?.value) || 0;
    // Leer cotaSup, si es inválida o menor que cotaInf, usar alturaTecho
    let cotaSupTemp = parseFloat(cotaSupInput?.value);
    cotaSup =
      !isNaN(cotaSupTemp) && cotaSupTemp >= cotaInf
        ? cotaSupTemp
        : datosEstaticos.alturaTecho;
    // Añadir SOLO cotas a los datos a guardar
    detalleParaGuardar.cotaInferior = +cotaInf.toFixed(3); // Guardar número con precisión
    detalleParaGuardar.cotaSuperior = +cotaSup.toFixed(3);
    detalleParaGuardar.huecosJSON = []; // Enviar array vacío para paredes
  }

  // --- Calcular Nueva Cantidad (usando la función correcta) ---
  const nuevaCantidad = calcularCantidadNetaDetalle(
    esSuelo,
    datosEstaticos,
    cotaInf,
    cotaSup,
    huecosArray
  );

  // --- Actualizar display de cantidad del mini-form ---
  const displayCantidad = divForm.querySelector(".cantidad-calculada-display");
  if (displayCantidad) {
    displayCantidad.textContent = nuevaCantidad.toFixed(3);
  } else {
    console.warn("No se encontró .cantidad-calculada-display en", formId);
  }

  // --- Llamar a guardar en backend ---
  // console.log("Datos recalculados listos para guardar:", detalleParaGuardar); // Log opcional
  // Llamar a la función debounced o directa según el contexto
  if (applyDebounce) {
    guardarDetalleDebounced(detalleParaGuardar); // Llama a la versión debounced
  } else {
    // Si es acción directa (borrar hueco), llamamos a la versión debounced igualmente
    // para asegurar que solo la última versión de los datos se guarda si hay cambios rápidos.
    guardarDetalleDebounced(detalleParaGuardar);
  }
}

/**
 * Handler para eventos 'input' o 'change' en los inputs del mini-form.
 * Llama a la función de recálculo y guardado, aplicando debounce para 'input'.
 * @param {Event} event - El objeto evento.
 */
function handleMiniFormInputChange(event) {
  const input = event.target;
  const formId = input.closest(".mini-form-superficie")?.id;
  if (!formId) {
    console.error(
      "handleMiniFormInputChange: No se pudo determinar formId desde",
      input
    );
    return;
  }
  // Aplicar debounce solo si el evento es 'input' (mientras se escribe)
  // Si es 'change' (al perder foco), aplicamos debounce también para simplificar
  // y evitar llamadas duplicadas si 'input' ya lo lanzó.
  const applyDebounce = true; // Siempre usar debounce simplifica la lógica
  // const applyDebounce = (event.type === 'input'); // Alternativa: solo debounce en input
  recalculateAndUpdateMiniForm(formId, applyDebounce);
}

/**
 * Elimina una fila de hueco del DOM y lanza el recálculo/guardado.
 * @param {string} huecoRowId - El ID del div.hueco-row a eliminar.
 * @param {string} formId - El ID del mini-form padre.
 */
function removeHueco(huecoRowId, formId) {
  const huecoRow = document.getElementById(huecoRowId);
  if (huecoRow) {
    huecoRow.remove();
    // Llamar a recalcular y guardar SIN debounce explícito (la función lo manejará)
    // porque es una acción directa del usuario.
    recalculateAndUpdateMiniForm(formId, false);
  }
}

/**
 * Adjunta los event listeners necesarios a los inputs interactivos de un mini-form.
 * @param {string} formId - El ID del elemento div.mini-form-superficie.
 */
function attachListenersToMiniForm(formId) {
  const divForm = document.getElementById(formId);
  if (!divForm) {
    console.error(`attachListeners: No se encontró form ${formId}`);
    return;
  }
  const idSuperficie = divForm.dataset.idSuperficie;
  const esSuelo = idSuperficie === "floor";

  let inputsToListen = [];
  if (esSuelo) {
    // Solo buscar inputs de HUECOS
    inputsToListen = divForm.querySelectorAll(".hueco-input");
    console.log(
      `Adjuntando listeners a ${inputsToListen.length} inputs de hueco para ${formId}`
    );
  } else {
    // Es Pared
    // Solo buscar inputs de COTAS
    inputsToListen = divForm.querySelectorAll(".cota-input");
    console.log(
      `Adjuntando listeners a ${inputsToListen.length} inputs de cota para ${formId}`
    );
  }

  inputsToListen.forEach((input) => {
    // Comprobar si ya tiene listener para evitar duplicados
    if (!input.dataset.listenerAttached) {
      input.dataset.formId = formId; // Guardar ID para el handler
      // Adjuntar listeners para 'input' (mientras escribe) y 'change' (al perder foco)
      input.addEventListener("input", handleMiniFormInputChange);
      input.addEventListener("change", handleMiniFormInputChange);
      input.dataset.listenerAttached = "true"; // Marcar como adjuntado
    }
  });
}

/**
 * Recalcula la suma de m² de todos los mini-forms para un producto
 * y actualiza el display de cantidad total principal en el cromo.
 * También llama a recalcularDiferencia global.
 * @param {string} codigoProducto - El código del producto a actualizar.
 */
function updateTotalQuantityDisplay(codigoProducto) {
  console.log(`Actualizando cantidad total para ${codigoProducto}`);
  let sumaTotal = 0;

  // Encontrar TODOS los mini-forms para este producto
  const miniForms = document.querySelectorAll(
    `.mini-form-superficie[data-codigo-producto="${codigoProducto}"]`
  );

  miniForms.forEach((form) => {
    const displayCantidad = form.querySelector(".cantidad-calculada-display");
    // Asegurarse de que el texto se puede convertir a número
    const cantidad = parseFloat(displayCantidad?.textContent) || 0;
    sumaTotal += cantidad;
  });

  // Encontrar el display principal (el input readonly que creamos)
  const displayTotal = document.getElementById(
    `cantidad-total-${codigoProducto}`
  );
  if (displayTotal) {
    console.log(
      ` - Suma total para ${codigoProducto}: ${sumaTotal.toFixed(3)} m²`
    );
    displayTotal.value = sumaTotal.toFixed(3); // Actualizar valor del input readonly

    // --- Disparar evento 'input' para que otras funciones reaccionen si es necesario ---
    // O llamar directamente a la función que recalcula el presupuesto general
    if (typeof recalcularDiferencia === "function") {
      console.log(
        "... Llamando a recalcularDiferencia después de actualizar total."
      );
      recalcularDiferencia();
    }
  } else {
    console.warn(
      `No se encontró el display de cantidad total para ${codigoProducto} (ID: cantidad-total-${codigoProducto})`
    );
  }
}

// --- NECESITARÁS EL HANDLER PARA BORRAR SUPERFICIE (Implementación básica) ---
function handleDeleteSurfaceAssignment(formId) {
  const divForm = document.getElementById(formId);
  if (!divForm) return;

  const expediente = sessionStorage.getItem("expedienteSeleccionado");
  const estancia = divForm.dataset.roomId;
  const codigoProducto = divForm.dataset.codigoProducto;
  const idSuperficie = divForm.dataset.idSuperficie;
  const visualId = divForm.dataset.visualElementId;

  if (!expediente || !estancia || !codigoProducto || !idSuperficie) {
    alert(
      "Error: No se pueden identificar los datos para eliminar la superficie."
    );
    return;
  }

  // Confirmación (Opcional pero MUY recomendable)
  if (
    !confirm(
      `¿Seguro que quieres eliminar la asignación del producto ${codigoProducto} a la superficie ${idSuperficie}? Se perderán las cotas y huecos guardados.`
    )
  ) {
    return;
  }

  console.log(
    `Solicitando eliminar detalle: ${expediente}, ${estancia}, ${codigoProducto}, ${idSuperficie}`
  );

  const detallePK = { expediente, estancia, codigoProducto, idSuperficie };

  // Mostrar feedback
  divForm.style.opacity = "0.5";

  google.script.run
    .withSuccessHandler((respuesta) => {
      console.log("Respuesta de eliminarDetalleSuperficie:", respuesta);
      if (respuesta && respuesta.status === "success") {
        // Eliminar elemento visual del SVG
        // --- CORREGIDO: Buscar por ID único ---
        const visualElement = document.getElementById(visualId); // Buscar por ID
        if (visualElement) {
          console.log("Eliminando indicador visual:", visualId);
          visualElement.remove();
        } else {
          console.warn(
            `No se encontró el indicador visual para eliminar con ID: ${visualId}`
          ); // Log más específico
        }
        // --- FIN CORRECCIÓN ---
        // Eliminar el mini-form del DOM
        divForm.remove();
        // TODO: Actualizar cantidad total
        updateTotalQuantityDisplay(codigoProducto);
        mostrarNotificacion("Asignación de superficie eliminada.");
      } else {
        alert(
          "Error al eliminar la asignación de superficie: " +
            (respuesta?.message || "Error desconocido")
        );
        divForm.style.opacity = "1"; // Restaurar opacidad si falla
      }
    })
    .withFailureHandler((error) => {
      handleScriptError(error); // Usar manejador genérico
      divForm.style.opacity = "1"; // Restaurar opacidad si falla
    })
    .eliminarDetalleSuperficie(detallePK); // Llamar a la función backend correcta
}

// --- NECESITARÁS LA FUNCIÓN attachListenersToMiniForm (Aún por implementar) ---
// function attachListenersToMiniForm(formId) { ... }

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
  const svgElement = lineaOriginal.closest("svg[data-room-id]"); // Encuentra el SVG padre
  if (!svgElement) {
    console.error(
      "dibujarIndicadorPared: No se encontró SVG padre para",
      lineaOriginal
    );
    return null;
  }
  const sueloPoly = svgElement.querySelector('polygon.suelo'); // Buscar el polígono del suelo por su clase
  const sueloIndicador = svgElement.querySelector('polygon.suelo-asignado');
  const svgNS = "http://www.w3.org/2000/svg";

  // --- DATOS NECESARIOS ---
  const roomId = svgElement.getAttribute("data-room-id");
  const estanciaData = window.datosExpediente?.estancias?.[roomId];
  const sueloPoints = estanciaData?.geometriaPlanoNormalizada?.suelo; // Puntos normalizados del suelo

  if (!Array.isArray(sueloPoints) || sueloPoints.length < 3) {
      console.error(`No se encontraron puntos de suelo válidos para ${roomId} para calcular centroide.`);
        // Podríamos usar 250,250 como fallback, pero es mejor fallar si faltan datos clave.
      return null;
  }

  // --- NUEVO: Lógica de Offset ---
  // Buscar indicadores existentes para esta MISMA pared
  const selector = `.indicador-asignacion[data-asignacion-tipo="wall"][data-asignacion-id="${wallId}"]`;
  const existingIndicators = svgElement.querySelectorAll(selector);
  const offsetIndex = existingIndicators.length; // 0 para el primero, 1 para el segundo, etc.

  const baseOffset = 10; // Desplazamiento base en píxeles SVG
  const stepOffset = 8; // Desplazamiento adicional por cada indicador existente
  const finalOffset = baseOffset + offsetIndex * stepOffset;
  console.log(
    `Dibujando indicador para ${wallId} (Producto ${codigo}). Índice: ${offsetIndex}, Offset: ${finalOffset}`
  );
  // --- FIN Lógica de Offset ---

  const x1 = parseFloat(lineaOriginal.getAttribute("x1"));
  const y1 = parseFloat(lineaOriginal.getAttribute("y1"));
  const x2 = parseFloat(lineaOriginal.getAttribute("x2"));
  const y2 = parseFloat(lineaOriginal.getAttribute("y2"));

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) return null;

  // --- Calcular Normal hacia Centroide ---
  // 1. Calcular normal perpendicular inicial (unitario)
  let nx = -dy / len;
  let ny = dx / len;
  // 2. Calcular punto medio de la pared
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  // 3. Calcular centroide del polígono del suelo (usando puntos normalizados)
  const centroid = calcularCentroide(sueloPoints); // Necesita helper calcularCentroide
  // 4. Calcular vector del punto medio al centroide
  const vecToCenter = { x: centroid.x - midX, y: centroid.y - midY };
  // 5. Comprobar si la normal apunta hacia el centroide (producto escalar > 0)
  const dotProduct = nx * vecToCenter.x + ny * vecToCenter.y;
    // Logger.log(`Normal check for <span class="math-inline">\{wallId\}\: dot\=</span>{dotProduct.toFixed(2)}`); // Debug log
  if (dotProduct < 0) { // Si el producto escalar es negativo, la normal apunta hacia afuera. Invertirla.
        // Logger.log(` -> Flipping normal for ${wallId}`);
      nx = -nx;
      ny = -ny;
  }
  // --- Fin Calcular Normal ---

  const newLine = document.createElementNS(svgNS, "line");
  // Aplicar el offset FINAL calculado
  newLine.setAttribute("x1", (x1 + finalOffset * nx).toFixed(2));
  newLine.setAttribute("y1", (y1 + finalOffset * ny).toFixed(2));
  newLine.setAttribute("x2", (x2 + finalOffset * nx).toFixed(2));
  newLine.setAttribute("y2", (y2 + finalOffset * ny).toFixed(2));

  newLine.setAttribute("stroke", color);
  newLine.setAttribute("stroke-width", "8");
  newLine.setAttribute("stroke-linecap", "square");
  newLine.setAttribute("class", "indicador-asignacion pared-asignada");

  // Datos para identificar esta asignación específica
  newLine.setAttribute("data-asignacion-codigo", codigo);
  newLine.setAttribute("data-asignacion-tipo", "wall");
  newLine.setAttribute("data-asignacion-id", wallId);
  // Generamos un ID único para poder referenciarlo fácilmente (ej, para borrarlo)
  const visualId = `asignacion-${codigo}-${wallId}-${Date.now()}`;
  newLine.setAttribute("id", visualId);

  // --- INSERCIÓN MODIFICADA ---
  try {
    // Insertar la newLine ANTES del elemento que sigue al polígono del suelo.
    // Como las paredes se dibujan después del suelo, sueloPoly.nextSibling será la primera pared.
    // Si no hay paredes (raro), nextSibling es null y insertBefore lo añade al final (después del suelo).
    if (sueloIndicador){
      svgElement.insertBefore(newLine, sueloIndicador.nextSibling);
    } else if (sueloPoly) {
      svgElement.insertBefore(newLine, sueloPoly.nextSibling);
    }
    console.log(`Indicador ${visualId} insertado después del suelo.`);
  } catch (e) {
    console.error(
      `Error insertando indicador ${visualId} usando insertBefore:`,
      e
    );
    // Fallback (menos ideal para el orden): añadir al final
    try {
      svgElement.appendChild(newLine);
      console.warn(`Fallback: Indicador ${visualId} añadido al final del SVG.`);
    } catch (e2) {
      console.error(
        `Error incluso con appendChild para indicador ${visualId}:`,
        e2
      );
      return null; // Falló la inserción
    }
  }
  // --- FIN INSERCIÓN ---

  return newLine; // Devolver la línea creada
}

/**
 * Calcula el centroide del polígono a partir de sus vértices
 * @param {string} points 
 * @returns {JSON} punto del centroide de un polígono
 */

function calcularCentroide(points) {
  if (!points || points.length === 0) return { x: 250, y: 250 }; // Fallback to center
  let sumX = 0;
  let sumY = 0;
  points.forEach(p => {
      sumX += p.x;
      sumY += p.y;
  });
  return { x: sumX / points.length, y: sumY / points.length };
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
  const svgElement = poligonoOriginal.closest("svg[data-room-id]");
  if (!svgElement) {
    console.error(
      "dibujarIndicadorSuelo: No se encontró SVG padre para",
      poligonoOriginal
    );
    return null;
  }
  const svgNS = "http://www.w3.org/2000/svg";

  // --- Lógica de Opacidad (Alternativa a Offset para suelo) ---
  // Buscar indicadores de suelo existentes
  const selector = '.indicador-asignacion[data-asignacion-tipo="floor"]';
  const existingIndicators = svgElement.querySelectorAll(selector);
  const baseOpacity = 0.6;
  const opacityStep = 0.05; // Reducir opacidad ligeramente por cada capa
  const finalOpacity = Math.max(
    0.1,
    baseOpacity - existingIndicators.length * opacityStep
  ); // Evitar opacidad 0 o negativa
  console.log(
    `Dibujando indicador para suelo (Producto ${codigo}). Capa: ${existingIndicators.length}, Opacidad: ${finalOpacity}`
  );
  // --- Fin Lógica de Opacidad ---

  const newPolygon = document.createElementNS(svgNS, "polygon");
  newPolygon.setAttribute("points", poligonoOriginal.getAttribute("points"));

  newPolygon.setAttribute("fill", color);
  newPolygon.setAttribute("fill-opacity", finalOpacity.toFixed(2)); // Aplicar opacidad calculada
  newPolygon.setAttribute("stroke", "none"); // Sin borde para que no se acumulen
  newPolygon.setAttribute("class", "indicador-asignacion suelo-asignado");

  // Datos para identificar esta asignación específica
  newPolygon.setAttribute("data-asignacion-codigo", codigo);
  newPolygon.setAttribute("data-asignacion-tipo", "floor");
  newPolygon.setAttribute("data-asignacion-id", "floor"); // ID genérico para suelo
  // Generamos un ID único
  const visualId = `asignacion-${codigo}-floor-${Date.now()}`;
  newPolygon.setAttribute("id", visualId);

  // Insertar DESPUÉS del polígono original (o del último indicador de suelo)
  if (existingIndicators.length > 0) {
    existingIndicators[existingIndicators.length - 1].insertAdjacentElement(
      "afterend",
      newPolygon
    );
  } else {
    poligonoOriginal.insertAdjacentElement("afterend", newPolygon);
  }

  return newPolygon;
}

// --- DENTRO de generarPlanoEstancia.js ---

// EN: generarPlanoEstancia.js

/**
 * Calcula la cantidad neta para un detalle de superficie (MODO FINAL).
 * @param {boolean} esSuelo - True si es suelo, false si es pared.
 * @param {object} datosEstaticos - Contiene areaNeta y alturaTecho (ej: { areaNeta: 10.5, alturaTecho: 2.5 }).
 * @param {number} [cotaInf=0] - Cota inferior (relevante para paredes).
 * @param {number} [cotaSup=datosEstaticos.alturaTecho] - Cota superior (relevante para paredes, default a altura total).
 * @param {Array<object>} [huecosArray=[]] - Array de huecos [{largo, ancho}] (relevante para suelos).
 * @returns {number} La cantidad calculada en m², redondeada a 3 decimales.
 */
function calcularCantidadNetaDetalle(
  esSuelo,
  datosEstaticos,
  cotaInf = 0,
  cotaSup,
  huecosArray = []
) {
  const areaNeta = parseFloat(datosEstaticos?.areaNeta) || 0;
  // Usar alturaTecho de datosEstaticos, o 0 si no está (aunque debería)
  const alturaTecho = parseFloat(datosEstaticos?.alturaTecho) || 0;
  let cantidadCalculada = 0;

  if (esSuelo) {
    // Cálculo para SUELO: Área Neta Total - Suma Huecos Manuales
    let restaHuecos = 0;
    if (Array.isArray(huecosArray)) {
      huecosArray.forEach((h) => {
        const largo = parseFloat(h?.largo) || 0;
        const ancho = parseFloat(h?.ancho) || 0; // Usar ancho
        if (largo > 0 && ancho > 0) {
          restaHuecos += largo * ancho;
        }
      });
    }
    cantidadCalculada = Math.max(0, areaNeta - restaHuecos);
    // Logger.log(`Calc Suelo: AreaNeta=${areaNeta}, Resta=${restaHuecos} -> ${cantidadCalculada}`);
  } else {
    // Es PARED
    // Cálculo para PARED: Área Neta Total * Proporción Altura Aplicada
    const cotaInferiorNum = parseFloat(cotaInf) || 0;
    // Si cotaSup no es un número válido O es menor que cotaInf, usar alturaTotal como default
    let cotaSuperiorNum = parseFloat(cotaSup);
    if (isNaN(cotaSuperiorNum) || cotaSuperiorNum < cotaInferiorNum) {
      cotaSuperiorNum = alturaTecho;
    }

    if (alturaTecho > 0) {
      const alturaAplicada = Math.max(0, cotaSuperiorNum - cotaInferiorNum);
      const proporcionAltura = Math.min(1, alturaAplicada / alturaTecho); // Entre 0 y 1
      cantidadCalculada = areaNeta * proporcionAltura; // Área Neta * Proporción
      // Logger.log(`Calc Pared: AreaNeta=${areaNeta}, AlturaAplic=${alturaAplicada}, AlturaTotal=${alturaTecho}, Prop=${proporcionAltura} -> ${cantidadCalculada}`);
    } else {
      console.log(
        `WARN calcularCantidadNetaDetalle: Altura de techo es 0 para cálculo de pared.`
      );
      cantidadCalculada = 0;
    }
  }
  return +cantidadCalculada.toFixed(3); // Devolver número redondeado
}

/**
 * Crea y añade el HTML del mini-formulario para un detalle de superficie (VERSIÓN FINAL).
 * Muestra inputs de Cota para paredes, o inputs de Huecos (Largo/Ancho) para suelo.
 * Calcula y muestra la cantidad inicial correctamente según el tipo.
 * @param {object} detalleData - Objeto con datos guardados: { idDetalle?, idSuperficie, cotaInferior?, cotaSuperior?, huecosManuales?, cantidadCalculadaM2? }
 * @param {object} datosEstaticos - Objeto con datos del JSON: { longitudOriginal_m?, areaNetaCara_m2?, alturaTecho_m?, areaNetaSuelo_m2? }
 * @param {HTMLElement} contenedorDOM - El elemento HTML donde se añadirá este formulario.
 * @param {string} roomId - El ID de la habitación.
 * @param {string} codigoProducto - El código del producto asociado.
 * @returns {HTMLElement|null} El elemento div principal del formulario creado o null si hay error.
 */
function crearMiniFormularioSuperficie(
  detalleData,
  datosEstaticos,
  contenedorDOM,
  roomId,
  codigoProducto
) {
  // --- Log de Entradas (MUY IMPORTANTE) ---
  console.log(
    `DEBUG: CrearMiniForm - Inputs para ${
      detalleData?.idSuperficie || "N/A"
    } en ${roomId}`
  );
  // Usar JSON.stringify para ver bien los objetos anidados
  console.log(
    "  -> detalleData RECIBIDO:",
    JSON.stringify(detalleData || null, null, 2)
  );
  console.log(
    "  -> datosEstaticos RECIBIDO:",
    JSON.stringify(datosEstaticos || null, null, 2)
  );
  // --- Fin Log Entradas ---
  const idSuperficie = detalleData.idSuperficie;
  const esSuelo = idSuperficie === "floor";

  // Validaciones iniciales
  if (!idSuperficie) {
    console.error("Falta idSuperficie para crear mini-form.");
    return null;
  }
  if (!datosEstaticos) {
    console.error("Faltan datos estáticos para crear mini-form.");
    return null;
  }
  if (!contenedorDOM || !contenedorDOM.appendChild) {
    console.error("Contenedor DOM inválido:", contenedorDOM);
    return null;
  }

  // Extraer datos necesarios (con valores por defecto seguros)
  const idDetalle =
    detalleData.idDetalle || `new-${idSuperficie}-${Date.now()}`;
  const formId = `miniform-${roomId}-${codigoProducto}-${idSuperficie.replace(
    /[^a-zA-Z0-9]/g,
    ""
  )}`;

  // Datos estáticos específicos
  const alturaTecho = datosEstaticos.alturaTecho || 0;
  const areaNeta = esSuelo
    ? datosEstaticos.areaNeta || 0
    : datosEstaticos.areaNeta || 0;
  const longitud = esSuelo ? 0 : datosEstaticos.longitudOriginal_m || 0;

  // --- !! NUEVO LOG PARA VERIFICAR EXTRACCIÓN !! ---
  console.log(
    `DEBUG: CrearMiniForm - Valores EXTRAÍDOS: alturaTecho=${alturaTecho} (Tipo: ${typeof alturaTecho}), areaNeta=${areaNeta} (Tipo: ${typeof areaNeta}), longitud=${longitud} (Tipo: ${typeof longitud})`
  );
  // --- FIN NUEVO LOG ---

  // Datos dinámicos (del estado guardado)
  const cotaInf =
    detalleData.cotaInferior !== undefined ? detalleData.cotaInferior : 0; // Default 0 para paredes
  const cotaSup =
    detalleData.cotaSuperior !== undefined
      ? detalleData.cotaSuperior
      : alturaTecho; // Default altura techo para paredes
  const huecos = Array.isArray(detalleData.huecosManuales)
    ? detalleData.huecosManuales
    : []; // Para suelos

  // --- Log ANTES de Calcular ---
  console.log(
    `DEBUG: CrearMiniForm - Argumentos para calcularCantidadNetaDetalle:`
  );
  console.log(`    esSuelo: ${esSuelo}`);
  console.log(`    datosEstaticos (para calc):`, {
    areaNeta: areaNeta,
    alturaTecho: alturaTecho,
  }); // Pasar objeto
  console.log(`    cotaInf: ${cotaInf}`);
  console.log(`    cotaSup: ${cotaSup}`);
  console.log(`    huecosArray: ${JSON.stringify(huecos)}`);
  // --- Fin Log Args ---

  // --- Calcular Cantidad Inicial usando la función CORRECTA ---
  const cantidadInicial = calcularCantidadNetaDetalle(
    esSuelo,
    { areaNeta: areaNeta, alturaTecho: alturaTecho }, // Pasar datos estáticos necesarios
    cotaInf,
    cotaSup,
    huecos
  );
  // --- Fin Cálculo Inicial ---

  // --- Log DESPUÉS de Calcular ---
  console.log(
    `DEBUG: CrearMiniForm - cantidadInicial calculada: ${cantidadInicial}`
  );
  // --- Fin Log Result ---

  // Crear Contenedor y guardar Data Attributes
  const divForm = document.createElement("div");
  divForm.className = "mini-form-superficie";
  divForm.id = formId;
  divForm.dataset.idDetalle = idDetalle;
  divForm.dataset.idSuperficie = idSuperficie;
  divForm.dataset.codigoProducto = codigoProducto;
  divForm.dataset.roomId = roomId;
  // Guardar datos estáticos que se necesitarán para recalcular en el cliente
  divForm.dataset.areaNeta = areaNeta.toFixed(4);
  divForm.dataset.alturaTecho = alturaTecho.toFixed(4);
  divForm.dataset.longitud = longitud.toFixed(4); // Solo relevante para paredes (display)

  // --- Construir HTML Interno (Condicional) ---
  let formHTML = `
    <div class="mini-form-header">
      <strong>Superficie: ${esSuelo ? "SUELO" : idSuperficie}</strong>
      <!-- Botón de eliminación a la derecha -->
      <button
        type="button"
        class="delete-surface-btn"
        onclick="handleDeleteSurfaceAssignment('${divForm.id}')"
      >&times;</button>
    </div>
  `;

  if (esSuelo) {
    // — Campos para suelos (invariables salvo la eliminación de área neta) —
    formHTML += `
      <div class="mini-form-huecos">
        <strong class="huecos-titulo">Áreas a restar (manual):</strong>
        <div class="huecos-container">
          ${detalleData.huecosManuales
            .map(
              (hueco, i) => `
            <div class="hueco-row" id="${
              divForm.id
            }-hueco-${i}" data-hueco-index="${i}">
              <label>H${i + 1}:</label>
              Largo: <input type="number" class="hueco-input" data-prop="largo" value="${
                hueco.largo || ""
              }" placeholder="m">
              × Ancho: <input type="number" class="hueco-input" data-prop="ancho" value="${
                hueco.ancho || ""
              }" placeholder="m">
              <button type="button" class="remove-hueco-btn"
                      onclick="removeHueco('${divForm.id}-hueco-${i}','${
                divForm.id
              }')">&times;</button>
            </div>
          `
            )
            .join("")}
        </div>
        <button type="button" class="add-hueco-btn" onclick="addHueco(this,'${
          divForm.id
        }')">
          + Añadir área
        </button>
      </div>
    `;
  }
  // *En el caso de paredes*, ya no se genera ningún bloque de “cotas”

  // — Resultado y Cantidad (único dato relevante) —
  formHTML += `
    <div class="mini-form-resultado">
      <span>Cantidad (m²):</span>
      <span class="cantidad-calculada-display">${cantidadInicial.toFixed(
        3
      )}</span>
    </div>
  `;

  divForm.innerHTML = formHTML;
  contenedorDOM.appendChild(divForm);
  attachListenersToMiniForm(divForm.id);

  return divForm;
}

// --- FUNCIONES PLACEHOLDER (NECESITAN IMPLEMENTACIÓN) ---

function getRoomHeight(roomId) {
  // TODO: Implementar lógica para obtener la altura de window.geometriaPorRoom
  const roomData = window.datosExpediente?.estancias?.[roomId]; // Usar encadenamiento opcional por seguridad
  if (roomData && roomData.alturaTecho_m !== undefined) {
    return roomData.alturaTecho_m;
  }
  console.warn(
    `getRoomHeight: No se encontró altura para room ${roomId}. Usando fallback 2.5`
  );
  return 2.5; // Valor por defecto temporal
}

function getSegmentLength(idSuperficie, roomId) {
  // TODO: Implementar lógica para obtener la longitud de window.geometriaPorRoom
  if (idSuperficie === "floor") return 0; // Suelo no tiene longitud lineal definida así
  const roomData = window.datosExpediente?.estancias?.[roomId];
  const pared = roomData?.paredes?.find((p) => p.wallId_OBJ === idSuperficie);
  if (pared && pared.longitudOriginal_m !== undefined) {
    return pared.longitudOriginal_m;
  }
  console.warn(
    `getSegmentLength: No se encontró longitud para superficie ${idSuperficie} en room ${roomId}. Usando fallback 0`
  );
  return 0; // Valor por defecto temporal
}

// --- FIN FUNCIONES PLACEHOLDER ---

// --- 7. Nueva Función: `eliminarAsignacion` (Llamada por botón o click en indicador) ---

function eliminarAsignacion(
  codigo,
  tipoSuperficie,
  idSuperficie,
  roomId,
  visualElementId
) {
  console.log(
    `Solicitando eliminar asignación de ${codigo} de ${tipoSuperficie} ${idSuperficie} en ${roomId}`
  );

  const elementoVisual = document.getElementById(visualElementId);
  if (!elementoVisual) {
    console.warn(
      `No se encontró el elemento visual con ID: ${visualElementId} para eliminar.`
    );
    // Opcional: intentar restaurar el botón si no se encuentra el elemento visual?
    // restaurarBotonAsignar(codigo); // Necesitaría esta función auxiliar
    // return; // Salir si no encontramos qué eliminar visualmente
  }

  // Mostrar feedback (ej. atenuar) - Opcional
  if (elementoVisual) elementoVisual.style.opacity = "0.3";

  const datosParaEliminar = {
    expediente: window.expedienteActual,
    codigoProducto: codigo,
    estancia: roomId,
    superficie: idSuperficie,
  };

  google.script.run
    .withSuccessHandler((respuesta) => {
      console.log("Asignación eliminada/actualizada en Sheet:", respuesta);
      if (respuesta.status === "deleted" || respuesta.status === "not_found") {
        // Si se borró o no existía
        // Eliminar Elemento Visual
        if (elementoVisual && elementoVisual.parentNode) {
          elementoVisual.parentNode.removeChild(elementoVisual);
        }
        // Restaurar Botón Original
        restaurarBotonAsignar(codigo); // Usar función auxiliar
      } else {
        console.error(
          "Respuesta inesperada del backend al eliminar:",
          respuesta
        );
        if (elementoVisual) elementoVisual.style.opacity = "1"; // Restaurar opacidad si algo raro pasó
        alert(
          "Ocurrió un error inesperado al intentar eliminar la asignación."
        );
      }
    })
    .withFailureHandler((error) => {
      console.error("Error al eliminar/actualizar en Sheet:", error);
      alert(
        `Error al eliminar la asignación para ${codigo}: ${
          error.message || error
        }`
      );
      // Restaurar opacidad si falla
      if (elementoVisual) elementoVisual.style.opacity = "1";
    })
    .eliminarAsignacion(datosParaEliminar);
}

// --- 8. Función Auxiliar: `restaurarBotonAsignar` ---
function restaurarBotonAsignar(codigo) {
  const boton = document.querySelector(
    `button.eliminar[data-codigo="${codigo}"]`
  ); // Buscar botón en estado "eliminar"
  if (boton) {
    boton.textContent = "Asignar a superficie";
    boton.classList.remove("eliminar");
    boton.classList.add("asignar");
    // Recuperar el color asociado a este producto (necesitamos encontrarlo en el DOM o tenerlo accesible)
    let color = "#808080"; // Color por defecto si no lo encontramos
    const cromo = boton.closest(".cromo-producto");
    const colorBadge = cromo?.querySelector(".color-badge");
    if (colorBadge) {
      color = colorBadge.style.backgroundColor;
    }
    // Restaurar listener original
    boton.onclick = (event) => asignarASuperficie(codigo, color, event);
  } else {
    console.warn(
      `No se encontró el botón 'Eliminar asignación' para el código ${codigo} para restaurar.`
    );
  }
}

/**
 * Lee los detalles de superficie de una asignación enriquecida
 * y crea los indicadores visuales y mini-forms correspondientes.
 * @param {object} asignacionEnriquecida - El objeto asignación con el array `detallesSuperficie`.
 * @param {string} divIdPlano - El ID del div que contiene el SVG del plano.
 */
function restaurarAsignacionesVisuales(asignacionEnriquecida, divIdPlano) {
  const {
    codigoProducto,
    estancia: roomId,
    detallesSuperficie,
    tipo,
  } = asignacionEnriquecida;
  const esTipoEspecial = [
    "Revestimiento cerámico",
    "Pavimento laminado",
    "Pavimento vinílico",
  ].includes(tipo);

  // Solo procesar si es tipo especial Y tiene detalles
  if (
    !esTipoEspecial ||
    !Array.isArray(detallesSuperficie) ||
    detallesSuperficie.length === 0
  ) {
    return;
  }

  console.log(
    `Restaurando ${detallesSuperficie.length} detalles para ${codigoProducto} en ${roomId} (${divIdPlano})`
  );

  const svgElement = document.querySelector(
    `#${divIdPlano} > svg[data-room-id="${roomId}"]`
  );
  if (!svgElement) {
    console.error(
      `restaurar: No se encontró SVG para ${roomId} en ${divIdPlano}`
    );
    return;
  }

  // Encontrar el contenedor para los mini-forms de este producto
  const contenedorFormularios = findMiniFormContainer(roomId, codigoProducto);
  if (!contenedorFormularios) {
    // Este error es normal si procesarAsignaciones aún no ha creado el contenedor
    // console.warn(`restaurar: No se encontró contenedor de mini-forms para ${codigoProducto} en ${divIdPlano}. ¿Se creó en procesarAsignaciones?`);
    return; // No podemos continuar sin el contenedor
  }

  // Obtener el color asociado
  let color = "#808080";
  const botonAsignar = document.querySelector(
    `button[data-codigo="${codigoProducto}"]`
  );
  const cromo = botonAsignar?.closest(".cromo-producto");
  const colorBadge = cromo?.querySelector(".color-badge");
  if (colorBadge) color = colorBadge.style.backgroundColor || color;

  // Limpiar contenedores existentes por si acaso (evita duplicados en recargas parciales)
  // contenedorFormularios.innerHTML = ''; // Opcional: Borrar antes de recrear

  // Iterar sobre los detalles guardados y recrear UI + Indicadores
  let needTotalUpdate = false; // Flag para actualizar total solo si hay detalles
  detallesSuperficie.forEach((detalle) => {
    const { idSuperficie } = detalle;
    if (!idSuperficie) return; // Saltar si falta ID de superficie

    const esSuelo = idSuperficie === "floor";

    // --- INICIO: Buscar Datos Estáticos para este detalle ---
    const estanciaDataJson = window.datosExpediente?.estancias?.[roomId]; // roomId viene del parámetro de la función padre
    let datosEstaticosParaForm = null;

    if (estanciaDataJson) {
      if (esSuelo) {
        datosEstaticosParaForm = {
          areaNeta: estanciaDataJson.areaOBJ_m2 || 0,
          alturaTecho: estanciaDataJson.alturaTecho_m || 0,
          longitudOriginal_m: 0,
        };
      } else {
        // Es pared
        const paredDataJson =
          estanciaDataJson.geometriaPlanoNormalizada?.paredes?.find(
            (p) => p.wallId_OBJ === idSuperficie
          );
        if (paredDataJson) {
          datosEstaticosParaForm = {
            areaNeta: paredDataJson.areaNetaCara_m2 || 0,
            alturaTecho: estanciaDataJson.alturaTecho_m || 0,
            longitudOriginal_m: paredDataJson.longitudOriginal_m || 0,
          };
        }
      }
    }
    // --- FIN: Buscar Datos Estáticos ---

    // 1. Dibujar Indicador Visual (con offset)
    let elementoVisual;
    if (idSuperficie === "floor") {
      const poligonoOriginal = svgElement.querySelector("polygon.suelo");
      if (poligonoOriginal)
        elementoVisual = dibujarIndicadorSuelo(
          poligonoOriginal,
          codigoProducto,
          color
        );
    } else {
      const lineaOriginal = svgElement.querySelector(
        `line.pared[data-wall-id="${idSuperficie}"]`
      );
      if (lineaOriginal)
        elementoVisual = dibujarIndicadorPared(
          lineaOriginal,
          codigoProducto,
          idSuperficie,
          color
        );
    }

    if (!elementoVisual) {
      console.warn(
        `restaurar: No se pudo dibujar indicador para ${idSuperficie}`
      );
      return; // Saltar este detalle
    }

    // 2. Crear Mini-Formulario (pasando los datos guardados)
    // --- LLAMADA MODIFICADA ---
    const miniFormElement = crearMiniFormularioSuperficie(
      detalle, // Pasar el objeto detalle COMPLETO (con cotas/huecos guardados)
      datosEstaticosParaForm, // Pasar los datos estáticos encontrados
      contenedorFormularios, // Asegúrate que este contenedor existe
      roomId,
      codigoProducto
    );
    // --- FIN LLAMADA ---

    // 3. Enlazar, adjuntar listeners si ambos se crearon
    if (miniFormElement) {
      // Enlazar el ID del indicador visual al dataset del formulario
      miniFormElement.dataset.visualElementId = elementoVisual.id;

      // Añadir listener al indicador restaurado para borrar
      elementoVisual.addEventListener("click", (event) => {
        event.stopPropagation();
        handleDeleteSurfaceAssignment(miniFormElement.id); // Llamar con ID del FORM
      });
      elementoVisual.style.cursor = "pointer";

      // Adjuntar Listeners al Mini-Form restaurado (¡IMPORTANTE!)
      attachListenersToMiniForm(miniFormElement.id);
      needTotalUpdate = true; // Marcar que necesitamos actualizar total
    } else {
      // Si falla el form, quitar el indicador que acabamos de dibujar
      console.error(
        `restaurar: Falló creación de mini-form para ${idSuperficie}, quitando indicador.`
      );
      elementoVisual.remove();
    }
  }); // Fin forEach detalle

  // 4. Actualizar la cantidad total del producto DESPUÉS de restaurar todos sus detalles
  if (needTotalUpdate) {
    updateTotalQuantityDisplay(codigoProducto);
  }
} // Fin restaurarAsignacionesVisuales
