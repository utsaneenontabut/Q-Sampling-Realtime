const API = "https://script.google.com/macros/s/AKfycbxqpVP_0BxZy-UwVqDFzqa_C_O8HjEZ_XWGwJ9-ZdP9fRli0YF-jNfu55TApzhfB91K3g/exec";

const $ = id => document.getElementById(id);
let allHistory = [];
let rooms = [];
let inspectors = [];
let scanStream = null;
let scanTimer = null;

document.addEventListener("DOMContentLoaded", async () => {
  bindTabs();
  $("status").addEventListener("change", updateCartonLabel);
  $("btnSave").addEventListener("click", saveSampling);
  $("btnRefresh").addEventListener("click", loadAll);
  $("txtSearch").addEventListener("input", renderHistoryFiltered);
  $("historyRoom").addEventListener("change", renderHistoryFiltered);
  $("historyStatus").addEventListener("change", renderHistoryFiltered);
  $("btnExport").addEventListener("click", exportExcel);
  $("addRoom").addEventListener("click", addRoom);
  $("addInspector").addEventListener("click", addInspector);
  $("scanButton").addEventListener("click", openScanner);
  $("closeScanner").addEventListener("click", closeScanner);
  $("useQrManual").addEventListener("click", useManualQr);
  updateCartonLabel();
  await loadMaster();
  await loadAll();
  setInterval(loadAll, 10000);
});

function bindTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".tabPanel").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      $(btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "historyTab") loadHistory();
      if (btn.dataset.tab === "settingsTab") renderSettings();
    });
  });
}

function updateCartonLabel() {
  $("cartonLabel").textContent =
    $("status").value === "Finish Sampling" ? "Carton Qty OUT" : "Carton Qty IN";
}

async function getJson(url) {
  const res = await fetch(url, {cache: "no-store"});
  return await res.json();
}

async function postJson(body) {
  const res = await fetch(API, {
    method: "POST",
    headers: {"Content-Type": "text/plain;charset=utf-8"},
    body: JSON.stringify(body)
  });
  return await res.json();
}

async function loadMaster() {
  try {
    const [r, i] = await Promise.all([
      getJson(API + "?action=rooms"),
      getJson(API + "?action=inspectors")
    ]);
    if (!r.success) throw new Error(r.message);
    if (!i.success) throw new Error(i.message);
    rooms = r.data || [];
    inspectors = i.data || [];
    fillMasters();
    setOnline();
  } catch (e) {
    setOffline();
    toast("โหลด Room/Inspector ไม่สำเร็จ", "error");
  }
}

function fillMasters() {
  $("room").innerHTML = rooms.length
    ? rooms.map(x => `<option value="${esc(x.room)}">${esc(x.room)}</option>`).join("")
    : `<option value="">ไม่มี Room</option>`;

  $("inspector").innerHTML = inspectors.length
    ? inspectors.map(x => `<option value="${esc(x.inspector)}">${esc(x.inspector)}</option>`).join("")
    : `<option value="">ไม่มี Inspector</option>`;

  $("historyRoom").innerHTML =
    `<option value="">ทุกห้อง</option>` +
    rooms.map(x => `<option value="${esc(x.room)}">${esc(x.room)}</option>`).join("");
}

async function loadAll() {
  try {
    const [dash, hist] = await Promise.all([
      getJson(API + "?action=dashboard"),
      getJson(API + "?action=history")
    ]);
    if (!dash.success) throw new Error(dash.message);
    if (!hist.success) throw new Error(hist.message);
    renderDashboard(dash.data);
    allHistory = hist.data || [];
    renderHistoryFiltered();
    setOnline();
  } catch (e) {
    console.error(e);
    setOffline();
  }
}

function renderDashboard(data) {
  const sampling = data.samplingNow || [];
  const completed = data.completedToday || [];
  $("samplingNow").textContent = sampling.length;
  $("completedToday").textContent = completed.length;
  $("totalToday").textContent = data.totalToday || 0;

  $("roomContainer").innerHTML = (data.roomStatus || []).map(r => `
    <button class="roomCard ${r.active ? "busy" : "free"}" onclick="filterRoom('${escAttr(r.room)}')">
      <div class="roomName">${esc(r.room)}</div>
      <div class="roomStatus">${r.active ? "🟠 กำลัง Sampling" : "🟢 ว่าง"}</div>
      <div class="roomCount">${r.count ? r.count + " งาน" : ""}</div>
    </button>
  `).join("");

  $("nowBody").innerHTML = sampling.length ? sampling.map(x => `
    <tr>
      <td>${esc(x.room)}</td>
      <td>${esc(x.code)}</td>
      <td>${esc(x.batch)}</td>
      <td>${esc(x.inspector)}</td>
      <td><span class="badge sampling">Sampling</span></td>
    </tr>
  `).join("") : `<tr><td colspan="5" class="empty">ไม่มีงานที่กำลัง Sampling</td></tr>`;
}

