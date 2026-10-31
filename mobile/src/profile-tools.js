const esConsultas = document.body.dataset.section === 'consultas';

        const TEE_NAMES_MALE = ["Negro", "Amarillo", "Blanco"];
        const TEE_NAMES_FEMALE = ["Rojo"];
        const AAG_FIELD_ADULTOS = 1466;
        const AAG_CATEGORY_MALE = 0;
        const AAG_CATEGORY_FEMALE = 1;
        const EMAIL_REDIRECT_TO = "https://app.villamariagolf.com.ar/mi_perfil.html";

        let sessionUser = null;
        let perfil = null;
        let jugador = null;
        let modalTipo = null;
        let reglasHcpCache = [];
        let recomendacionesTee = null;
        let recomendacionRequest = null;
        let refrescarConsultaAbierta = null;
        let calculoParejaRevision = 0;
        let modalidadPareja = "americana";
        const jugadoresPareja = { 1: null, 2: null };
        let detalleUltimoCalculo = null;
        const searchTimers = { 1: null, 2: null };

        function num(v) {
            if (v === null || v === undefined || v === "") return null;
            const n = Number(String(v).replace(",", "."));
            return Number.isFinite(n) ? n : null;
        }

        function fmt(v, dec = 1) {
            const n = num(v);
            if (n === null) return "-";
            return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
        }

        function roundHalfUp(value) {
            if (!Number.isFinite(value)) return null;
            return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
        }

        function calcularHcpJuego(index, slope, courseRating, par) {
            const i = num(index);
            const s = num(slope);
            const cr = num(courseRating);
            const p = num(par);
            if ([i, s, cr, p].some(v => v === null)) return null;
            return Math.min(54, roundHalfUp((i * (s / 113)) + (cr - p)));
        }


        function calcularHcpBase(index, slope, courseRating, par) {
            const i = num(index);
            const s = num(slope);
            const cr = num(courseRating);
            const p = num(par);
            if ([i, s, cr, p].some(v => v === null)) return null;
            return (i * (s / 113)) + (cr - p);
        }

        function normalizarGeneroJugador(value) {
            const g = limpiar(value).toLowerCase();
            if (["female", "f", "dama", "damas", "mujer", "women"].includes(g)) return "female";
            return "male";
        }

        function indexDeJugador(j) {
            return num(j?.current_index ?? j?.index ?? j?.handicap_index);
        }

        function matriculaDeJugador(j) {
            return limpiar(j?.aag_member_number ?? j?.matricula ?? j?.member_number);
        }

        function teeRecomendado(index, genero) {
            const valor = num(index);
            if (valor === null || valor < -10 || valor > 54) return null;
            return recomendacionesTee?.rules?.[genero]?.find(r => valor <= r.max_index)?.tee || null;
        }

        async function cargarRecomendacionesTee() {
            if (recomendacionRequest) return recomendacionRequest;
            recomendacionRequest = (async () => {
                const { data, error } = await db.from('tee_recommendation_settings')
                    .select('aag_field_id,rules,revision,updated_at')
                    .eq('aag_field_id', AAG_FIELD_ADULTOS).single();
                if (error || !data) throw error || new Error('No hay rangos de tees configurados.');
                for (const genero of ['male', 'female']) {
                    const rows = data.rules?.[genero];
                    let previous = -10;
                    if (!Array.isArray(rows) || !rows.length || rows.length > 4) throw new Error('Rangos de tees inválidos.');
                    const seen = new Set();
                    rows.forEach((r, i) => {
                        if (!['Negro','Amarillo','Blanco','Rojo'].includes(r.tee) || seen.has(r.tee) ||
                            typeof r.max_index !== 'number' || !Number.isFinite(r.max_index) ||
                            r.max_index < -10 || r.max_index > 54 || (i && r.max_index <= previous))
                            throw new Error('Rangos de tees inválidos.');
                        previous = r.max_index; seen.add(r.tee);
                    });
                    if (previous !== 54) throw new Error('Los rangos de tees no cubren hasta Index 54.');
                }
                recomendacionesTee = data;
                return data;
            })();
            try { return await recomendacionRequest; }
            catch (error) { recomendacionesTee = null; throw error; }
            finally { recomendacionRequest = null; }
        }

        async function actualizarRecomendacionesTee() {
            if (document.hidden) return;
            try { await cargarRecomendacionesTee(); }
            catch { /* No inventar una recomendación si no se puede verificar la configuración. */ }
            await cargarTeesYHcp();
            calcularPareja(true);
            if (document.getElementById('hcpPlayerDialog')?.open && refrescarConsultaAbierta)
                refrescarConsultaAbierta();
        }

        function normalizarNombreTeeAag(value) {
            return limpiar(value)
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/\b(dama|damas|mujer|mujeres|female|femenino|femenina|caballero|caballeros|hombre|hombres|male|masculino|masculina)\b/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        }

        function claveColorTeeAag(value) {
            const n = normalizarNombreTeeAag(value);
            if (n.includes("negr")) return "negro";
            if (n.includes("amarill")) return "amarillo";
            if (n.includes("blanc")) return "blanco";
            if (n.includes("roj")) return "rojo";
            return n;
        }

        function parTotalDesdeAag(holes) {
            if (!Array.isArray(holes) || !holes.length) return null;

            const pares = holes
                .map(h => num(h?.Par ?? h?.par ?? h?.par_value))
                .filter(v => v !== null);

            if (!pares.length) return null;
            return pares.reduce((sum, par) => sum + par, 0);
        }

        function categoriaAagPorGenero(genero) {
            return genero === "female"
                ? AAG_CATEGORY_FEMALE
                : AAG_CATEGORY_MALE;
        }

        function buscarReglaJugador(j) {
            const index = indexDeJugador(j);
            const genero = normalizarGeneroJugador(j?.gender);

            if (index === null) return { error: "El jugador no tiene Index cargado." };
            if (index < -10 || index > 54) {
                return { error: `El Index ${fmt(index, 1)} está fuera del rango local (-10 a 54).` };
            }

            const teeNombre = teeRecomendado(index, genero);
            if (!teeNombre) return { error: "No se pudo verificar el tee recomendado del club. Comprobá tu conexión y volvé a intentar." };
            const claveBuscada = claveColorTeeAag(teeNombre);
            const categoriaAag = categoriaAagPorGenero(genero);

            const regla = reglasHcpCache.find(r =>
                Number(r.aag_field_id) === AAG_FIELD_ADULTOS &&
                Number(r.category) === categoriaAag &&
                claveColorTeeAag(r.tee_name) === claveBuscada
            );

            if (!regla) {
                return {
                    error: `No encontré la salida ${teeNombre} vigente en aag_teeouts para este jugador.`
                };
            }

            const par = parTotalDesdeAag(regla.holes);

            if (num(regla.slope_total) === null ||
                num(regla.calification_total) === null ||
                par === null) {
                return {
                    error: `La salida ${regla.tee_name || teeNombre} no tiene Slope, Rating o Par completos en aag_teeouts.`
                };
            }

            return {
                regla: {
                    ...regla,
                    slope: num(regla.slope_total),
                    course_rating: num(regla.calification_total),
                    par
                },
                index,
                genero,
                teeNombre: regla.tee_name || teeNombre
            };
        }

        async function cargarReglasHcpCache() {
            const { data, error } = await db
                .from("aag_teeouts")
                .select(`
                    id,
                    aag_field_id,
                    aag_teeout_id,
                    teeout_number,
                    tee_name,
                    category,
                    slope_total,
                    calification_total,
                    holes
                `)
                .eq("aag_field_id", AAG_FIELD_ADULTOS);

            if (error) throw error;
            reglasHcpCache = data || [];
        }

        function seleccionarModalidadPareja(tipo) {
            modalidadPareja = tipo === "clasico" ? "clasico" : "americana";
            document.getElementById("modeAmericana").classList.toggle("active", modalidadPareja === "americana");
            document.getElementById("modeClasico").classList.toggle("active", modalidadPareja === "clasico");
            document.getElementById("pairHelp").textContent = modalidadPareja === "americana"
                ? "Seleccioná dos jugadores. En Americana, cada uno juega con su propio HCP calculado al 85%."
                : "Seleccioná dos jugadores. En Clásico, la pareja juega con un único HCP: 3/8 de la suma de ambos HCP base.";
            calcularPareja();
        }

        function escaparHtml(value) {
            return String(value ?? "")
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#039;");
        }

        function configurarBuscadoresJugadores() {
            [1, 2].forEach(slot => {
                const input = document.getElementById(`playerSearch${slot}`);
                input.addEventListener("input", () => {
                    clearTimeout(searchTimers[slot]);
                    searchTimers[slot] = setTimeout(() => buscarJugadoresPareja(slot, input.value), 180);
                });
                input.addEventListener("focus", () => {
                    if (input.value.trim().length >= 2) buscarJugadoresPareja(slot, input.value);
                });
            });

            document.addEventListener("click", e => {
                [1, 2].forEach(slot => {
                    const picker = document.getElementById(`playerSearch${slot}`).closest(".player-picker");
                    if (!picker.contains(e.target)) document.getElementById(`playerResults${slot}`).classList.remove("show");
                });
            });
        }

        async function buscarJugadoresPareja(slot, texto) {
            const term = limpiar(texto);
            const results = document.getElementById(`playerResults${slot}`);

            if (term.length < 2) {
                results.classList.remove("show");
                results.innerHTML = "";
                return;
            }

            results.innerHTML = `
        <div class="search-result">
            <span>Buscando...</span>
        </div>
    `;
            results.classList.add("show");

            try {
                const jugadores = await VMGCPlayerSearch.search(db,term,7);
                if (VMGCPlayerSearch.normalize(document.getElementById('playerSearch'+slot).value)!==VMGCPlayerSearch.normalize(term)) return;
                const otro = jugadoresPareja[slot === 1 ? 2 : 1];
                const lista = jugadores.filter(j => !otro || j.id !== otro.id).slice(0,6);

                if (!lista.length) {
                    results.innerHTML = `
                <div class="search-result">
                    <span>No encontré jugadores.</span>
                </div>
            `;
                    return;
                }

                results.innerHTML = lista.map((j, idx) => `
            <button
                class="search-result"
                type="button"
                data-slot="${slot}"
                data-index="${idx}"
            >
                <strong>
                    ${escaparHtml(
                    nombreCompletoDesdeJugador(j) || "Sin nombre"
                )}
                </strong>

                <span>
                    Matrícula ${escaparHtml(
                    matriculaDeJugador(j) || "-"
                )}
                    · Index ${fmt(indexDeJugador(j), 1)} · ${escaparHtml(j.club_name || "Sin club informado")}
                </span>
            </button>
        `).join("");

                results
                    .querySelectorAll("button[data-index]")
                    .forEach(btn => {
                        btn.addEventListener("click", () => {
                            seleccionarJugadorPareja(
                                slot,
                                lista[Number(btn.dataset.index)]
                            );
                        });
                    });

            } catch (e) {
                if (VMGCPlayerSearch.normalize(document.getElementById("playerSearch"+slot).value)!==VMGCPlayerSearch.normalize(term)) return;
                if (VMGCPlayerSearch.normalize(document.getElementById("playerSearch"+slot).value)!==VMGCPlayerSearch.normalize(term)) return;
                if (VMGCPlayerSearch.normalize(document.getElementById("playerSearch"+slot).value)!==VMGCPlayerSearch.normalize(term)) return;
                results.innerHTML = `
            <div class="search-result">
                <span>
                    ${escaparHtml(
                    e.message || "No se pudo buscar."
                )}
                </span>
            </div>
        `;
            }
        }

        function seleccionarJugadorPareja(slot, j) {
            jugadoresPareja[slot] = j;
            const input = document.getElementById(`playerSearch${slot}`);
            input.value = "";
            input.style.display = "none";
            document.getElementById(`playerResults${slot}`).classList.remove("show");

            const box = document.getElementById(`selectedPlayer${slot}`);
            box.className = "selected-player show";
            box.innerHTML = `
                <div>
                    <div class="selected-player-name">${escaparHtml(nombreCompletoDesdeJugador(j) || "Sin nombre")}</div>
                    <div class="selected-player-detail">Matrícula ${escaparHtml(matriculaDeJugador(j) || "-")} · Index ${fmt(indexDeJugador(j), 1)}</div>
                </div>
                <button class="clear-player" type="button" aria-label="Quitar jugador" onclick="quitarJugadorPareja(${slot})">×</button>
            `;
            calcularPareja();
        }

        function quitarJugadorPareja(slot) {
            jugadoresPareja[slot] = null;
            const input = document.getElementById(`playerSearch${slot}`);
            input.style.display = "block";
            input.value = "";
            document.getElementById(`selectedPlayer${slot}`).className = "selected-player";
            document.getElementById(`selectedPlayer${slot}`).innerHTML = "";
            limpiarStatus("pairStatus");
            document.getElementById("pairResult").className = "pair-result";
            document.getElementById("pairResult").innerHTML = "";
            detalleUltimoCalculo = null;
            input.focus();
        }

        function datosCalculoJugador(j) {
            const encontrada = buscarReglaJugador(j);
            if (encontrada.error) return encontrada;
            const { regla, index, teeNombre } = encontrada;
            const base = calcularHcpBase(index, regla.slope, regla.course_rating, regla.par);
            return {
                jugador: j,
                nombre: nombreCompletoDesdeJugador(j) || "Jugador",
                matricula: matriculaDeJugador(j),
                index,
                teeNombre,
                slope: num(regla.slope),
                rating: num(regla.course_rating),
                par: num(regla.par),
                base
            };
        }

        async function calcularPareja(configuracionVerificada = false) {
            const revision = ++calculoParejaRevision;
            limpiarStatus("pairStatus");
            const result = document.getElementById("pairResult");
            if (!jugadoresPareja[1] || !jugadoresPareja[2]) {
                result.className = "pair-result";
                result.innerHTML = "";
                detalleUltimoCalculo = null;
                return;
            }

            if (!configuracionVerificada) {
                result.className = 'pair-result';
                result.innerHTML = '';
                detalleUltimoCalculo = null;
                try { await cargarRecomendacionesTee(); } catch {}
                if (revision !== calculoParejaRevision) return;
            }

            const a = datosCalculoJugador(jugadoresPareja[1]);
            const b = datosCalculoJugador(jugadoresPareja[2]);
            const errores = [a.error, b.error].filter(Boolean);
            if (errores.length) {
                detalleUltimoCalculo = null;
                status("pairStatus", errores.join(" "), false);
                result.className = "pair-result";
                result.innerHTML = "";
                return;
            }

            if (modalidadPareja === "americana") {
                a.aplicado = a.base * 0.85;
                b.aplicado = b.base * 0.85;
                a.final = roundHalfUp(a.aplicado);
                b.final = roundHalfUp(b.aplicado);
                detalleUltimoCalculo = { modalidad: "americana", jugadores: [a, b] };

                result.innerHTML = `
                    <div class="warning">Cada jugador juega con su propio HCP.</div>
                    ${[a, b].map(x => `
                        <div class="result-player-card ${clasePiedra(x.teeNombre)}">
                            <div>
                                <div class="name">${escaparHtml(x.nombre)}</div>
                                <div class="detail">${escaparHtml(nombreTeeVisible(x.teeNombre))} · Index ${fmt(x.index, 1)} · HCP base ${fmt(x.base, 2)} · 85% ${fmt(x.aplicado, 2)}</div>
                            </div>
                            <div class="hcp">${x.final}</div>
                        </div>
                    `).join("")}
                    <button class="btn light explain-btn" type="button" onclick="abrirFormulaModal()">Ver cómo se calculó</button>
                `;
            } else {
                /*
                 * FOURBALL CLÁSICO
                 *
                 * La diferencia entre los HCP base de ambos jugadores
                 * no puede superar los 5 golpes.
                 *
                 * Si la diferencia es mayor, se reduce el HCP más alto
                 * hasta que quede exactamente 5 golpes por encima del menor.
                 */

                a.baseAjustado = a.base;
                b.baseAjustado = b.base;

                const diferenciaOriginal = Math.abs(a.base - b.base);
                let huboAjuste = false;

                if (diferenciaOriginal > 5) {
                    huboAjuste = true;

                    if (a.base > b.base) {
                        a.baseAjustado = b.base + 5;
                    } else {
                        b.baseAjustado = a.base + 5;
                    }
                }

                const suma = a.baseAjustado + b.baseAjustado;
                const aplicado = suma * 0.375;
                const final = roundHalfUp(aplicado);

                detalleUltimoCalculo = {
                    modalidad: "clasico",
                    jugadores: [a, b],
                    diferenciaOriginal,
                    huboAjuste,
                    suma,
                    aplicado,
                    final
                };

                const avisoAjuste = huboAjuste
                    ? `
            <div class="warning">
                La diferencia entre los HCP era de
                <strong>${fmt(diferenciaOriginal, 2)}</strong> golpes.
                Para Fourball Clásico se redujo el HCP más alto,
                dejando una diferencia máxima de 5 golpes.
            </div>
        `
                    : "";

                result.innerHTML = `
        ${avisoAjuste}

        ${[a, b].map(x => {
                    const fueAjustado =
                        Math.abs(x.baseAjustado - x.base) > 0.000001;

                    return `
                <div class="result-player-card ${clasePiedra(x.teeNombre)}">
                    <div>
                        <div class="name">
                            ${escaparHtml(x.nombre)}
                        </div>

                        <div class="detail">
                            ${escaparHtml(nombreTeeVisible(x.teeNombre))}
                            · Index ${fmt(x.index, 1)}
                            · HCP base ${fmt(x.base, 2)}

                            ${fueAjustado
                            ? ` · HCP ajustado <strong>${fmt(x.baseAjustado, 2)}</strong>`
                            : ""
                        }
                        </div>
                    </div>

                    <div class="hcp" style="font-size:22px;">
                        ${fmt(x.baseAjustado, 2)}
                    </div>
                </div>
            `;
                }).join("")}

        <div class="team-result">
            <div class="label">HCP de juego de la pareja</div>
            <div class="number">${final}</div>
        </div>

        <button
            class="btn light explain-btn"
            type="button"
            onclick="abrirFormulaModal()"
        >
            Ver cómo se calculó
        </button>
    `;
            }
            result.className = "pair-result show";
        }

        function formulaBaseHtml(x) {
            return `
                <strong>${escaparHtml(x.nombre)}</strong><br>
                Index ${fmt(x.index, 1)} · ${escaparHtml(nombreTeeVisible(x.teeNombre))}<br>
                Slope ${fmt(x.slope, 0)} · Rating ${fmt(x.rating, 1)} · Par ${fmt(x.par, 0)}<br>
                (${fmt(x.index, 1)} × (${fmt(x.slope, 0)} / 113)) + (${fmt(x.rating, 1)} − ${fmt(x.par, 0)}) = <strong>${fmt(x.base, 2)}</strong>
            `;
        }

        function abrirFormulaModal() {
            if (!detalleUltimoCalculo) return;
            const content = document.getElementById("formulaContent");
            if (detalleUltimoCalculo.modalidad === "americana") {
                document.getElementById("formulaTitle").textContent = "Cálculo Fourball Americana";
                document.getElementById("formulaIntro").textContent = "Primero se obtiene el HCP base de cada jugador y luego se aplica el 85%.";
                content.innerHTML = detalleUltimoCalculo.jugadores.map(x => `
                    ${formulaBaseHtml(x)}<br>
                    ${fmt(x.base, 2)} × 0,85 = ${fmt(x.aplicado, 2)}<br>
                    Redondeo final: <strong>${x.final}</strong>
                `).join("<hr style='border:none;border-top:1px solid #dfe6e0;margin:12px 0;'>");
            } else {
                const [a, b] = detalleUltimoCalculo.jugadores;

                document.getElementById("formulaTitle").textContent =
                    "Cálculo Fourball Clásico";

                document.getElementById("formulaIntro").textContent =
                    "Primero se limita a 5 golpes la diferencia entre ambos HCP base. Luego se suman y se aplica 3/8.";

                const ajusteHtml = detalleUltimoCalculo.huboAjuste
                    ? `
            <hr style="border:none;border-top:1px solid #dfe6e0;margin:12px 0;">

            <strong>Límite de diferencia</strong><br>

            Diferencia original:
            ${fmt(detalleUltimoCalculo.diferenciaOriginal, 2)} golpes.<br>

            Como supera los 5 golpes permitidos,
            el HCP más alto se reduce.<br><br>

            HCP utilizados para la suma:<br>

            ${escaparHtml(a.nombre)}:
            <strong>${fmt(a.baseAjustado, 4)}</strong><br>

            ${escaparHtml(b.nombre)}:
            <strong>${fmt(b.baseAjustado, 4)}</strong>
        `
                    : `
            <hr style="border:none;border-top:1px solid #dfe6e0;margin:12px 0;">

            La diferencia es de
            <strong>${fmt(detalleUltimoCalculo.diferenciaOriginal, 2)}</strong>
            golpes, por lo que no fue necesario realizar ningún ajuste.
        `;

                content.innerHTML = `
        ${formulaBaseHtml(a)}

        <hr style="border:none;border-top:1px solid #dfe6e0;margin:12px 0;">

        ${formulaBaseHtml(b)}

        ${ajusteHtml}

        <hr style="border:none;border-top:1px solid #dfe6e0;margin:12px 0;">

        <strong>Cálculo de la pareja</strong><br>

        (${fmt(a.baseAjustado, 4)} + ${fmt(b.baseAjustado, 4)})
        × 0,375<br>

        ${fmt(detalleUltimoCalculo.suma, 4)}
        × 0,375 =
        ${fmt(detalleUltimoCalculo.aplicado, 4)}<br>

        Redondeo final:
        <strong>${detalleUltimoCalculo.final}</strong>
    `;
            }
            document.getElementById("formulaModal").classList.add("show");
        }

        function cerrarFormulaModal() {
            document.getElementById("formulaModal").classList.remove("show");
        }

        function limpiar(v) { return String(v || "").trim(); }
        function normalizarMail(v) { return limpiar(v).toLowerCase(); }

        function status(elId, msg, ok = true) {
            const el = document.getElementById(elId);
            el.className = "status " + (ok ? "ok" : "err");
            el.textContent = msg;
        }

        function limpiarStatus(elId) {
            const el = document.getElementById(elId);
            el.className = "status";
            el.textContent = "";
        }

        function nombreCompletoDesdeJugador(j) {
            if (!j) return "";
            if (j.full_name) return limpiar(j.full_name);
            if (j.display_name) return limpiar(j.display_name);
            return limpiar(`${j.first_name || ""} ${j.last_name || ""}`);
        }

        function obtenerNombreApellido(j, p) {
            const first = limpiar(j?.first_name || p?.first_name || "");
            const last = limpiar(j?.last_name || p?.last_name || "");
            if (first || last) return { first, last };

            const full = nombreCompletoDesdeJugador(j) || limpiar(p?.name || sessionUser?.user_metadata?.name || "");
            if (full.includes(",")) {
                const [apellido, nombre] = full.split(",").map(x => limpiar(x));
                return { first: nombre, last: apellido };
            }

            const partes = full.split(/\s+/).filter(Boolean);
            return { first: partes[0] || "", last: partes.slice(1).join(" ") };
        }

        function valorJugador(campo) { return jugador?.[campo] ?? perfil?.[campo] ?? ""; }

        function obtenerIndex() {
            return num(jugador?.current_index ?? jugador?.index ?? jugador?.handicap_index ?? perfil?.current_index);
        }

        function obtenerMatricula() {
            return limpiar(jugador?.aag_member_number ?? jugador?.matricula ?? jugador?.member_number ?? perfil?.aag_member_number ?? "");
        }

        function obtenerBornDate() {
            return jugador?.born_date ?? perfil?.born_date ?? "";
        }

        function obtenerDocNumber() {
            return jugador?.doc_number ?? perfil?.doc_number ?? "";
        }

        function obtenerLowIndex() {
            return num(jugador?.lowest_handicap_index ?? perfil?.lowest_handicap_index);
        }

        function formatearFechaAR(value) {
            if (!value) return "-";

            const s = String(value).trim();

            // Si viene como YYYY-MM-DD
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (m) return `${m[3]}/${m[2]}/${m[1]}`;

            return s;
        }

        function obtenerGenero() {
            const g = limpiar(jugador?.gender || perfil?.gender || "").toLowerCase();
            if (["female", "f", "dama", "damas", "mujer"].includes(g)) return "female";
            return "male";
        }

        function obtenerEmailVisible() { return sessionUser?.email || perfil?.email || jugador?.email || ""; }
        function obtenerTelefonoVisible() { return valorJugador("phone") || valorJugador("telefono") || valorJugador("mobile") || ""; }

        async function buscarDatosUsuario(user) {
            let prof = null;
            let play = null;

            const { data: profData, error: profError } = await db
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .maybeSingle();

            if (profError) throw profError;

            prof = profData || null;

            const { data: playerByProfile, error: playerError } = await db
                .from("players")
                .select("*")
                .eq("profile_id", user.id)
                .maybeSingle();

            if (playerError) throw playerError;

            if (playerByProfile) {
                play = playerByProfile;
            } else if (prof?.aag_member_number) {
                const { data } = await db
                    .from("players")
                    .select("*")
                    .eq("aag_member_number", prof.aag_member_number)
                    .maybeSingle();

                if (data) play = data;
            } else if (user.email) {
                const { data } = await db
                    .from("players")
                    .select("*")
                    .eq("email", user.email)
                    .maybeSingle();

                if (data) play = data;
            }

            return { prof, play };
        }

        function ponerDato(id,value){const element=document.getElementById(id);if(element)element.textContent=value;}
        function renderDatos() {
            const { first, last } = obtenerNombreApellido(jugador, perfil);
            const fullName = limpiar(`${first} ${last}`) || "Socio VMGC";
            const email = obtenerEmailVisible();
            const phone = obtenerTelefonoVisible();
            const matricula = obtenerMatricula();
            const index = obtenerIndex();
            const bornDate = obtenerBornDate();
            const docNumber = obtenerDocNumber();
            const lowIndex = obtenerLowIndex();

            ponerDato("profileName", fullName);
            ponerDato("profileMatricula", matricula || "-");
            ponerDato("profileIndex", fmt(index, 1));
            ponerDato("profileLowIndex", fmt(lowIndex, 1));
            ponerDato("profileBornDate", formatearFechaAR(bornDate));
            ponerDato("profileDocNumber", docNumber || "-");
            ponerDato("profileEmail", email || "-");
            ponerDato("profilePhone", phone || "Sin cargar");
        }

        function nombreTeeVisible(nombre){
            const color=claveColorTeeAag(nombre);
            const colors={negro:'negros',amarillo:'amarillos',blanco:'blancos',rojo:'rojos'};
            return colors[color] ? 'Tee '+colors[color] : 'Tee '+limpiar(nombre).replace(/salidas?|caballeros|damas/gi,'').trim();
        }
        function clasePiedra(nombre) {
            const n = limpiar(nombre).toLowerCase();
            if (n.includes("negr")) return "stone-negras";
            if (n.includes("amarill")) return "stone-amarillas";
            if (n.includes("blanc")) return "stone-blancas";
            if (n.includes("roj")) return "stone-rojas";
            return "";
        }

        async function cargarTeesYHcp() {
            const index = obtenerIndex();
            const genero = obtenerGenero();
            const recomendado = claveColorTeeAag(teeRecomendado(index, genero));
            const teesPermitidos = genero === "female" ? TEE_NAMES_FEMALE : TEE_NAMES_MALE;

            if (index === null) {
                document.getElementById("hcpVMGC").innerHTML = `<div class="warning">No encontré Index para calcular el HCP de juego.</div>`;
                return;
            }

            const categoriaAag = categoriaAagPorGenero(genero);

            const filtradas = teesPermitidos
                .map(nombreTee => {
                    const clave = claveColorTeeAag(nombreTee);

                    const tee = reglasHcpCache.find(r =>
                        Number(r.aag_field_id) === AAG_FIELD_ADULTOS &&
                        Number(r.category) === categoriaAag &&
                        claveColorTeeAag(r.tee_name) === clave
                    );

                    if (!tee) return null;

                    return {
                        ...tee,
                        slope: num(tee.slope_total),
                        course_rating: num(tee.calification_total),
                        par: parTotalDesdeAag(tee.holes),
                        tees: {
                            name: tee.tee_name || nombreTee
                        }
                    };
                })
                .filter(Boolean);

            if (!filtradas.length) {
                document.getElementById("hcpVMGC").innerHTML =
                    `<div class="warning">No encontré salidas AAG vigentes para ${genero === "female" ? "Damas" : "Caballeros"} en la cancha ${AAG_FIELD_ADULTOS}.</div>`;
                return;
            }

            document.getElementById("hcpVMGC").innerHTML = (!recomendacionesTee ? '<div class="warning">No se pudo verificar el tee recomendado. Los HCP por tee siguen disponibles.</div>' : '') + filtradas.map(r => {
                const hcp = calcularHcpJuego(index, r.slope, r.course_rating, r.par);
                const piedra = r.tees?.name || "-";
                return `
                    <div class="hcp-card ${clasePiedra(piedra)}">
                        <div>
                            <div class="hcp-title">${escaparHtml(nombreTeeVisible(piedra))}</div>
                            ${recomendado && claveColorTeeAag(piedra) === recomendado ? '<span class="recommended-tee">✓ Tee recomendado</span>' : ''}
                            <div class="hcp-detail"><div class="tee-index">Index <strong>${fmt(index, 1)}</strong></div><div class="tee-course"><span>Slope <strong>${r.slope ?? "-"}</strong></span><span>Rating <strong>${fmt(r.course_rating, 1)}</strong></span><span>Par <strong>${r.par ?? "-"}</strong></span></div></div>
                        </div>
                        <div class="hcp-number">${hcp ?? "-"}</div>
                    </div>
                `;
            }).join("");
        }

        async function updateTabla(tabla, idCampo, idValor, valores) {
            if (!idValor || !Object.keys(valores).length) return { ok: true, skipped: true };
            const { error } = await db.from(tabla).update(valores).eq(idCampo, idValor);
            return { ok: !error, error };
        }

        async function sincronizarAuthConTablas() {
            const emailAuth = normalizarMail(sessionUser?.email);
            if (!emailAuth) return;

            const updatesProfile = {};
            const updatesPlayer = {};

            if (perfil?.email !== undefined && normalizarMail(perfil.email) !== emailAuth) updatesProfile.email = emailAuth;
            if (jugador?.email !== undefined && normalizarMail(jugador.email) !== emailAuth) updatesPlayer.email = emailAuth;

            if (perfil?.id && Object.keys(updatesProfile).length) await updateTabla("profiles", "id", perfil.id, updatesProfile);
            if (jugador?.id && Object.keys(updatesPlayer).length) await updateTabla("players", "id", jugador.id, updatesPlayer);
        }

        function abrirModal(tipo) {
            modalTipo = tipo;
            limpiarStatus("modalStatus");

            const input = document.getElementById("modalInput");
            const title = document.getElementById("modalTitle");
            const text = document.getElementById("modalText");

            if (tipo === "email") {
                title.textContent = "Cambiar mail";
                text.textContent = "Ingresá el nuevo mail. Supabase enviará un correo de confirmación a la nueva dirección.";
                input.type = "email";
                input.value = obtenerEmailVisible();
            } else {
                title.textContent = "Cambiar teléfono";
                text.textContent = "Ingresá el teléfono actualizado del socio.";
                input.type = "tel";
                input.value = obtenerTelefonoVisible();
            }

            document.getElementById("editModal").classList.add("show");
            setTimeout(() => input.focus(), 80);
        }

        function cerrarModal() {
            document.getElementById("editModal").classList.remove("show");
            modalTipo = null;
        }

        async function guardarTelefono(nuevoTelefono) {
            const errores = [];

            if (perfil?.id) {
                const valoresPerfil = {};
                if ("phone" in perfil) valoresPerfil.phone = nuevoTelefono;
                if ("telefono" in perfil) valoresPerfil.telefono = nuevoTelefono;
                const rPerfil = await updateTabla("profiles", "id", perfil.id, valoresPerfil);
                if (!rPerfil.ok) errores.push(`profiles: ${rPerfil.error.message}`);
            }

            if (jugador?.id) {
                const valoresJugador = {};
                if ("phone" in jugador) valoresJugador.phone = nuevoTelefono;
                if ("telefono" in jugador) valoresJugador.telefono = nuevoTelefono;
                if ("mobile" in jugador) valoresJugador.mobile = nuevoTelefono;
                const rJugador = await updateTabla("players", "id", jugador.id, valoresJugador);
                if (!rJugador.ok) errores.push(`players: ${rJugador.error.message}`);
            }

            if (errores.length) throw new Error("No pude guardar en Supabase: " + errores.join(" | "));
        }

        async function guardarEmail(nuevoEmail) {
            const emailActualAuth = normalizarMail(sessionUser.email);
            if (!nuevoEmail) throw new Error("El mail no puede quedar vacío.");
            if (nuevoEmail === emailActualAuth) return "same";

            const { error: authError } = await db.auth.updateUser(
                { email: nuevoEmail },
                { emailRedirectTo: EMAIL_REDIRECT_TO }
            );
            if (authError) throw authError;
            return "pending";
        }

        async function guardarModal() {
            const valor = limpiar(document.getElementById("modalInput").value);

            try {
                if (modalTipo === "phone") {
                    await guardarTelefono(valor);
                    status("modalStatus", "Teléfono guardado correctamente.", true);
                    status("contactStatus", "Teléfono actualizado correctamente.", true);
                }

                if (modalTipo === "email") {
                    const res = await guardarEmail(normalizarMail(valor));
                    if (res === "pending") {
                        status("modalStatus", "Te enviamos un mail de confirmación a la nueva dirección.", true);
                        status("contactStatus", "Revisá el nuevo mail para confirmar el cambio de dirección.", true);
                    } else {
                        status("modalStatus", "El mail no cambió.", true);
                    }
                }

                const { data } = await db.auth.getSession();
                if (data?.session?.user) {
                    sessionUser = data.session.user;
                    const datos = await buscarDatosUsuario(sessionUser);
                    perfil = datos.prof;
                    jugador = datos.play;
                    renderDatos();
                }

                setTimeout(cerrarModal, 850);
            } catch (e) {
                status("modalStatus", e.message || "No se pudo guardar el cambio.", false);
            }
        }

        document.getElementById("btnSavePassword")?.addEventListener("click", async () => {
            const pass1 = document.getElementById("passwordInput").value;
            const pass2 = document.getElementById("passwordInput2").value;
            try {
                if (!pass1 || pass1.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
                if (pass1 !== pass2) throw new Error("Las contraseñas no coinciden.");
                const { error } = await db.auth.updateUser({ password: pass1 });
                if (error) throw error;
                document.getElementById("passwordInput").value = "";
                document.getElementById("passwordInput2").value = "";
                status("passwordStatus", "Contraseña actualizada correctamente.", true);
            } catch (e) {
                status("passwordStatus", e.message || "No se pudo actualizar la contraseña.", false);
            }
        });

        function activarGestoVolver() {
            let startX = null;
            let startY = 0;

            document.addEventListener("touchstart", (e) => {
                if(e.touches.length!==1){startX=null;return;}
                const t = e.touches[0];
                startX = t.clientX;
                startY = t.clientY;
            }, { passive: true });

            document.addEventListener("touchend", (e) => {
                if(startX===null||e.touches.length)return;
                const t = e.changedTouches[0];
                const dx = t.clientX - startX;
                const dy = Math.abs(t.clientY - startY);
                if (startX < 35 && dx > 95 && dy < 70) {
                    window.location.href = "panel.html";
                }
            }, { passive: true });
        }

        async function registrarUsoPagina(page, action = "view", extra = {}) {
            try {
                const { data: { user } } = await db.auth.getUser();
                if (!user) return;

                const { data: player } = await db
                    .from("players")
                    .select("id")
                    .eq("profile_id", user.id)
                    .maybeSingle();

                await db.from("app_usage_events").insert({
                    user_id: user.id,
                    player_id: player?.id || null,
                    email: user.email || null,
                    page,
                    action,
                    tournament_id: extra.tournament_id || null,
                    metadata: extra
                });
            } catch (err) {
                console.warn("No se pudo registrar uso:", err);
            }
        }

        async function init() {
            const { data, error } = await db.auth.getSession();
            if (error || !data.session) {
                window.location.href = "login.html";
                return;
            }

            sessionUser = data.session.user;

            await registrarUsoPagina(esConsultas ? "consultas" : "perfil", "view");

            const datos = await buscarDatosUsuario(sessionUser);
            perfil = datos.prof;
            jugador = datos.play;

            if(!esConsultas)await sincronizarAuthConTablas();

            const datosActualizados = await buscarDatosUsuario(sessionUser);
            perfil = datosActualizados.prof;
            jugador = datosActualizados.play;

            renderDatos();
            activarGestoVolver();
            if(!esConsultas)return;
            configurarBuscadoresJugadores();

            try {
                await cargarReglasHcpCache();
            } catch (e) {
                status("pairStatus", "No se pudieron cargar las reglas de HCP: " + (e.message || "error desconocido"), false);
            }

            await actualizarRecomendacionesTee();
            window.setInterval(actualizarRecomendacionesTee, 60000);
            document.addEventListener('visibilitychange', () => { if (!document.hidden) actualizarRecomendacionesTee(); });
            window.addEventListener('online', actualizarRecomendacionesTee);

            setTimeout(() => {
                cargarTeesYHcp();
            }, 50);
        }


        async function buscarPadronHcp(term) {
            return {players:await VMGCPlayerSearch.search(db,term,6),partial:false};
        }

        function instalarConsultaHcpJugador() {
            const form=document.getElementById('hcpPlayerSearchForm'), input=document.getElementById('hcpPlayerQuery');
            const message=document.getElementById('hcpPlayerSearchStatus'), choices=document.getElementById('hcpPlayerChoices');
            const dialog=document.getElementById('hcpPlayerDialog');let revision=0,searchTimer=null;
            input.setAttribute('aria-controls','hcpPlayerChoices');
            input.setAttribute('aria-expanded','false');
            input.setAttribute('aria-haspopup','listbox');
            choices.setAttribute('role','listbox');
            choices.setAttribute('aria-label','Jugadores sugeridos');
            function closeChoices(){choices.hidden=true;input.setAttribute('aria-expanded','false');}
            document.addEventListener('click',event=>{if(!form.contains(event.target)){clearTimeout(searchTimer);revision++;closeChoices();}});
            input.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();clearTimeout(searchTimer);revision++;closeChoices();}});
            document.getElementById('hcpPlayerClose').onclick=()=>dialog.close();
            const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
            async function showPlayer(player, refreshOnly=false){
                refrescarConsultaAbierta=()=>showPlayer(player,true);
                closeChoices();
                document.getElementById('hcpPlayerTitle').textContent=player.full_name||'Jugador';
                document.getElementById('hcpPlayerIdentity').textContent='Matrícula '+(matriculaDeJugador(player)||'—')+' · Index '+fmt(indexDeJugador(player),1)+' · Club: '+(limpiar(player.club_name)||'Sin club informado');
                const list=document.getElementById('hcpPlayerTees');list.replaceChildren();if(!dialog.open)dialog.showModal();list.textContent='Cargando salidas…';
                try{
                    if(!refreshOnly)try{await cargarRecomendacionesTee();}catch{}
                    if(!reglasHcpCache.length)await cargarReglasHcpCache();
                    const index=indexDeJugador(player);
                    if(index===null){list.textContent='Este jugador no tiene un índex cargado para calcular su HCP.';return;}
                    const genderValue=String(player.gender||'').trim();
                    if(!genderValue){list.textContent='Falta la categoría del jugador para elegir las valoraciones de la cancha.';return;}
                    const gender=normalizarGeneroJugador(genderValue),recommended=claveColorTeeAag(teeRecomendado(index,gender));
                    const teeOrder={negro:0,amarillo:1,blanco:2,rojo:3};
                    const tees=reglasHcpCache.filter(r=>Number(r.aag_field_id)===AAG_FIELD_ADULTOS&&Number(r.category)===categoriaAagPorGenero(gender)).sort((a,b)=>(teeOrder[claveColorTeeAag(a.tee_name)]??99)-(teeOrder[claveColorTeeAag(b.tee_name)]??99)||(num(b.calification_total)??0)-(num(a.calification_total)??0));
                    if(!tees.length){list.textContent='No hay valoraciones disponibles para este jugador en VMGC.';return;}
                    list.innerHTML=(!recomendacionesTee?'<div class="warning">No se pudo verificar el tee recomendado. Los HCP por tee siguen disponibles.</div>':'')+tees.map(tee=>{
                        const hcp=calcularHcpJuego(index,tee.slope_total,tee.calification_total,parTotalDesdeAag(tee.holes));
                        const rec=claveColorTeeAag(tee.tee_name)===recommended;
                        return '<div class="hcp-card '+clasePiedra(tee.tee_name)+(rec?' hcp-recommended':'')+'"><div><div class="hcp-title">'+escaparHtml(nombreTeeVisible(tee.tee_name))+'</div>'+(rec?'<span class="recommended-tee">✓ Tee recomendado</span>':'')+'<div class="hcp-detail">Slope '+fmt(tee.slope_total,0)+' · Rating '+fmt(tee.calification_total,1)+' · Par '+fmt(parTotalDesdeAag(tee.holes),0)+'</div></div><div class="hcp-number" aria-label="HCP de juego">'+(hcp??'—')+'</div></div>';
                    }).join('');
                }catch{list.textContent='No pudimos cargar los hándicaps. Cerrá la consulta y volvé a intentar.';}
            }
            async function search(openUnique=false){
                const request=++revision,term=normalized(input.value);
                choices.replaceChildren();closeChoices();
                if(term.length<2){message.textContent=term?'Escribí al menos dos letras o números.':'';form.setAttribute('aria-busy','false');return;}
                message.textContent='Buscando en el padrón…';form.setAttribute('aria-busy','true');
                try{
                    const {players,partial}=await buscarPadronHcp(term);
                    if(request!==revision)return;
                    message.textContent=players.length?(players.length>=6?'Mostrando hasta 6 coincidencias. Seguí escribiendo para acotar.':'Elegí el jugador para consultar su HCP.'):'No encontramos jugadores. Probá con la matrícula o parte del apellido.';
                    if(partial)message.textContent+=' Una de las fuentes no respondió; volvé a intentar si no aparece el jugador.';
                    if(openUnique&&players.length===1){await showPlayer(players[0]);return;}
                    for(const player of players){const button=document.createElement('button');button.type='button';button.className='hcp-player-choice';button.setAttribute('role','option');const name=document.createElement('strong');name.textContent=player.full_name;const detail=document.createElement('span');detail.textContent='Matrícula '+(matriculaDeJugador(player)||'—')+' · Index '+fmt(indexDeJugador(player),1)+' · Club: '+(limpiar(player.club_name)||'Sin club informado');button.append(name,detail);button.onclick=()=>showPlayer(player);choices.append(button);}
                    choices.hidden=players.length===0;input.setAttribute('aria-expanded',String(players.length>0));
                }catch{if(request===revision)message.textContent='No pudimos consultar el padrón. Revisá la conexión y volvé a intentar.';}
                finally{if(request===revision)form.setAttribute('aria-busy','false');}
            }
            input.addEventListener('input',()=>{
                clearTimeout(searchTimer);revision++;choices.replaceChildren();closeChoices();
                if(normalized(input.value).length<2){message.textContent='';form.setAttribute('aria-busy','false');return;}
                message.textContent='Buscando en el padrón…';searchTimer=setTimeout(()=>void search(),180);
            });
            input.addEventListener('focus',()=>{
                if(normalized(input.value).length>=2){clearTimeout(searchTimer);void search(false);}
            });
            form.addEventListener('submit',event=>{event.preventDefault();clearTimeout(searchTimer);void search(true);});
        }
        if(esConsultas)instalarConsultaHcpJugador();

        init();
    
