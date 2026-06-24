import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

function Caja() {
  const [ventas, setVentas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [filtros, setFiltros] = useState({
    desde: "", hasta: "", tipo: "", medio: "", moneda: "",
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

  const fmt = (n, moneda) => {
    const simbolo = moneda === "USD" ? "USD " : "$";
    return simbolo + Number(n || 0).toLocaleString("es-AR");
  };

  const movimientos = [
    ...ventas.map((v) => ({
      fecha: v.fecha,
      tipo: "ingreso",
      concepto: `${v.cliente} — ${v.producto}`,
      medio: v.medio || "—",
      monto: v.total || 0,
      moneda: v.moneda || "ARS",
      estado: v.pago === "pagado" ? "cobrado" : v.pago,
    })),
    ...compras.map((c) => ({
      fecha: c.fecha,
      tipo: "egreso",
      concepto: `${c.proveedorNombre} — ${c.producto}`,
      medio: c.medio || "Transferencia",
      monto: c.total || 0,
      moneda: c.moneda || "ARS",
      estado: c.pago === "pagado" ? "pagado" : "pendiente",
    })),
  ].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  const movFiltrados = movimientos.filter((m) => {
    if (filtros.desde && m.fecha < filtros.desde) return false;
    if (filtros.hasta && m.fecha > filtros.hasta) return false;
    if (filtros.tipo && m.tipo !== filtros.tipo) return false;
    if (filtros.medio && m.medio !== filtros.medio) return false;
    if (filtros.moneda && m.moneda !== filtros.moneda) return false;
    return true;
  });

  // Métricas ARS
  const ingresadosARS = movFiltrados.filter(m => m.tipo === "ingreso" && m.estado === "cobrado" && m.moneda !== "USD").reduce((a, m) => a + m.monto, 0);
  const egresadosARS = movFiltrados.filter(m => m.tipo === "egreso" && m.estado === "pagado" && m.moneda !== "USD").reduce((a, m) => a + m.monto, 0);
  const porCobrarARS = movFiltrados.filter(m => m.tipo === "ingreso" && m.estado !== "cobrado" && m.moneda !== "USD").reduce((a, m) => a + m.monto, 0);
  const porPagarARS = movFiltrados.filter(m => m.tipo === "egreso" && m.estado !== "pagado" && m.moneda !== "USD").reduce((a, m) => a + m.monto, 0);

  // Métricas USD
  const ingresadosUSD = movFiltrados.filter(m => m.tipo === "ingreso" && m.estado === "cobrado" && m.moneda === "USD").reduce((a, m) => a + m.monto, 0);
  const egresadosUSD = movFiltrados.filter(m => m.tipo === "egreso" && m.estado === "pagado" && m.moneda === "USD").reduce((a, m) => a + m.monto, 0);
  const porCobrarUSD = movFiltrados.filter(m => m.tipo === "ingreso" && m.estado !== "cobrado" && m.moneda === "USD").reduce((a, m) => a + m.monto, 0);
  const porPagarUSD = movFiltrados.filter(m => m.tipo === "egreso" && m.estado !== "pagado" && m.moneda === "USD").reduce((a, m) => a + m.monto, 0);

  // Desglose por medio de pago
  const medios = {};
  movFiltrados.forEach((m) => {
    const key = `${m.medio}___${m.moneda}`;
    if (!medios[key]) medios[key] = { medio: m.medio, moneda: m.moneda, ingresado: 0, egresado: 0 };
    if (m.tipo === "ingreso" && m.estado === "cobrado") medios[key].ingresado += m.monto;
    if (m.tipo === "egreso" && m.estado === "pagado") medios[key].egresado += m.monto;
  });

  return (
    <div className="section">
      <h2 className="section-title">Caja</h2>

      {/* Métricas ARS */}
      <p className="card-title" style={{ marginBottom: "8px" }}>Pesos (ARS)</p>
      <div className="metrics-grid" style={{ marginBottom: "1.25rem" }}>
        <div className="metric-card">
          <p className="metric-label">Ingresos cobrados</p>
          <p className="metric-value" style={{ color: "#1D9E75" }}>{fmt(ingresadosARS, "ARS")}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Egresos pagados</p>
          <p className="metric-value" style={{ color: "#A32D2D" }}>{fmt(egresadosARS, "ARS")}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Balance neto</p>
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

      {/* Métricas USD */}
      <p className="card-title" style={{ marginBottom: "8px" }}>Dólares (USD)</p>
      <div className="metrics-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="metric-card">
          <p className="metric-label">Ingresos cobrados</p>
          <p className="metric-value" style={{ color: "#1D9E75" }}>{fmt(ingresadosUSD, "USD")}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Egresos pagados</p>
          <p className="metric-value" style={{ color: "#A32D2D" }}>{fmt(egresadosUSD, "USD")}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Balance neto</p>
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

      {/* Filtros */}
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

      {/* Desglose por medio */}
      <div className="card">
        <h3 className="card-title">Desglose por medio de pago</h3>
        {Object.values(medios).map((d, i) => (
          <div key={i} className="list-item">
            <div>
              <p className="item-main">{d.medio}</p>
              <p className="item-sub">{d.moneda === "USD" ? "Dólares" : "Pesos"}</p>
            </div>
            <div style={{ display: "flex", gap: "1rem", fontSize: "13px" }}>
              <span>Ingresado: <strong style={{ color: "#1D9E75" }}>{fmt(d.ingresado, d.moneda)}</strong></span>
              <span>Egresado: <strong style={{ color: "#A32D2D" }}>{fmt(d.egresado, d.moneda)}</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabla movimientos */}
      <div className="card">
        <h3 className="card-title">Movimientos</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Tipo</th><th>Concepto</th>
                <th>Medio</th><th>Moneda</th><th>Monto</th><th>Estado</th>
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
                  <td>
                    <span className={`badge badge-${m.moneda === "USD" ? "blue" : "green"}`}>
                      {m.moneda}
                    </span>
                  </td>
                  <td>{fmt(m.monto, m.moneda)}</td>
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