function filterRoom(room) {
  document.querySelector('[data-tab="historyTab"]').click();
  $("historyRoom").value = room;
  renderHistoryFiltered();
}

async function loadHistory() {
  try {
    const json = await getJson(API + "?action=history");
    if (!json.success) throw new Error(json.message);
    allHistory = json.data || [];
    renderHistoryFiltered();
  } catch (e) {
    toast("โหลดประวัติไม่สำเร็จ", "error");
  }
}

function renderHistoryFiltered() {
  const key = $("txtSearch").value.trim().toLowerCase();
  const room = $("historyRoom").value;
  const status = $("historyStatus").value;

  const data = allHistory.filter(x => {
    const text = [x.code, x.batch, x.room, x.inspector, x.status, x.noCarton].join(" ").toLowerCase();
    return (!key || text.includes(key)) &&
           (!room || x.room === room) &&
           (!status || x.status === status);
  });

  $("historyBody").innerHTML = data.length ? data.map(x => `
    <tr>
      <td>${fmtDate(x.date)}</td>
      <td>${esc(x.room)}</td>
      <td>${esc(x.code)}</td>
      <td>${esc(x.batch)}</td>
      <td>${fmtTime(x.startTime)}</td>
      <td>${fmtTime(x.finishTime)}</td>
      <td>${x.duration === "" || x.duration == null ? "-" : esc(String(x.duration)) + " min"}</td>
      <td><span class="badge ${x.status === "Sampling" ? "sampling" : "completed"}">${esc(x.status)}</span></td>
      <td>${esc(x.inspector)}</td>
    </tr>
  `).join("") : `<tr><td colspan="9" class="empty">ไม่พบข้อมูล</td></tr>`;
}

async function saveSampling() {
  const btn = $("btnSave");
  if (btn.disabled) return;

  const isFinish = $("status").value === "Finish Sampling";
  const code = $("code").value.trim();
  const batch = $("batch").value.trim();

  if (!code) return toast("กรุณากรอก Code", "error");
  if (!batch) return toast("กรุณากรอก Batch", "error");
  if (!isFinish && !$("room").value) return toast("กรุณาเลือก Room", "error");
  if (!isFinish && !$("inspector").value) return toast("กรุณาเลือก Inspector", "error");

  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const body = {
      action: isFinish ? "finishSampling" : "startSampling",
      room: $("room").value,
      inspector: $("inspector").value,
      code,
      batch,
      noCarton: $("noCarton").value.trim()
    };

    if (isFinish) body.cartonOut = $("cartonQty").value;
    else body.cartonIn = $("cartonQty").value;

    const json = await postJson(body);
    if (!json.success) throw new Error(json.message);

    toast(json.message, "success");
    $("code").value = "";
    $("batch").value = "";
    $("cartonQty").value = "";
    $("noCarton").value = "";
    await loadAll();
  } catch (e) {
    toast(e.message || "บันทึกไม่สำเร็จ", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "SAVE";
  }
}

async function addRoom() {
  const room = $("newRoom").value.trim();
  if (!room) return toast("กรุณากรอกชื่อ Room", "error");
  const json = await postJson({action: "addRoom", room});
  if (!json.success) return toast(json.message, "error");
  $("newRoom").value = "";
  toast(json.message, "success");
  await loadMaster();
  renderSettings();
}

async function deleteRoom(room) {
  if (!confirm(`ปิดใช้งาน Room ${room} ?`)) return;
  const json = await postJson({action: "deleteRoom", room});
  if (!json.success) return toast(json.message, "error");
  toast(json.message, "success");
  await loadMaster();
  renderSettings();
}

async function addInspector() {
  const inspector = $("newInspector").value.trim();
  if (!inspector) return toast("กรุณากรอกชื่อ Inspector", "error");
  const json = await postJson({action: "addInspector", inspector});
  if (!json.success) return toast(json.message, "error");
  $("newInspector").value = "";
  toast(json.message, "success");
  await loadMaster();
  renderSettings();
}

async function deleteInspector(inspector) {
  if (!confirm(`ปิดใช้งาน Inspector ${inspector} ?`)) return;
  const json = await postJson({action: "deleteInspector", inspector});
  if (!json.success) return toast(json.message, "error");
  toast(json.message, "success");
  await loadMaster();
  renderSettings();
}

