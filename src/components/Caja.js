import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

function Caja() {
  const [ventas, setVentas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [filtros, setFiltros] = useState({
    desde: "", hasta: "", tipo: "", medio: "",
  });

  useEffect(() => {
    const unsubVentas = onSnapshot(collection(db, "ventas"), (snap) => {
      setVentas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubCompras = onSnapshot(collection(db, "compras"), (snap) => {
      setCompras(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubVentas(); unsubCompras(); };
  }, []);

  const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-AR");

  const movimientos = [
    ...ventas.map((v) => ({
      fecha: v.fecha,
      tipo: "ingreso",
      concepto: `${v.cliente} — ${v.producto}`,
      medio: v.medio,
      monto: v.total || 0,
      estado: v.pago === "pagado" ? "cobrado" : v.pago,
    })),
    ...compras.map((c) => ({
      fecha: c.fecha,
      tipo: "egreso",
      concepto: `${c.proveedorNombre} — ${c.producto}`,
      medio: "Transferencia",
      monto: c.total || 0,
      estado: c.pago === "pagado" ? "pagado" : "pendiente",
    })),
  ].sort((a, b) => b.fecha?.localeCompare(a.fecha));

  const movFiltrados = movimientos.filter((m) => {
    if (filtros.desde && m.fecha < filtros.desde) return false;
    if (filtros.hasta && m.fecha > filtros.hasta) return false;
    if (filtros.tipo && m.tipo !== filtros.tipo) return false;
    if (filtros.medio && m.medio !== filtros.medio) return false;
    return true;
  });

  const ingresados = movFiltrados
    .filter((m) => m.tipo === "ingreso" && m.estado === "cobrado")
    .reduce((a, m) => a + m.monto, 0);

  const egresados = movFiltrados
    .filter((m) => m.tipo === "egreso" && m.estado === "pagado")
    .reduce((a, m) => a + m.monto, 0);

  const porCobrar = movFiltrados
    .filter((m) => m.tipo === "ingreso" && m.estado !== "cobrado")
    .reduce((a, m) => a + m.monto, 0);

  const porPagar = movFiltrados
    .filter((m) => m.tipo === "egreso" && m.estado !== "pagado")
    .reduce((a, m) => a + m.monto, 0);

  const medios = {};
  movFiltrados.forEach((m) => {
    if (!medios[m.medio]) medios[m.medio] = { ingresado: 0, egresado: 0 };
    if (m.tipo === "ingreso" && m.estado === "cobrado") medios[m.medio].ingresado += m.monto;
    if (m.tipo === "egreso" && m.estado === "pagado") medios[m.medio].egresado += m.monto;
  });

  return (
    <div className="section">
      <h2 className="section-title">Caja</h2>

      <div className="metrics-grid">
        <div className="metric-card">
          <p className="metric-label">Ingresos cobrados</p>
          <p className="metric-value" style={{ color: "#1D9E75" }}>{fmt(ingresados)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Egresos pagados</p>
          <p className="metric-value" style={{ color: "#A32D2D" }}>{fmt(egresados)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Balance neto</p>
          <p className="metric-value" style={{ color: ingresados - egresados >= 0 ? "#1D9E75" : "#A32D2D" }}>
            {fmt(ingresados - egresados)}
          </p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Por cobrar</p>
          <p className="metric-value" style={{ color: "#BA7517" }}>{fmt(porCobrar)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Por pagar</p>
          <p className="metric-value" style={{ color: "#BA7517" }}>{fmt(porPagar)}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Filtros</h3>
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
            <label>Medio de pago</label>
            <select value={filtros.medio} onChange={(e) => setFiltros({ ...filtros, medio: e.target.value })}>
              <option value="">Todos</option>
              <option>Efectivo</option>
              <option>Transferencia</option>
              <option>Tarjeta crédito</option>
              <option>Tarjeta débito</option>
              <option>Mercado Pago</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={() => setFiltros({ desde: "", hasta: "", tipo: "", medio: "" })}>
            Limpiar
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Desglose por medio de pago</h3>
        {Object.entries(medios).map(([medio, d]) => (
          <div key={medio} className="list-item">
            <p className="item-main">{medio}</p>
            <div style={{ display: "flex", gap: "1rem", fontSize: "13px" }}>
              <span>Ingresado: <strong style={{ color: "#1D9E75" }}>{fmt(d.ingresado)}</strong></span>
              <span>Egresado: <strong style={{ color: "#A32D2D" }}>{fmt(d.egresado)}</strong></span>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="card-title">Movimientos</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Tipo</th><th>Concepto</th>
                <th>Medio</th><th>Monto</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {movFiltrados.map((m, i) => (
                <tr key={i}>
                  <td>{m.fecha}</td>
                  <td>
                    <span className={`badge badge-${m.tipo === "ingreso" ? "green" : "red"}`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td>{m.concepto}</td>
                  <td>{m.medio}</td>
                  <td>{fmt(m.monto)}</td>
                  <td>
                    <span className={`badge badge-${m.estado === "cobrado" || m.estado === "pagado" ? "green" : "amber"}`}>
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