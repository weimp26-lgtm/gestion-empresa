import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, addDoc } from "firebase/firestore";

function Caja() {
  const [ventas, setVentas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [movManuales, setMovManuales] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filtros, setFiltros] = useState({
    desde: "", hasta: "", tipo: "", medio: "", moneda: "",
  });

  const formVacio = {
    tipo: "ingreso",
    monto: 0,
    moneda: "ARS",
    medio: "Efectivo",
    responsable: "",
    motivo: "",
    fecha: new Date().toISOString().split("T")[0],
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
    return () => { unsubVentas(); unsubCompras(); unsubMov(); };
  }, []);

  const fmt = (n, moneda) => {
    const simbolo = moneda === "USD" ? "USD " : "$";
    return simbolo + Number(n || 0).toLocaleString("es-AR");
  };

  const guardarMovimiento = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "movimientos_caja"), {
      ...form,
      monto: Number(form.monto),
    });
    setMostrarForm(false);
    setForm(formVacio);
  };

  // Movimientos de ventas y compras
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
      origen: "venta",
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
      origen: "compra",
    })),
  ].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  // Movimientos manuales
  const movManualesOrdenados = [...movManuales].sort((a, b) =>
    (b.fecha || "").localeCompare(a.fecha || "")
  );

  // Filtrar movimientos automáticos
  const movFiltrados = movAutomaticos.filter((m) => {
    if (filtros.desde && m.fecha < filtros.desde) return false;
    if (filtros.hasta && m.fecha > filtros.hasta) return false;
    if (filtros.tipo && m.tipo !== filtros.tipo) return false;
    if (filtros.medio && m.medio !== filtros.medio) return false;
    if (filtros.moneda && m.moneda !== filtros.moneda) return false;
    return true;
  });

  // Métricas ARS — ventas y compras
  const ingresadosARS = movFiltrados.filter(m => m.tipo === "ingreso" && m.estado === "cobrado" && m.moneda !== "USD").reduce((a, m) => a + m.monto, 0);
  const egresadosARS = movFiltrados.filter(m => m.tipo === "egreso" && m.estado === "pagado" && m.moneda !== "USD").reduce((a, m) => a + m.monto, 0);
  const porCobrarARS = movFiltrados.filter(m => m.tipo === "ingreso" && m.estado === "pendiente" && m.moneda !== "USD").reduce((a, m) => a + m.monto, 0);
  const porPagarARS = movFiltrados.filter(m => m.tipo === "egreso" && m.estado !== "pagado" && m.moneda !== "USD").reduce((a, m) => a + m.monto, 0);
  const estafasARS = movFiltrados.filter(m => m.estado === "pendiente/estafa" && m.moneda !== "USD").reduce((a, m) => a + m.monto, 0);

  // Métricas USD — ventas y compras
  const ingresadosUSD = movFiltrados.filter(m => m.tipo === "ingreso" && m.estado === "cobrado" && m.moneda === "USD").reduce((a, m) => a + m.monto, 0);
  const egresadosUSD = movFiltrados.filter(m => m.tipo === "egreso" && m.estado === "pagado" && m.moneda === "USD").reduce((a, m) => a + m.monto, 0);
  const porCobrarUSD = movFiltrados.filter(m => m.tipo === "ingreso" && m.estado === "pendiente" && m.moneda === "USD").reduce((a, m) => a + m.monto, 0);
  const porPagarUSD = movFiltrados.filter(m => m.tipo === "egreso" && m.estado !== "pagado" && m.moneda === "USD").reduce((a, m) => a + m.monto, 0);
  const estafasUSD = movFiltrados.filter(m => m.estado === "pendiente/estafa" && m.moneda === "USD").reduce((a, m) => a + m.monto, 0);

  // Métricas manuales ARS y USD
  const manualIngARS = movManuales.filter(m => m.tipo === "ingreso" && m.moneda !== "USD").reduce((a, m) => a + m.monto, 0);
  const manualEgrARS = movManuales.filter(m => m.tipo === "egreso" && m.moneda !== "USD").reduce((a, m) => a + m.monto, 0);
  const manualIngUSD = movManuales.filter(m => m.tipo === "ingreso" && m.moneda === "USD").reduce((a, m) => a + m.monto, 0);
  const manualEgrUSD = movManuales.filter(m => m.tipo === "egreso" && m.moneda === "USD").reduce((a, m) => a + m.monto, 0);

  const badgeEstado = (estado) => {
    if (estado === "cobrado" || estado === "pagado") return "green";
    if (estado === "pendiente/estafa") return "red";
    return "amber";
  };

  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">Caja</h2>
        <button className="btn-primary" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? "Cancelar" : "+ Ingreso / Egreso manual"}
        </button>
      </div>

      {/* Formulario movimiento manual */}
      {mostrarForm && (
        <div className="card" style={{ borderLeft: "3px solid #185FA5" }}>
          <h3 className="card-title">Registrar movimiento manual</h3>
          <form onSubmit={guardarMovimiento}>
            <div className="form-grid">
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
                <input value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} placeholder="Nombre de quien lo hizo" required />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Motivo / descripción</label>
                <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ej: Préstamo, inversión inicial, retiro de caja..." required />
              </div>
            </div>
            <div className="total-preview">
              {form.tipo === "ingreso" ? "Ingreso" : "Egreso"}: <strong>{fmt(form.monto, form.moneda)}</strong>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" className="btn-primary">Guardar movimiento</button>
              <button type="button" className="btn-secondary" onClick={() => { setMostrarForm(false); setForm(formVacio); }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Alertas */}
      {(estafasARS > 0 || estafasUSD > 0) && (
        <div className="alert alert-red">
          🚨 Monto en estafas: {estafasARS > 0 && <strong>{fmt(estafasARS, "ARS")}</strong>} {estafasUSD > 0 && <strong>{fmt(estafasUSD, "USD")}</strong>} — no incluido en los balances
        </div>
      )}

      {/* Métricas ARS ventas/compras */}
      <p className="card-title" style={{ marginBottom: "8px" }}>Pesos (ARS) — ventas y compras</p>
      <div className="metrics-grid" style={{ marginBottom: "1rem" }}>
        <div className="metric-card">
          <p className="metric-label">Cobrado</p>
          <p className="metric-value" style={{ color: "#1D9E75" }}>{fmt(ingresadosARS, "ARS")}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Pagado a proveedores</p>
          <p className="metric-value" style={{ color: "#A32D2D" }}>{fmt(egresadosARS, "ARS")}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Balance ventas/compras</p>
          <p className="metric-value" style={{ color: ingresadosARS - egresadosARS >= 0 ? "#1D9E75" : "#A32D2D" }}>
            {fmt(ingresadosARS - egresadosARS, "ARS")}
          </p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Por cobrar</p>
          <p className="metric-value" style={{ color: "#BA7517" }}>{fmt(porCobrarARS, "ARS")}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Por pagar</p>
          <p className="metric-value" style={{ color: "#BA7517" }}>{fmt(porPagarARS, "ARS")}</p>
        </div>
      </div>

      {/* Métricas USD ventas/compras */}
      <p className="card-title" style={{ marginBottom: "8px" }}>Dólares (USD) — ventas y compras</p>
      <div className="metrics-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="metric-card">
          <p className="metric-label">Cobrado</p>
          <p className="metric-value" style={{ color: "#1D9E75" }}>{fmt(ingresadosUSD, "USD")}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Pagado a proveedores</p>
          <p className="metric-value" style={{ color: "#A32D2D" }}>{fmt(egresadosUSD, "USD")}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Balance ventas/compras</p>
          <p className="metric-value" style={{ color: ingresadosUSD - egresadosUSD >= 0 ? "#1D9E75" : "#A32D2D" }}>
            {fmt(ingresadosUSD - egresadosUSD, "USD")}
          </p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Por cobrar</p>
          <p className="metric-value" style={{ color: "#BA7517" }}>{fmt(porCobrarUSD, "USD")}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Por pagar</p>
          <p className="metric-value" style={{ color: "#BA7517" }}>{fmt(porPagarUSD, "USD")}</p>
        </div>
      </div>

      {/* Movimientos manuales resumen */}
      {movManuales.length > 0 && (
        <>
          <p className="card-title" style={{ marginBottom: "8px" }}>Movimientos manuales</p>
          <div className="metrics-grid" style={{ marginBottom: "1.5rem" }}>
            <div className="metric-card">
              <p className="metric-label">Ingresos manuales ARS</p>
              <p className="metric-value" style={{ color: "#1D9E75" }}>{fmt(manualIngARS, "ARS")}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Egresos manuales ARS</p>
              <p className="metric-value" style={{ color: "#A32D2D" }}>{fmt(manualEgrARS, "ARS")}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Balance manual ARS</p>
              <p className="metric-value" style={{ color: manualIngARS - manualEgrARS >= 0 ? "#1D9E75" : "#A32D2D" }}>
                {fmt(manualIngARS - manualEgrARS, "ARS")}
              </p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Ingresos manuales USD</p>
              <p className="metric-value" style={{ color: "#1D9E75" }}>{fmt(manualIngUSD, "USD")}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Egresos manuales USD</p>
              <p className="metric-value" style={{ color: "#A32D2D" }}>{fmt(manualEgrUSD, "USD")}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Balance manual USD</p>
              <p className="metric-value" style={{ color: manualIngUSD - manualEgrUSD >= 0 ? "#1D9E75" : "#A32D2D" }}>
                {fmt(manualIngUSD - manualEgrUSD, "USD")}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Filtros */}
      <div className="card">
        <h3 className="card-title">Filtros movimientos automáticos</h3>
        <div className="filters">
          <div className="form-group">
            <label>Desde</label>
            <input type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Hasta</label>
            <input type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}>
              <option value="">Todos</option>
              <option value="ingreso">Solo ingresos</option>
              <option value="egreso">Solo egresos</option>
            </select>
          </div>
          <div className="form-group">
            <label>Medio</label>
            <select value={filtros.medio} onChange={(e) => setFiltros({ ...filtros, medio: e.target.value })}>
              <option value="">Todos</option>
              <option>Efectivo</option>
              <option>Transferencia</option>
              <option>Tarjeta crédito</option>
              <option>Tarjeta débito</option>
              <option>Mercado Pago</option>
            </select>
          </div>
          <div className="form-group">
            <label>Moneda</label>
            <select value={filtros.moneda} onChange={(e) => setFiltros({ ...filtros, moneda: e.target.value })}>
              <option value="">Todas</option>
              <option value="ARS">Pesos (ARS)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={() => setFiltros({ desde: "", hasta: "", tipo: "", medio: "", moneda: "" })}>
            Limpiar
          </button>
        </div>
      </div>

      {/* Tabla movimientos manuales */}
      <div className="card" style={{ borderLeft: "3px solid #185FA5" }}>
        <h3 className="card-title">Movimientos manuales de caja</h3>
        {movManualesOrdenados.length === 0 ? (
          <p className="empty">Sin movimientos manuales todavía</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th><th>Tipo</th><th>Monto</th><th>Moneda</th>
                  <th>Medio</th><th>Responsable</th><th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movManualesOrdenados.map((m) => (
                  <tr key={m.id}>
                    <td>{m.fecha}</td>
                    <td>
                      <span className={`badge badge-${m.tipo === "ingreso" ? "green" : "red"}`}>
                        {m.tipo}
                      </span>
                    </td>
                    <td><strong>{fmt(m.monto, m.moneda)}</strong></td>
                    <td><span className={`badge badge-${m.moneda === "USD" ? "blue" : "green"}`}>{m.moneda}</span></td>
                    <td>{m.medio}</td>
                    <td>{m.responsable}</td>
                    <td>{m.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabla movimientos automáticos */}
      <div className="card">
        <h3 className="card-title">Movimientos de ventas y compras</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Tipo</th><th>Origen</th><th>Concepto</th>
                <th>Medio</th><th>Moneda</th><th>Monto</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {movFiltrados.map((m, i) => (
                <tr key={i} style={m.estado === "pendiente/estafa" ? { background: "#FFF5F5" } : {}}>
                  <td>{m.fecha}</td>
                  <td>
                    <span className={`badge badge-${m.tipo === "ingreso" ? "green" : "red"}`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td><span className="badge badge-gray">{m.motivo}</span></td>
                  <td>{m.concepto}</td>
                  <td>{m.medio}</td>
                  <td>
                    <span className={`badge badge-${m.moneda === "USD" ? "blue" : "green"}`}>
                      {m.moneda}
                    </span>
                  </td>
                  <td>{fmt(m.monto, m.moneda)}</td>
                  <td>
                    <span className={`badge badge-${badgeEstado(m.estado)}`}>
                      {m.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Caja;