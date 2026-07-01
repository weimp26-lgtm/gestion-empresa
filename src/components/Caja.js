import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";

const CAJAS_FIJAS = [
  { id: "ventas_compras_ars", nombre: "Ventas y Compras (Pesos)", auto: true, monedaFija: "ARS" },
  { id: "ventas_compras_usd", nombre: "Ventas y Compras (USD)", auto: true, monedaFija: "USD" },
  { id: "acreedores", nombre: "Acreedores" },
  { id: "deudores", nombre: "Deudores" },
  { id: "proveedores", nombre: "Proveedores" },
  { id: "clientes", nombre: "Clientes" },
];

function Caja() {
  const [ventas, setVentas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [movManuales, setMovManuales] = useState([]);
  const [cajasCustom, setCajasCustom] = useState([]);

  const [cajaSeleccionada, setCajaSeleccionada] = useState(null);
  const [mostrarFormCaja, setMostrarFormCaja] = useState(false);
  const [nombreNuevaCaja, setNombreNuevaCaja] = useState("");
  const [subcajaDe, setSubcajaDe] = useState(null);
  const [nombreNuevaSubcaja, setNombreNuevaSubcaja] = useState("");

  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);

  const formVacio = {
    tipo: "ingreso",
    monto: 0,
    moneda: "ARS",
    medio: "Efectivo",
    responsable: "",
    motivo: "",
    fecha: new Date().toISOString().split("T")[0],
    cajaId: "",
  };
  const [form, setForm] = useState(formVacio);

  useEffect(() => {
    const unsubVentas = onSnapshot(collection(db, "ventas"), (snap) => {
      setVentas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubCompras = onSnapshot(collection(db, "compras"), (snap) => {
      setCompras(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubMov = onSnapshot(collection(db, "movimientos_caja"), (snap) => {
      setMovManuales(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubCajas = onSnapshot(collection(db, "cajas"), (snap) => {
      setCajasCustom(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubVentas(); unsubCompras(); unsubMov(); unsubCajas(); };
  }, []);

  const fmt = (n, moneda) => {
    const simbolo = moneda === "USD" ? "USD " : "$";
    return simbolo + Number(n || 0).toLocaleString("es-AR");
  };

  const cajasTop = [...CAJAS_FIJAS, ...cajasCustom.filter((c) => !c.padreId)];
  const getSubcajas = (padreId) => cajasCustom.filter((c) => c.padreId === padreId);
  const getCajaPorId = (id) => CAJAS_FIJAS.find((c) => c.id === id) || cajasCustom.find((c) => c.id === id);

  const flatCajasOptions = () => {
    const opts = [];
    cajasTop.forEach((c) => {
      opts.push({ id: c.id, label: c.nombre });
      getSubcajas(c.id).forEach((sub) => opts.push({ id: sub.id, label: `— ${sub.nombre}` }));
    });
    return opts;
  };

  const movAutomaticos = [
    ...ventas.map((v) => ({
      fecha: v.fecha,
      tipo: "ingreso",
      concepto: `${v.cliente} — ${v.producto}`,
      medio: v.medio || "—",
      monto: v.total || 0,
      moneda: v.moneda || "ARS",
      estado: v.estafa ? "pendiente/estafa" : v.pago === "cobrado" ? "cobrado" : v.pago,
      responsable: v.vendedor || "—",
      motivo: "Venta",
    })),
    ...compras.map((c) => ({
      fecha: c.fecha,
      tipo: "egreso",
      concepto: `${c.proveedorNombre} — ${c.producto}`,
      medio: c.medio || "Transferencia",
      monto: c.total || 0,
      moneda: c.moneda || "ARS",
      estado: c.pago === "pagado" ? "pagado" : "pendiente",
      responsable: "—",
      motivo: "Compra",
    })),
  ].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  const movsManualesDeCaja = (cajaId) => movManuales.filter((m) => m.cajaId === cajaId);
  const sinAsignar = movManuales.filter((m) => !m.cajaId);

  const balancePropio = (cajaId) => {
    const movs = movsManualesDeCaja(cajaId);
    const suma = (moneda) =>
      movs.filter((m) => m.moneda === moneda && m.tipo === "ingreso").reduce((a, m) => a + Number(m.monto || 0), 0) -
      movs.filter((m) => m.moneda === moneda && m.tipo === "egreso").reduce((a, m) => a + Number(m.monto || 0), 0);
    return { ARS: suma("ARS"), USD: suma("USD") };
  };

  const balanceTotal = (cajaId) => {
    const propio = balancePropio(cajaId);
    const subcajas = getSubcajas(cajaId);
    return subcajas.reduce((acc, sub) => {
      const subBal = balanceTotal(sub.id);
      return { ARS: acc.ARS + subBal.ARS, USD: acc.USD + subBal.USD };
    }, propio);
  };

  const balanceAuto = (moneda) => {
    const ing = movAutomaticos.filter((m) => m.tipo === "ingreso" && m.estado === "cobrado" && m.moneda === moneda).reduce((a, m) => a + m.monto, 0);
    const egr = movAutomaticos.filter((m) => m.tipo === "egreso" && m.estado === "pagado" && m.moneda === moneda).reduce((a, m) => a + m.monto, 0);
    const cajaId = moneda === "ARS" ? "ventas_compras_ars" : "ventas_compras_usd";
    const propio = balancePropio(cajaId)[moneda];
    return ing - egr + propio;
  };

  const porCobrarAuto = (moneda) =>
    movAutomaticos.filter((m) => m.tipo === "ingreso" && m.estado === "pendiente" && m.moneda === moneda).reduce((a, m) => a + m.monto, 0);
  const porPagarAuto = (moneda) =>
    movAutomaticos.filter((m) => m.tipo === "egreso" && m.estado !== "pagado" && m.moneda === moneda).reduce((a, m) => a + m.monto, 0);
  const estafasAuto = (moneda) =>
    movAutomaticos.filter((m) => m.estado === "pendiente/estafa" && m.moneda === moneda).reduce((a, m) => a + m.monto, 0);

  const crearCaja = async (e) => {
    e.preventDefault();
    if (!nombreNuevaCaja.trim()) return;
    await addDoc(collection(db, "cajas"), { nombre: nombreNuevaCaja.trim(), padreId: null });
    setNombreNuevaCaja("");
    setMostrarFormCaja(false);
  };

  const crearSubcaja = async (e) => {
    e.preventDefault();
    if (!nombreNuevaSubcaja.trim() || !subcajaDe) return;
    await addDoc(collection(db, "cajas"), { nombre: nombreNuevaSubcaja.trim(), padreId: subcajaDe });
    setNombreNuevaSubcaja("");
    setSubcajaDe(null);
  };

  const eliminarCaja = async (cajaId) => {
    if (!window.confirm("¿Eliminar esta caja? Los movimientos cargados en ella no se borran, pero quedan sin caja asignada.")) return;
    await deleteDoc(doc(db, "cajas", cajaId));
    if (cajaSeleccionada === cajaId) setCajaSeleccionada(null);
  };

  const guardarMovimiento = async (e) => {
    e.preventDefault();
    if (!form.cajaId) { alert("Elegí a qué caja pertenece este movimiento"); return; }
    const datos = { ...form, monto: Number(form.monto) };
    if (editando) {
      await updateDoc(doc(db, "movimientos_caja", editando), datos);
    } else {
      await addDoc(collection(db, "movimientos_caja"), datos);
    }
    setMostrarForm(false);
    setEditando(null);
    setForm(formVacio);
  };

  const abrirEditar = (m) => {
    setEditando(m.id);
    setForm({
      tipo: m.tipo, monto: m.monto, moneda: m.moneda, medio: m.medio,
      responsable: m.responsable, motivo: m.motivo, fecha: m.fecha, cajaId: m.cajaId || "",
    });
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const abrirNuevoParaCaja = (cajaId) => {
    setEditando(null);
    setForm({ ...formVacio, cajaId });
    setMostrarForm(true);
  };

  const cancelarForm = () => {
    setMostrarForm(false);
    setEditando(null);
    setForm(formVacio);
  };

  const badgeEstado = (estado) => {
    if (estado === "cobrado" || estado === "pagado") return "green";
    if (estado === "pendiente/estafa") return "red";
    return "amber";
  };

  const cajaActual = cajaSeleccionada ? getCajaPorId(cajaSeleccionada) : null;
  const esAuto = cajaActual?.auto;

  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">Caja</h2>
        <button className="btn-primary" onClick={() => setMostrarFormCaja(!mostrarFormCaja)}>
          {mostrarFormCaja ? "Cancelar" : "+ Nueva caja"}
        </button>
      </div>

      {mostrarFormCaja && (
        <div className="card" style={{ borderLeft: "3px solid #185FA5" }}>
          <form onSubmit={crearCaja} style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Nombre de la nueva caja</label>
              <input value={nombreNuevaCaja} onChange={(e) => setNombreNuevaCaja(e.target.value)} placeholder="Ej: Caja chica, Inversiones..." required />
            </div>
            <button type="submit" className="btn-primary">Crear</button>
          </form>
        </div>
      )}

      {/* Formulario de movimiento (se abre desde cualquier caja o desde "sin asignar") */}
      {mostrarForm && (
        <div className="card" style={{ borderLeft: "3px solid #185FA5" }}>
          <h3 className="card-title">{editando ? "Editar movimiento" : "Registrar movimiento manual"}</h3>
          <form onSubmit={guardarMovimiento}>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Caja</label>
                <select value={form.cajaId} onChange={(e) => setForm({ ...form, cajaId: e.target.value })} required>
                  <option value="" disabled>Elegí una caja</option>
                  {flatCajasOptions().map((o) => (<option key={o.id} value={o.id}>{o.label}</option>))}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                </select>
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Monto</label>
                <input type="number" min="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Moneda</label>
                <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                  <option value="ARS">Pesos (ARS)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Medio</label>
                <select value={form.medio} onChange={(e) => setForm({ ...form, medio: e.target.value })}>
                  <option>Efectivo</option>
                  <option>Transferencia</option>
                  <option>Tarjeta crédito</option>
                  <option>Tarjeta débito</option>
                  <option>Mercado Pago</option>
                </select>
              </div>
              <div className="form-group">
                <label>Responsable</label>
                <input value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} required />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Motivo / descripción</label>
                <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} required />
              </div>
            </div>
            <div className="total-preview">
              {form.tipo === "ingreso" ? "Ingreso" : "Egreso"}: <strong>{fmt(form.monto, form.moneda)}</strong>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" className="btn-primary">{editando ? "Guardar cambios" : "Guardar movimiento"}</button>
              <button type="button" className="btn-secondary" onClick={cancelarForm}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Grilla de cajas */}
      <div className="metrics-grid" style={{ marginBottom: "1.5rem" }}>
        {cajasTop.map((c) => {
          const bal = c.auto ? { [c.monedaFija]: balanceAuto(c.monedaFija) } : balanceTotal(c.id);
          const subcajas = getSubcajas(c.id);
          const esCustom = cajasCustom.some((cc) => cc.id === c.id);
          return (
            <div
              key={c.id}
              className="metric-card"
              style={{ cursor: "pointer", border: cajaSeleccionada === c.id ? "1.5px solid #185FA5" : undefined }}
              onClick={() => setCajaSeleccionada(c.id)}
            >
              <p className="metric-label">{c.nombre}{subcajas.length > 0 ? ` (${subcajas.length} subcajas)` : ""}</p>
              {c.auto ? (
                <p className="metric-value" style={{ color: bal[c.monedaFija] >= 0 ? "#1D9E75" : "#A32D2D" }}>
                  {fmt(bal[c.monedaFija], c.monedaFija)}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span className="metric-value" style={{ fontSize: "15px", color: bal.ARS >= 0 ? "#1D9E75" : "#A32D2D" }}>{fmt(bal.ARS, "ARS")}</span>
                  {bal.USD !== 0 && <span className="metric-value" style={{ fontSize: "15px", color: bal.USD >= 0 ? "#1D9E75" : "#A32D2D" }}>{fmt(bal.USD, "USD")}</span>}
                </div>
              )}
              {esCustom && (
                <button className="btn-xs" style={{ marginTop: "6px" }} onClick={(e) => { e.stopPropagation(); eliminarCaja(c.id); }}>
                  🗑 Eliminar
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Detalle de la caja seleccionada */}
      {cajaActual && (
        <div className="card" style={{ borderLeft: "3px solid #1D9E75", marginBottom: "1.5rem" }}>
          <div className="section-header" style={{ marginBottom: "1rem" }}>
            <h3 className="card-title" style={{ margin: 0 }}>{cajaActual.nombre}</h3>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn-secondary" onClick={() => setSubcajaDe(subcajaDe === cajaActual.id ? null : cajaActual.id)}>
                {subcajaDe === cajaActual.id ? "Cancelar" : "+ Subcaja"}
              </button>
              <button className="btn-primary" onClick={() => abrirNuevoParaCaja(cajaActual.id)}>+ Movimiento</button>
            </div>
          </div>

          {subcajaDe === cajaActual.id && (
            <form onSubmit={crearSubcaja} style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
              <input value={nombreNuevaSubcaja} onChange={(e) => setNombreNuevaSubcaja(e.target.value)} placeholder="Nombre de la subcaja" required style={{ flex: 1 }} />
              <button type="submit" className="btn-primary">Agregar</button>
            </form>
          )}

          {getSubcajas(cajaActual.id).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "1rem" }}>
              {getSubcajas(cajaActual.id).map((sub) => {
                const bal = balanceTotal(sub.id);
                return (
                  <div
                    key={sub.id}
                    onClick={() => setCajaSeleccionada(sub.id)}
                    style={{ cursor: "pointer", padding: "8px 12px", borderRadius: "8px", border: cajaSeleccionada === sub.id ? "1.5px solid #185FA5" : "1px solid #e0dfd8", fontSize: "13px" }}
                  >
                    <strong>{sub.nombre}</strong>
                    <div style={{ color: bal.ARS >= 0 ? "#1D9E75" : "#A32D2D" }}>{fmt(bal.ARS, "ARS")}</div>
                    {bal.USD !== 0 && <div style={{ color: bal.USD >= 0 ? "#1D9E75" : "#A32D2D" }}>{fmt(bal.USD, "USD")}</div>}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem", fontSize: "14px" }}>
            {esAuto ? (
              <span>Balance: <strong style={{ color: balanceAuto(cajaActual.monedaFija) >= 0 ? "#1D9E75" : "#A32D2D" }}>{fmt(balanceAuto(cajaActual.monedaFija), cajaActual.monedaFija)}</strong></span>
            ) : (
              <>
                <span>Balance ARS: <strong style={{ color: balanceTotal(cajaActual.id).ARS >= 0 ? "#1D9E75" : "#A32D2D" }}>{fmt(balanceTotal(cajaActual.id).ARS, "ARS")}</strong></span>
                <span>Balance USD: <strong style={{ color: balanceTotal(cajaActual.id).USD >= 0 ? "#1D9E75" : "#A32D2D" }}>{fmt(balanceTotal(cajaActual.id).USD, "USD")}</strong></span>
              </>
            )}
          </div>

          {esAuto && (
            <>
              <div className="metrics-grid" style={{ marginBottom: "1rem" }}>
                <div className="metric-card">
                  <p className="metric-label">Por cobrar</p>
                  <p className="metric-value" style={{ color: "#BA7517" }}>{fmt(porCobrarAuto(cajaActual.monedaFija), cajaActual.monedaFija)}</p>
                </div>
                <div className="metric-card">
                  <p className="metric-label">Por pagar</p>
                  <p className="metric-value" style={{ color: "#BA7517" }}>{fmt(porPagarAuto(cajaActual.monedaFija), cajaActual.monedaFija)}</p>
                </div>
                {estafasAuto(cajaActual.monedaFija) > 0 && (
                  <div className="metric-card">
                    <p className="metric-label">🚨 Estafas (no incluido)</p>
                    <p className="metric-value" style={{ color: "#A32D2D" }}>{fmt(estafasAuto(cajaActual.monedaFija), cajaActual.monedaFija)}</p>
                  </div>
                )}
              </div>

              <p className="card-title" style={{ marginBottom: "8px" }}>Movimientos de ventas y compras</p>
              <div className="table-wrap" style={{ marginBottom: "1rem" }}>
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>Tipo</th><th>Origen</th><th>Concepto</th><th>Responsable</th><th>Medio</th><th>Monto</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {movAutomaticos.filter((m) => m.moneda === cajaActual.monedaFija).map((m, i) => (
                      <tr key={i} style={m.estado === "pendiente/estafa" ? { background: "#FFF5F5" } : {}}>
                        <td>{m.fecha}</td>
                        <td><span className={`badge badge-${m.tipo === "ingreso" ? "green" : "red"}`}>{m.tipo}</span></td>
                        <td><span className="badge badge-blue">{m.motivo}</span></td>
                        <td>{m.concepto}</td>
                        <td>{m.responsable}</td>
                        <td>{m.medio}</td>
                        <td>{fmt(m.monto, m.moneda)}</td>
                        <td><span className={`badge badge-${badgeEstado(m.estado)}`}>{m.estado}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <p className="card-title" style={{ marginBottom: "8px" }}>Movimientos manuales{esAuto ? " cargados en esta caja" : ""}</p>
          {movsManualesDeCaja(cajaActual.id).length === 0 ? (
            <p className="empty">Sin movimientos todavía</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Moneda</th><th>Medio</th><th>Responsable</th><th>Motivo</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {[...movsManualesDeCaja(cajaActual.id)].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).map((m) => (
                    <tr key={m.id}>
                      <td>{m.fecha}</td>
                      <td><span className={`badge badge-${m.tipo === "ingreso" ? "green" : "red"}`}>{m.tipo}</span></td>
                      <td><strong>{fmt(m.monto, m.moneda)}</strong></td>
                      <td><span className={`badge badge-${m.moneda === "USD" ? "blue" : "green"}`}>{m.moneda}</span></td>
                      <td>{m.medio}</td>
                      <td>{m.responsable}</td>
                      <td>{m.motivo}</td>
                      <td><button className="btn-xs" onClick={() => abrirEditar(m)}>✏️ Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!cajaActual && <p className="empty">Hacé clic en una caja de arriba para ver el detalle, cargar movimientos y ver su balance.</p>}

      {/* Movimientos manuales viejos sin caja asignada */}
      {sinAsignar.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid #BA7517", marginTop: "1.5rem" }}>
          <h3 className="card-title">⚠️ Movimientos sin caja asignada ({sinAsignar.length})</h3>
          <p style={{ fontSize: "13px", color: "#888", marginBottom: "8px" }}>
            Estos movimientos son de antes de este cambio. Hacé clic en "Editar" para asignarlos a una caja.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Moneda</th><th>Responsable</th><th>Motivo</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {sinAsignar.map((m) => (
                  <tr key={m.id}>
                    <td>{m.fecha}</td>
                    <td><span className={`badge badge-${m.tipo === "ingreso" ? "green" : "red"}`}>{m.tipo}</span></td>
                    <td><strong>{fmt(m.monto, m.moneda)}</strong></td>
                    <td>{m.moneda}</td>
                    <td>{m.responsable}</td>
                    <td>{m.motivo}</td>
                    <td><button className="btn-xs" onClick={() => abrirEditar(m)}>✏️ Asignar caja</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Caja;