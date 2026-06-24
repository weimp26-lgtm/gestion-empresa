import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";

function Compras() {
  const [compras, setCompras] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtros, setFiltros] = useState({
    desde: "", hasta: "", proveedor: "", pago: "", moneda: "",
  });
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    proveedorId: "",
    proveedorNombre: "",
    producto: "",
    cantidad: 1,
    costoUnit: 0,
    pago: "pagado",
    medio: "Transferencia",
    moneda: "ARS",
  });

  useEffect(() => {
    const unsubCompras = onSnapshot(collection(db, "compras"), (snap) => {
      setCompras(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubProv = onSnapshot(collection(db, "proveedores"), (snap) => {
      setProveedores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubCompras(); unsubProv(); };
  }, []);

  const fmt = (n, moneda) => {
    const simbolo = moneda === "USD" ? "USD " : "$";
    return simbolo + Number(n || 0).toLocaleString("es-AR");
  };

  const comprasFiltradas = compras.filter((c) => {
    if (filtros.desde && c.fecha < filtros.desde) return false;
    if (filtros.hasta && c.fecha > filtros.hasta) return false;
    if (filtros.proveedor && c.proveedorId !== filtros.proveedor) return false;
    if (filtros.pago && c.pago !== filtros.pago) return false;
    if (filtros.moneda && c.moneda !== filtros.moneda) return false;
    return true;
  });

  const totalARS = comprasFiltradas.filter(c => c.moneda !== "USD").reduce((a, c) => a + (c.total || 0), 0);
  const totalUSD = comprasFiltradas.filter(c => c.moneda === "USD").reduce((a, c) => a + (c.total || 0), 0);
  const pagadoARS = comprasFiltradas.filter(c => c.moneda !== "USD" && c.pago === "pagado").reduce((a, c) => a + (c.total || 0), 0);
  const pagadoUSD = comprasFiltradas.filter(c => c.moneda === "USD" && c.pago === "pagado").reduce((a, c) => a + (c.total || 0), 0);

  const abrirEditar = (c) => {
    setEditando(c.id);
    setForm({
      fecha: c.fecha,
      proveedorId: c.proveedorId || "",
      proveedorNombre: c.proveedorNombre || "",
      producto: c.producto || "",
      cantidad: c.cantidad || 1,
      costoUnit: c.costoUnit || 0,
      pago: c.pago || "pagado",
      medio: c.medio || "Transferencia",
      moneda: c.moneda || "ARS",
    });
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelar = () => {
    setMostrarForm(false);
    setEditando(null);
    setForm({
      fecha: new Date().toISOString().split("T")[0],
      proveedorId: "",
      proveedorNombre: "",
      producto: "",
      cantidad: 1,
      costoUnit: 0,
      pago: "pagado",
      medio: "Transferencia",
      moneda: "ARS",
    });
  };

  const guardarCompra = async (e) => {
    e.preventDefault();
    const total = Number(form.cantidad) * Number(form.costoUnit);
    const datos = {
      ...form,
      total,
      cantidad: Number(form.cantidad),
      costoUnit: Number(form.costoUnit),
    };

    if (editando) {
      await updateDoc(doc(db, "compras", editando), datos);
    } else {
      await addDoc(collection(db, "compras"), datos);
    }

    cancelar();
  };

  const marcarPagado = async (id) => {
    await updateDoc(doc(db, "compras", id), { pago: "pagado" });
  };

  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">Compras</h2>
        <button className="btn-primary" onClick={() => { cancelar(); setMostrarForm(!mostrarForm); }}>
          {mostrarForm ? "Cancelar" : "+ Nueva compra"}
        </button>
      </div>

      {mostrarForm && (
        <div className="card">
          <h3 className="card-title">{editando ? "Editar compra" : "Registrar compra"}</h3>
          <form onSubmit={guardarCompra}>
            <div className="form-grid">
              <div className="form-group">
                <label>Proveedor</label>
                <select
                  value={form.proveedorId}
                  onChange={(e) => {
                    const prov = proveedores.find((p) => p.id === e.target.value);
                    setForm({ ...form, proveedorId: e.target.value, proveedorNombre: prov?.empresa || "" });
                  }}
                  required
                >
                  <option value="">— seleccionar —</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>{p.empresa}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Producto</label>
                <input
                  value={form.producto}
                  onChange={(e) => setForm({ ...form, producto: e.target.value })}
                  placeholder="Ej: iPhone 17"
                  required
                />
              </div>
              <div className="form-group">
                <label>Cantidad</label>
                <input type="number" min="1" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Costo unitario</label>
                <input type="number" value={form.costoUnit} onChange={(e) => setForm({ ...form, costoUnit: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Moneda</label>
                <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                  <option value="ARS">Pesos (ARS)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Medio de pago</label>
                <select value={form.medio} onChange={(e) => setForm({ ...form, medio: e.target.value })}>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Efectivo">Efectivo</option>
                </select>
              </div>
              <div className="form-group">
                <label>Estado pago</label>
                <select value={form.pago} onChange={(e) => setForm({ ...form, pago: e.target.value })}>
                  <option value="pagado">Pagado</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </div>
            </div>
            <div className="total-preview">
              Total: <strong>{fmt(Number(form.cantidad) * Number(form.costoUnit), form.moneda)}</strong>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" className="btn-primary">
                {editando ? "Guardar cambios" : "Guardar compra"}
              </button>
              <button type="button" className="btn-secondary" onClick={cancelar}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

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
            <label>Proveedor</label>
            <select value={filtros.proveedor} onChange={(e) => setFiltros({ ...filtros, proveedor: e.target.value })}>
              <option value="">Todos</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.empresa}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Pago</label>
            <select value={filtros.pago} onChange={(e) => setFiltros({ ...filtros, pago: e.target.value })}>
              <option value="">Todos</option>
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
          <div className="form-group">
            <label>Moneda</label>
            <select value={filtros.moneda} onChange={(e) => setFiltros({ ...filtros, moneda: e.target.value })}>
              <option value="">Todas</option>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={() => setFiltros({ desde: "", hasta: "", proveedor: "", pago: "", moneda: "" })}>
            Limpiar
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Proveedor</th><th>Producto</th>
                <th>Cant.</th><th>Costo unit.</th><th>Total</th>
                <th>Moneda</th><th>Medio</th><th>Pago</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {[...comprasFiltradas].reverse().map((c) => (
                <tr key={c.id}>
                  <td>{c.fecha}</td>
                  <td>{c.proveedorNombre}</td>
                  <td>{c.producto}</td>
                  <td>{c.cantidad}</td>
                  <td>{fmt(c.costoUnit, c.moneda)}</td>
                  <td>{fmt(c.total, c.moneda)}</td>
                  <td><span className={`badge badge-${c.moneda === "USD" ? "blue" : "green"}`}>{c.moneda}</span></td>
                  <td>{c.medio}</td>
                  <td>
                    <span className={`badge badge-${c.pago === "pagado" ? "green" : "red"}`}>
                      {c.pago}
                    </span>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-xs" onClick={() => abrirEditar(c)}>✏️ Editar</button>
                      {c.pago !== "pagado" && (
                        <button className="btn-xs" onClick={() => marcarPagado(c.id)}>✓ Pagado</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>ARS: <strong>{fmt(totalARS, "ARS")}</strong></span>
          <span>Pagado ARS: <strong style={{ color: "#1D9E75" }}>{fmt(pagadoARS, "ARS")}</strong></span>
          <span>USD: <strong>{fmt(totalUSD, "USD")}</strong></span>
          <span>Pagado USD: <strong style={{ color: "#1D9E75" }}>{fmt(pagadoUSD, "USD")}</strong></span>
        </div>
      </div>
    </div>
  );
}

export default Compras;