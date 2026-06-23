import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";

function Ventas() {
  const [ventas, setVentas] = useState([]);
  const [stock, setStock] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filtros, setFiltros] = useState({
    desde: "", hasta: "", cliente: "", pago: "", entrega: "", medio: "",
  });
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    cliente: "",
    producto: "",
    cantidad: 1,
    precio: 0,
    medio: "Efectivo",
    pago: "pagado",
    entrega: "entregado",
  });

  useEffect(() => {
    const unsubVentas = onSnapshot(collection(db, "ventas"), (snap) => {
      setVentas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubStock = onSnapshot(collection(db, "stock"), (snap) => {
      setStock(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubVentas(); unsubStock(); };
  }, []);

  const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-AR");

  const ventasFiltradas = ventas.filter((v) => {
    if (filtros.desde && v.fecha < filtros.desde) return false;
    if (filtros.hasta && v.fecha > filtros.hasta) return false;
    if (filtros.cliente && !v.cliente?.toLowerCase().includes(filtros.cliente.toLowerCase())) return false;
    if (filtros.pago && v.pago !== filtros.pago) return false;
    if (filtros.entrega && v.entrega !== filtros.entrega) return false;
    if (filtros.medio && v.medio !== filtros.medio) return false;
    return true;
  });

  const totalFiltrado = ventasFiltradas.reduce((a, v) => a + (v.total || 0), 0);
  const cobradoFiltrado = ventasFiltradas.filter((v) => v.pago === "pagado").reduce((a, v) => a + (v.total || 0), 0);

  const guardarVenta = async (e) => {
    e.preventDefault();
    const total = Number(form.cantidad) * Number(form.precio);
    await addDoc(collection(db, "ventas"), { ...form, total, cantidad: Number(form.cantidad), precio: Number(form.precio) });
    const prod = stock.find((s) => s.nombre === form.producto);
    if (prod) {
      await updateDoc(doc(db, "stock", prod.id), { qty: Math.max(0, (prod.qty || 0) - Number(form.cantidad)) });
    }
    setMostrarForm(false);
    setForm({ fecha: new Date().toISOString().split("T")[0], cliente: "", producto: "", cantidad: 1, precio: 0, medio: "Efectivo", pago: "pagado", entrega: "entregado" });
  };

  const marcarEntregado = async (id) => {
    await updateDoc(doc(db, "ventas", id), { entrega: "entregado" });
  };

  const marcarPagado = async (id) => {
    await updateDoc(doc(db, "ventas", id), { pago: "pagado" });
  };

  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">Ventas</h2>
        <button className="btn-primary" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? "Cancelar" : "+ Nueva venta"}
        </button>
      </div>

      {mostrarForm && (
        <div className="card">
          <h3 className="card-title">Registrar venta</h3>
          <form onSubmit={guardarVenta}>
            <div className="form-grid">
              <div className="form-group">
                <label>Cliente</label>
                <input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Producto</label>
                <select value={form.producto} onChange={(e) => {
                  const prod = stock.find((s) => s.nombre === e.target.value);
                  setForm({ ...form, producto: e.target.value, precio: prod?.precio || 0 });
                }}>
                  <option value="">— seleccionar —</option>
                  {stock.map((s) => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Cantidad</label>
                <input type="number" min="1" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Precio unitario</label>
                <input type="number" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Medio de pago</label>
                <select value={form.medio} onChange={(e) => setForm({ ...form, medio: e.target.value })}>
                  <option>Efectivo</option>
                  <option>Transferencia</option>
                  <option>Tarjeta crédito</option>
                  <option>Tarjeta débito</option>
                  <option>Mercado Pago</option>
                </select>
              </div>
              <div className="form-group">
                <label>Estado pago</label>
                <select value={form.pago} onChange={(e) => setForm({ ...form, pago: e.target.value })}>
                  <option value="pagado">Pagado</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="parcial">Parcial</option>
                </select>
              </div>
              <div className="form-group">
                <label>Estado entrega</label>
                <select value={form.entrega} onChange={(e) => setForm({ ...form, entrega: e.target.value })}>
                  <option value="entregado">Entregado</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="programado">Programado</option>
                </select>
              </div>
            </div>
            <div className="total-preview">
              Total: <strong>{fmt(Number(form.cantidad) * Number(form.precio))}</strong>
            </div>
            <button type="submit" className="btn-primary">Guardar venta</button>
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
            <label>Cliente</label>
            <input placeholder="Buscar..." value={filtros.cliente} onChange={(e) => setFiltros({ ...filtros, cliente: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Pago</label>
            <select value={filtros.pago} onChange={(e) => setFiltros({ ...filtros, pago: e.target.value })}>
              <option value="">Todos</option>
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
            </select>
          </div>
          <div className="form-group">
            <label>Entrega</label>
            <select value={filtros.entrega} onChange={(e) => setFiltros({ ...filtros, entrega: e.target.value })}>
              <option value="">Todos</option>
              <option value="entregado">Entregado</option>
              <option value="pendiente">Pendiente</option>
              <option value="programado">Programado</option>
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
          <button className="btn-secondary" onClick={() => setFiltros({ desde: "", hasta: "", cliente: "", pago: "", entrega: "", medio: "" })}>
            Limpiar
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Cliente</th><th>Producto</th><th>Cant.</th>
                <th>Total</th><th>Entrega</th><th>Pago</th><th>Medio</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {[...ventasFiltradas].reverse().map((v) => (
                <tr key={v.id}>
                  <td>{v.fecha}</td>
                  <td>{v.cliente}</td>
                  <td>{v.producto}</td>
                  <td>{v.cantidad}</td>
                  <td>{fmt(v.total)}</td>
                  <td><span className={`badge badge-${v.entrega === "entregado" ? "green" : v.entrega === "programado" ? "blue" : "amber"}`}>{v.entrega}</span></td>
                  <td><span className={`badge badge-${v.pago === "pagado" ? "green" : v.pago === "parcial" ? "amber" : "red"}`}>{v.pago}</span></td>
                  <td>{v.medio}</td>
                  <td>
                    <div className="action-btns">
                      {v.entrega !== "entregado" && <button className="btn-xs" onClick={() => marcarEntregado(v.id)}>✓ Entregado</button>}
                      {v.pago !== "pagado" && <button className="btn-xs" onClick={() => marcarPagado(v.id)}>✓ Pagado</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>Total: <strong>{fmt(totalFiltrado)}</strong></span>
          <span>Cobrado: <strong style={{color:"#1D9E75"}}>{fmt(cobradoFiltrado)}</strong></span>
          <span>Pendiente: <strong style={{color:"#BA7517"}}>{fmt(totalFiltrado - cobradoFiltrado)}</strong></span>
        </div>
      </div>
    </div>
  );
}

export default Ventas;