function renderSettings() {
  $("roomSettings").innerHTML = rooms.map(x => `
    <div class="masterRow"><span>${esc(x.room)}</span>
      <button class="dangerBtn" onclick="deleteRoom('${escAttr(x.room)}')">ปิดใช้งาน</button>
    </div>
  `).join("") || `<div class="empty">ไม่มี Room</div>`;

  $("inspectorSettings").innerHTML = inspectors.map(x => `
    <div class="masterRow"><span>${esc(x.inspector)}</span>
      <button class="dangerBtn" onclick="deleteInspector('${escAttr(x.inspector)}')">ปิดใช้งาน</button>
    </div>
  `).join("") || `<div class="empty">ไม่มี Inspector</div>`;
}

function exportExcel() {
  if (!allHistory.length) return toast("ไม่มีข้อมูลสำหรับ Export", "error");

  const headers = ["Date","Room","Code","Batch","CartonQtyIN","CartonQtyOUT","NoCarton","StartTime","FinishTime","Duration","Status","Inspector"];
  const rows = allHistory.map(x => [
    fmtDateTime(x.date), x.room, x.code, x.batch, x.cartonIn, x.cartonOut, x.noCarton,
    fmtDateTime(x.startTime), fmtDateTime(x.finishTime), x.duration, x.status, x.inspector
  ]);
  const csv = "\uFEFF" + [headers, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], {type: "text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Q-Sampling-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(v) {
  const s = String(v == null ? "" : v);
  return `"${s.replaceAll('"','""')}"`;
}

/* QR: native BarcodeDetector when available */
async function openScanner() {
  $("scannerModal").classList.remove("hidden");
  if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
    $("scanHint").textContent = "อุปกรณ์นี้ไม่รองรับการสแกนกล้องอัตโนมัติ สามารถวางข้อความ QR ในช่องแล้วกดใช้ข้อมูลนี้";
    return;
  }

  try {
    const detector = new BarcodeDetector({formats: ["qr_code"]});
    scanStream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: "environment"}}});
    $("qrVideo").srcObject = scanStream;
    await $("qrVideo").play();

    scanTimer = setInterval(async () => {
      try {
        const codes = await detector.detect($("qrVideo"));
        if (codes.length && codes[0].rawValue) {
          useQrText(codes[0].rawValue);
          closeScanner();
        }
      } catch (_) {}
    }, 500);
  } catch (e) {
    $("scanHint").textContent = "เปิดกล้องไม่ได้ กรุณาอนุญาต Camera หรือวางข้อความ QR เอง";
  }
}

function useManualQr() {
  const value = $("qrManual").value.trim();
  if (!value) return toast("กรุณาใส่ข้อความ QR", "error");
  useQrText(value);
  closeScanner();
}

function useQrText(raw) {
  // รองรับ JSON: {"code":"ABC","batch":"LOT001"}
  try {
    const obj = JSON.parse(raw);
    if (obj.code) $("code").value = obj.code;
    if (obj.batch) $("batch").value = obj.batch;
    toast("อ่าน QR สำเร็จ", "success");
    return;
  } catch (_) {}

  // รองรับ Code|Batch หรือ Code,Batch
  let parts = raw.split("|");
  if (parts.length < 2) parts = raw.split(",");
  if (parts.length >= 2) {
    $("code").value = parts[0].trim();
    $("batch").value = parts[1].trim();
    toast("อ่าน QR สำเร็จ", "success");
  } else {
    $("code").value = raw;
    toast("อ่าน QR แล้ว ใส่ Batch เพิ่ม", "success");
  }
}

function closeScanner() {
  if (scanTimer) clearInterval(scanTimer);
  scanTimer = null;
  if (scanStream) scanStream.getTracks().forEach(t => t.stop());
  scanStream = null;
  $("qrVideo").srcObject = null;
  $("scannerModal").classList.add("hidden");
}

function setOnline() {
  $("serverStatus").className = "statusPill online";
  $("serverStatus").textContent = "🟢 Connected";
}

function setOffline() {
  $("serverStatus").className = "statusPill offline";
  $("serverStatus").textContent = "🔴 Offline";
}

function toast(message, type="success") {
  const el = $("toast");
  el.textContent = message;
  el.className = `toast show ${type}`;
  setTimeout(() => el.classList.remove("show"), 2800);
}

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d) ? "-" : d.toLocaleDateString("th-TH");
}

function fmtTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d) ? "-" : d.toLocaleTimeString("th-TH", {hour:"2-digit", minute:"2-digit"});
}

function fmtDateTime(v) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleString("th-TH");
}

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function escAttr(v) {
  return esc(v).replace(/`/g, "&#096;");
}

window.filterRoom = filterRoom;
window.deleteRoom = deleteRoom;
window.deleteInspector = deleteInspector;
