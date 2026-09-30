const API="https://script.google.com/macros/s/AKfycbzjFU-GS5vyCESo4tji-g1g52f73uodE7SFFO1U13cRN88bcSiklfARWfbi5V2KhrsCLg/exec";

const $=id=>document.getElementById(id);

let allHistory=[];
let rooms=[];
let inspectors=[];
let supervisors=[];

let pinUnlocked=false;
let hasPin=false;
let pinSession="";
let pendingProtectedTab="";

let scanStream=null;
let scanTimer=null;
let scanCanvas=null;
let scanCtx=null;


/* =========================================================
   START
========================================================= */

document.addEventListener("DOMContentLoaded",async()=>{

  bindTabs();

  if($("startModeBtn"))
    $("startModeBtn").onclick=()=>setMode("Start Sampling");

  if($("finishModeBtn"))
    $("finishModeBtn").onclick=()=>setMode("Finish Sampling");

  if($("btnSave"))
    $("btnSave").onclick=saveSampling;

  if($("btnRefresh"))
    $("btnRefresh").onclick=loadAll;

  if($("btnSupervisorRefresh"))
    $("btnSupervisorRefresh").onclick=loadSupervisor;

  if($("closePin"))
    $("closePin").onclick=closePinModal;

  if($("pinSubmit"))
    $("pinSubmit").onclick=submitPin;

  if($("savePin"))
    $("savePin").onclick=savePin;

  if($("txtSearch"))
    $("txtSearch").oninput=renderHistory;

  if($("historyRoom"))
    $("historyRoom").onchange=renderHistory;

  if($("historyStatus"))
    $("historyStatus").onchange=renderHistory;

  if($("supervisorRoom"))
    $("supervisorRoom").onchange=renderSupervisor;

  if($("approveBy"))
    $("approveBy").onchange=renderSupervisor;

  if($("btnExport"))
    $("btnExport").onclick=exportCSV;

  if($("addRoom"))
    $("addRoom").onclick=addRoom;

  if($("addInspector"))
    $("addInspector").onclick=addInspector;

  if($("addSupervisor"))
    $("addSupervisor").onclick=addSupervisor;

  if($("scanButton"))
    $("scanButton").onclick=openScanner;

  if($("closeScanner"))
    $("closeScanner").onclick=closeScanner;

  if($("useQrManual"))
    $("useQrManual").onclick=useManualQr;


  /* CODE / BATCH uppercase */

  ["code","batch"].forEach(id=>{
    const e=$(id);

    if(e){
      e.addEventListener("input",x=>{
        x.target.value=x.target.value.toUpperCase();
      });
    }
  });


  /* START calculation */

  [
    "incomingCarton",
    "remainderCartonIn",
    "remainderQtyIn",
    "qtyFullCartonIn"
  ].forEach(id=>{
    const e=$(id);
    if(e)e.addEventListener("input",calcStart);
  });


  /* FINISH calculation */

  [
    "remainderCartonOut",
    "remainderQtyOut",
    "fullCartonOut",
    "qtyFullCartonOut",
    "sampleUsage",
    "totalCartonOut"
  ].forEach(id=>{
    const e=$(id);
    if(e)e.addEventListener("input",calcFinish);
  });


  if($("unit"))
    $("unit").onchange=updateUnitLabels;


  setMode("Start Sampling");


  await loadMaster();
  await loadAll();


  /* Service Worker */

  if("serviceWorker" in navigator){
    navigator.serviceWorker
      .register("./service-worker.js")
      .catch(()=>{});
  }


  /* realtime refresh */

  setInterval(loadAll,15000);

});


/* =========================================================
   TABS
========================================================= */

function bindTabs(){

  document.querySelectorAll(".tab").forEach(b=>{

    b.onclick=()=>{

      const id=b.dataset.tab;

      if(
        id==="supervisorTab" ||
        id==="settingsTab"
      ){
        openProtectedTab(id);
        return;
      }

      activateTab(id);

    };

  });

}


function activateTab(id){

  document
    .querySelectorAll(".tab")
    .forEach(x=>x.classList.remove("active"));

  document
    .querySelectorAll(".tabPanel")
    .forEach(x=>x.classList.remove("active"));


  const btn=document.querySelector(
    `[data-tab="${id}"]`
  );

  if(btn)
    btn.classList.add("active");


  const panel=$(id);

  if(panel)
    panel.classList.add("active");


  if(id==="historyTab")
    loadHistory();


  if(id==="supervisorTab")
    loadSupervisor();


  if(id==="settingsTab")
    renderSettings();

}


/* =========================================================
   SUPERVISOR / APPROVE
========================================================= */

async function loadSupervisor(){

  try{

    const h=await getJson(
      API+"?action=history"
    );

    if(h.success){

      allHistory=h.data||[];

      renderSupervisor();

    }

  }catch(_){}

}


/* =========================================================
   PIN
========================================================= */

function openProtectedTab(id){

  pendingProtectedTab=id;


  if(!hasPin){

    if(id==="settingsTab"){

      openPinSetup();

    }else{

      toast(
        "ยังไม่ได้ตั้ง PIN กรุณาเข้า Settings เพื่อตั้ง PIN ก่อน",
        "error"
      );

      activateTab("samplingTab");

    }

    return;
  }


  if($("pinTitle"))
    $("pinTitle").textContent="🔐 กรุณาใส่ PIN";

  if($("pinMessage")){

    $("pinMessage").textContent=
      id==="supervisorTab"
      ?"ต้องใส่ PIN ก่อนเข้า Approve"
      :"ต้องใส่ PIN ก่อนเข้า Settings";

  }

  if($("pinLabel"))
    $("pinLabel").textContent="PIN";


  if($("pinInput"))
    $("pinInput").value="";

  if($("pinConfirm"))
    $("pinConfirm").value="";

  if($("pinNewWrap"))
    $("pinNewWrap").classList.add("hidden");

  if($("pinSubmit"))
    $("pinSubmit").textContent="ยืนยัน";

  if($("pinModal"))
    $("pinModal").classList.remove("hidden");


  setTimeout(()=>{
    if($("pinInput"))
      $("pinInput").focus();
  },80);

}


function openPinSetup(){

  pendingProtectedTab="settingsTab";


  if($("pinTitle"))
    $("pinTitle").textContent="🔐 ตั้ง PIN ครั้งแรก";

  if($("pinMessage"))
    $("pinMessage").textContent=
      "ตั้ง PIN สำหรับหน้า Approve และ Settings";

  if($("pinLabel"))
    $("pinLabel").textContent="PIN ใหม่";

  if($("pinInput"))
    $("pinInput").value="";

  if($("pinConfirm"))
    $("pinConfirm").value="";

  if($("pinNewWrap"))
    $("pinNewWrap").classList.remove("hidden");

  if($("pinSubmit"))
    $("pinSubmit").textContent="ตั้ง PIN";

  if($("pinModal"))
    $("pinModal").classList.remove("hidden");


  setTimeout(()=>{
    if($("pinInput"))
      $("pinInput").focus();
  },80);

}


function closePinModal(){

  if($("pinModal"))
    $("pinModal").classList.add("hidden");

  if($("pinInput"))
    $("pinInput").value="";

  if($("pinConfirm"))
    $("pinConfirm").value="";

}


async function submitPin(){

  const pin=$("pinInput")?.value.trim();

  if(!pin)
    return toast("กรุณากรอก PIN","error");


  if(!/^\d{4,12}$/.test(pin))
    return toast(
      "PIN ต้องเป็นตัวเลข 4-12 หลัก",
      "error"
    );


  /* FIRST PIN */

  if(!hasPin){

    const confirmPin=$("pinConfirm")?.value.trim();

    if(pin!==confirmPin)
      return toast(
        "PIN ยืนยันไม่ตรงกัน",
        "error"
      );


    const j=await postJson({
      action:"setPin",
      newPin:pin
    });


    if(!j.success)
      return toast(
        j.message,
        "error"
      );


    hasPin=true;
    pinUnlocked=true;
    pinSession=pin;

    closePinModal();

    toast(
      "ตั้ง PIN สำเร็จ",
      "success"
    );


    activateTab("settingsTab");

    renderSettings();

    return;
  }


  /* VERIFY PIN */

  const j=await postJson({
    action:"verifyPin",
    pin
  });


  if(!j.success)
    return toast(
      "PIN ไม่ถูกต้อง",
      "error"
    );


  pinUnlocked=true;
  pinSession=pin;

  closePinModal();


  toast(
    "ยืนยัน PIN สำเร็จ",
    "success"
  );


  activateTab(pendingProtectedTab);

}


/* =========================================================
   CHANGE PIN
========================================================= */

async function savePin(){

  if(!pinUnlocked)
    return openProtectedTab("settingsTab");


  const current=$("currentPin")?.value.trim()||"";
  const next=$("newPin")?.value.trim()||"";


  if(!/^\d{4,12}$/.test(next))
    return toast(
      "PIN ใหม่ต้องเป็นตัวเลข 4-12 หลัก",
      "error"
    );


  const j=await postJson({
    action:"setPin",
    currentPin:current,
    newPin:next,
    pin:pinSession
  });


  if(!j.success)
    return toast(
      j.message,
      "error"
    );


  pinSession=next;
  hasPin=true;


  if($("currentPin"))
    $("currentPin").value="";

  if($("newPin"))
    $("newPin").value="";


  toast(
    "เปลี่ยน PIN สำเร็จ",
    "success"
  );

}


/* =========================================================
   MODE
========================================================= */

function setMode(m){

  if($("status"))
    $("status").value=m;


  const f=m==="Finish Sampling";


  if($("startModeBtn"))
    $("startModeBtn")
      .classList.toggle("active",!f);

  if($("finishModeBtn"))
    $("finishModeBtn")
      .classList.toggle("active",f);

  if($("startFields"))
    $("startFields")
      .classList.toggle("hidden",f);

  if($("finishFields"))
    $("finishFields")
      .classList.toggle("hidden",!f);

  if($("balanceAlert"))
    $("balanceAlert")
      .classList.add("hidden");


  if(f)
    loadStartForFinish();


  updateUnitLabels();

}


function updateUnitLabels(){

  const unit=$("unit")?.value||"pcs";

  document
    .querySelectorAll(".unitLabel")
    .forEach(e=>e.textContent=unit);

}


/* =========================================================
   START CALCULATION
========================================================= */

function calcStart(){

  const incoming=
    Number($("incomingCarton")?.value||0);

  const total=
    incoming>0
    ?Math.ceil(Math.sqrt(incoming)+1)
    :0;


  if($("totalCartonIn"))
    $("totalCartonIn").value=
      total||"";


  const rem=
    Number($("remainderCartonIn")?.value||0);

  const full=
    Math.max(0,total-rem);


  if($("fullCartonIn"))
    $("fullCartonIn").value=
      total?full:"";


  const q=
    Number($("qtyFullCartonIn")?.value||0);

  const rq=
    Number($("remainderQtyIn")?.value||0);

  const sample=
    full*q+rq;


  if($("sampleInPreview"))
    $("sampleInPreview").textContent=
      sample;

}


/* =========================================================
   FINISH CALCULATION
========================================================= */

function calcFinish(){

  const total=
    Number($("totalCartonOut")?.value||0);

  const rem=
    Number($("remainderCartonOut")?.value||0);

  const full=
    Number($("fullCartonOut")?.value||0);

  const q=
    Number($("qtyFullCartonOut")?.value||0);

  const rq=
    Number($("remainderQtyOut")?.value||0);

  const out=
    full*q+rq;

  const use=
    Number($("sampleUsage")?.value||0);


  if($("sampleOutPreview"))
    $("sampleOutPreview").textContent=
      out;


  const incoming=
    Number($("_incomingForFinish")?.value||0);


  if(incoming){

    const bal=
      incoming-out-use;


    if($("balancePreview")){

      $("balancePreview").textContent=
        Math.abs(bal)<1e-9
        ?"✅ Balance OK"
        :"⚠️ ต่าง "+bal;

    }

  }

}


function hiddenIncoming(){

  let e=$("_incomingForFinish");


  if(!e){

    e=document.createElement("input");

    e.id="_incomingForFinish";

    e.type="hidden";

    document.body.appendChild(e);

  }


  return e;

}


/* =========================================================
   FIND START RECORD FOR FINISH
========================================================= */

async function loadStartForFinish(){

  const code=$("code")?.value.trim()||"";
  const batch=$("batch")?.value.trim()||"";


  if(!code||!batch)
    return;


  try{

    const j=await getJson(
      API+"?action=history"
    );


    const x=(j.data||[]).find(a=>
      a.code===code.toUpperCase() &&
      a.batch===batch.toUpperCase() &&
      a.status==="Sampling"
    );


    if(x){

      hiddenIncoming().value=
        x.sampleIn;


      if($("unit"))
        $("unit").value=
          x.unit||"pcs";


      updateUnitLabels();

      calcFinish();

    }

  }catch(_){}

}


/* =========================================================
   API
========================================================= */

async function getJson(u){

  const r=await fetch(
    u,
    {cache:"no-store"}
  );

  return r.json();

}


async function postJson(b){

  const r=await fetch(
    API,
    {
      method:"POST",
      headers:{
        "Content-Type":
          "text/plain;charset=utf-8"
      },
      body:JSON.stringify(b)
    }
  );

  return r.json();

}


/* =========================================================
   MASTER
========================================================= */

async function loadMaster(){

  try{

    const [
      r,
      i,
      s,
      pin
    ]=await Promise.all([

      getJson(API+"?action=rooms"),

      getJson(API+"?action=inspectors"),

      getJson(API+"?action=supervisors"),

      getJson(API+"?action=pinStatus")

    ]);


    if(
      !r.success ||
      !i.success ||
      !s.success ||
      !pin.success
    )
      throw Error(
        "โหลด Master ไม่สำเร็จ"
      );


    rooms=r.data||[];
    inspectors=i.data||[];
    supervisors=s.data||[];

    hasPin=!!pin.data?.hasPin;


    fillMasters();

    renderSettings();

    setOnline();

  }catch(e){

    setOffline();

    toast(
      "โหลด Room/Inspector/Supervisor ไม่สำเร็จ",
      "error"
    );

  }

}


/* =========================================================
   MASTER UI
========================================================= */

function fillMasters(){

  if($("room")){

    $("room").innerHTML=
      '<option value="">— เลือก Room —</option>'+
      rooms
        .map(x=>`<option>${esc(x.room)}</option>`)
        .join("");

  }


  if($("inspector")){

    $("inspector").innerHTML=
      '<option value="">— ยังไม่เลือก Inspector —</option>'+
      inspectors
        .map(x=>`<option>${esc(x.inspector)}</option>`)
        .join("");

  }


  if($("historyRoom")){

    $("historyRoom").innerHTML=
      '<option value="">ทุกห้อง</option>'+
      rooms
        .map(x=>`<option>${esc(x.room)}</option>`)
        .join("");

  }


  if($("supervisorRoom")){

    $("supervisorRoom").innerHTML=
      '<option value="">ทุกห้อง</option>'+
      rooms
        .map(x=>`<option>${esc(x.room)}</option>`)
        .join("");

  }


  fillApprovers();

}


function fillApprovers(){

  if(!$("approveBy"))
    return;


  $("approveBy").innerHTML=
    '<option value="">— เลือกผู้อนุมัติ —</option>'+
    supervisors
      .map(x=>
        `<option value="${esc(x.supervisor)}">
          ${esc(x.supervisor)}
        </option>`
      )
      .join("");

}


/* =========================================================
   LOAD ALL
========================================================= */

async function loadAll(){

  try{

    const [
      d,
      h
    ]=await Promise.all([

      getJson(API+"?action=dashboard"),

      getJson(API+"?action=history")

    ]);


    if(!d.success||!h.success)
      throw Error(
        "โหลดข้อมูลไม่สำเร็จ"
      );


    renderDashboard(d.data);

    allHistory=h.data||[];

    renderHistory();

    renderSupervisor();

    setOnline();

  }catch(e){

    setOffline();

  }

}


/* =========================================================
   HISTORY
========================================================= */

async function loadHistory(){

  try{

    const h=
      await getJson(
        API+"?action=history"
      );


    if(h.success){

      allHistory=
        h.data||[];

      renderHistory();

    }

  }catch(_){}

}


function renderDashboard(d){

  const s=d.samplingNow||[];
  const c=d.completedToday||[];


  if($("samplingNow"))
    $("samplingNow").textContent=
      s.length;

  if($("completedToday"))
    $("completedToday").textContent=
      c.length;

  if($("totalToday"))
    $("totalToday").textContent=
      d.totalToday||0;


  if($("roomContainer")){

    $("roomContainer").innerHTML=
      (d.roomStatus||[])
      .map(r=>
        `<button
          class="roomCard ${r.active?"busy":"free"}"
          onclick="goRoom('${escAttr(r.room)}')">

          <div class="roomName">
            ${esc(r.room)}
          </div>

          <div class="roomStatus">
            ${r.active?"🟠 Sampling":"🟢 ว่าง"}
          </div>

          <div class="roomCount">
            ${r.count||0} รายการ
          </div>

        </button>`
      )
      .join("")
      ||
      '<div class="empty">ไม่มี Room</div>';

  }


  if($("nowBody")){

    $("nowBody").innerHTML=
      s.length

      ?

      s.map(x=>
        `<tr>
          <td>${esc(x.room)}</td>
          <td>${esc(x.code)}</td>
          <td>${esc(x.batch)}</td>
          <td>${esc(x.inspector)}</td>
          <td>
            <span class="badge sampling">
              Sampling
            </span>
          </td>
        </tr>`
      ).join("")

      :

      '<tr><td colspan="5" class="empty">ไม่มีงานที่กำลัง Sampling</td></tr>';

  }

}


function goRoom(r){

  if($("historyRoom"))
    $("historyRoom").value=r;


  const tab=
    document.querySelector(
      '[data-tab="historyTab"]'
    );


  if(tab)
    tab.click();


  renderHistory();

}


function renderHistory(){

  const k=
    $("txtSearch")?.value
      .trim()
      .toLowerCase()||"";

  const room=
    $("historyRoom")?.value||"";

  const status=
    $("historyStatus")?.value||"";


  const d=
    allHistory.filter(x=>

      (
        !k ||

        [
          x.code,
          x.batch,
          x.room,
          x.reportIn,
          x.reportOut,
          x.status,
          x.balance
        ]
        .join(" ")
        .toLowerCase()
        .includes(k)
      )

      &&

      (!room||x.room===room)

      &&

      (!status||x.status===status)

    );


  if(!$("historyBody"))
    return;


  $("historyBody").innerHTML=

    d.length

    ?

    d.map(x=>
      `<tr>
        <td>${esc(x.startTime)}</td>
        <td>${esc(x.code)}</td>
        <td>${esc(x.batch)}</td>
        <td>${esc(x.unit)}</td>
        <td>${esc(x.incomingCarton)}</td>
        <td>${esc(x.sampleIn)}</td>
        <td>${esc(x.finishTime)}</td>
        <td>${esc(x.sampleOut)}</td>
        <td>${esc(x.sampleUsage)}</td>
        <td>${balanceBadge(x.balance)}</td>
        <td>
          ${
            x.approveBy
            ?
            `<span class="approved">
              ✓ ${esc(x.approveBy)}
            </span>`
            :
            "รอ Approve"
          }
        </td>
      </tr>`
    ).join("")

    :

    '<tr><td colspan="11" class="empty">ไม่พบข้อมูล</td></tr>';

}


/* =========================================================
   APPROVE
========================================================= */

function renderSupervisor(){

  if(!$("approvalBody"))
    return;


  fillApprovers();


  const room=
    $("supervisorRoom")?.value||"";

  const approver=
    $("approveBy")?.value||"";


  let d=
    allHistory.filter(
      x=>
        x.status==="Completed" &&
        !x.approveBy
    );


  if(room)
    d=d.filter(x=>x.room===room);


  $("approvalBody").innerHTML=

    d.length

    ?

    d.map(x=>
      `<tr>

        <td>${esc(x.startTime)}</td>

        <td>${esc(x.code)}</td>

        <td>${esc(x.batch)}</td>

        <td>${esc(x.room)}</td>

        <td>${esc(x.sampleIn)}</td>

        <td>${esc(x.sampleOut)}</td>

        <td>${esc(x.sampleUsage)}</td>

        <td>${balanceBadge(x.balance)}</td>

        <td>

          <button
            class="approveBtn"
            ${!approver?"disabled":""}
            onclick="approveRow(
              '${escAttr(x.code)}',
              '${escAttr(x.batch)}',
              '${escAttr(x.room)}'
            )">

            ✓ Approve

          </button>

        </td>

      </tr>`
    ).join("")

    :

    '<tr><td colspan="9" class="empty">ไม่มีรายการรอ Approve</td></tr>';

}


async function approveRow(
  code,
  batch,
  room
){

  const name=
    $("approveBy")?.value||"";


  if(!name)
    return toast(
      "กรุณาเลือกผู้อนุมัติ",
      "error"
    );


  if(!confirm(
    `ยืนยัน Approve ${code} / ${batch} โดย ${name} ?`
  ))
    return;


  const j=await postJson({

    action:"approve",

    code,

    batch,

    room,

    approveBy:name,

    pin:pinSession

  });


  if(!j.success)
    return toast(
      j.message,
      "error"
    );


  toast(
    "Approve สำเร็จ",
    "success"
  );


  await loadAll();

}


/* =========================================================
   SAVE SAMPLING
========================================================= */

async function saveSampling(){

  const finish=
    $("status")?.value==="Finish Sampling";

  const code=
    $("code")?.value
      .trim()
      .toUpperCase()||"";

  const batch=
    $("batch")?.value
      .trim()
      .toUpperCase()||"";


  if(!code||!batch)
    return toast(
      "กรุณากรอก/สแกน Code และ Batch",
      "error"
    );


  if(!$("room")?.value)
    return toast(
      "กรุณาเลือก Room",
      "error"
    );


  const btn=$("btnSave");

  if(btn)
    btn.disabled=true;


  try{

    let body={

      action:
        finish
        ?"finishSampling"
        :"startSampling",

      room:$("room").value,

      inspector:
        $("inspector")?.value||"",

      code,

      batch,

      unit:
        $("unit")?.value||"pcs",

      qrRaw:""

    };


    if(!finish){

      calcStart();


      body.incomingCarton=
        $("incomingCarton")?.value||"";

      body.remainderCartonIn=
        $("remainderCartonIn")?.value||"";

      body.remainderQtyIn=
        $("remainderQtyIn")?.value||"";

      body.fullCartonIn=
        $("fullCartonIn")?.value||"";

      body.qtyFullCartonIn=
        $("qtyFullCartonIn")?.value||"";

      body.remark=
        $("remarkIn")?.value.trim()||"";

    }else{

      await loadStartForFinish();


      body.totalCartonOut=
        $("totalCartonOut")?.value||"";

      body.remainderCartonOut=
        $("remainderCartonOut")?.value||"";

      body.remainderQtyOut=
        $("remainderQtyOut")?.value||"";

      body.fullCartonOut=
        $("fullCartonOut")?.value||"";

      body.qtyFullCartonOut=
        $("qtyFullCartonOut")?.value||"";

      body.sampleUsage=
        $("sampleUsage")?.value||"";

      body.remark=
        $("remarkOut")?.value.trim()||"";

    }


    const j=
      await postJson(body);


    if(!j.success)
      throw Error(
        j.message
      );


    toast(
      j.message,
      "success"
    );


    if(
      j.data &&
      j.data.balance!==undefined
    ){

      if($("balanceAlert")){

        $("balanceAlert").textContent=
          j.data.balanceOK
          ?"✅ Balance OK"
          :"⚠️ Balance ต่าง "+j.data.balance;

        $("balanceAlert").className=
          "balanceAlert "+
          (
            j.data.balanceOK
            ?"ok"
            :"bad"
          );

      }

    }


    clearForm();

    await loadAll();


  }catch(e){

    toast(
      e.message||
      "บันทึกไม่สำเร็จ",
      "error"
    );

  }finally{

    if(btn)
      btn.disabled=false;

  }

}


/* =========================================================
   CLEAR FORM
========================================================= */

function clearForm(){

  [
    "code",
    "batch",
    "incomingCarton",
    "totalCartonIn",
    "remainderQtyIn",
    "fullCartonIn",
    "qtyFullCartonIn",
    "totalCartonOut",
    "remainderQtyOut",
    "fullCartonOut",
    "qtyFullCartonOut",
    "sampleUsage",
    "remarkIn",
    "remarkOut"
  ].forEach(id=>{

    const e=$(id);

    if(e)
      e.value="";

  });


  if($("remainderCartonIn"))
    $("remainderCartonIn").value="0";

  if($("remainderCartonOut"))
    $("remainderCartonOut").value="0";

  if($("sampleInPreview"))
    $("sampleInPreview").textContent="0";

  if($("sampleOutPreview"))
    $("sampleOutPreview").textContent="0";

  if($("balancePreview"))
    $("balancePreview").textContent="รอคำนวณ";

  hiddenIncoming().value="";

}


/* =========================================================
   MASTER ADD / DELETE
========================================================= */

async function addRoom(){

  const v=
    $("newRoom")?.value.trim()||"";


  if(!v)
    return toast(
      "กรุณากรอก Room",
      "error"
    );


  const j=await postJson({
    action:"addRoom",
    room:v,
    pin:pinSession
  });


  toast(
    j.message,
    j.success
    ?"success"
    :"error"
  );


  if(j.success){

    $("newRoom").value="";

    await loadMaster();

  }

}


async function addInspector(){

  const v=
    $("newInspector")?.value.trim()||"";


  if(!v)
    return toast(
      "กรุณากรอก Inspector",
      "error"
    );


  const j=await postJson({
    action:"addInspector",
    inspector:v,
    pin:pinSession
  });


  toast(
    j.message,
    j.success
    ?"success"
    :"error"
  );


  if(j.success){

    $("newInspector").value="";

    await loadMaster();

  }

}


async function addSupervisor(){

  const name=
    $("newSupervisor")?.value.trim()||"";


  if(!name)
    return toast(
      "กรุณากรอกชื่อผู้อนุมัติ",
      "error"
    );


  const j=await postJson({
    action:"addSupervisor",
    supervisor:name,
    pin:pinSession
  });


  toast(
    j.message,
    j.success
    ?"success"
    :"error"
  );


  if(j.success){

    $("newSupervisor").value="";

    await loadMaster();

  }

}


async function deleteRoom(room){

  const j=await postJson({
    action:"deleteRoom",
    room,
    pin:pinSession
  });


  toast(
    j.message,
    j.success
    ?"success"
    :"error"
  );


  if(j.success)
    await loadMaster();

}


async function deleteInspector(name){

  const j=await postJson({
    action:"deleteInspector",
    inspector:name,
    pin:pinSession
  });


  toast(
    j.message,
    j.success
    ?"success"
    :"error"
  );


  if(j.success)
    await loadMaster();

}


async function deleteSupervisor(name){

  const j=await postJson({
    action:"deleteSupervisor",
    supervisor:name,
    pin:pinSession
  });


  toast(
    j.message,
    j.success
    ?"success"
    :"error"
  );


  if(j.success)
    await loadMaster();

}


/* =========================================================
   SETTINGS
========================================================= */

function renderSettings(){

  if($("roomSettings")){

    $("roomSettings").innerHTML=
      rooms
      .map(x=>
        `<div class="masterRow">

          <span>
            ${esc(x.room)}
          </span>

          <button
            class="dangerBtn"
            onclick="deleteRoom('${escAttr(x.room)}')">

            ปิดใช้งาน

          </button>

        </div>`
      )
      .join("")

      ||

      '<div class="empty">ไม่มี Room</div>';

  }


  if($("inspectorSettings")){

    $("inspectorSettings").innerHTML=
      inspectors
      .map(x=>
        `<div class="masterRow">

          <span>
            ${esc(x.inspector)}
          </span>

          <button
            class="dangerBtn"
            onclick="deleteInspector('${escAttr(x.inspector)}')">

            ปิดใช้งาน

          </button>

        </div>`
      )
      .join("")

      ||

      '<div class="empty">ไม่มี Inspector</div>';

  }


  if($("supervisorSettings")){

    $("supervisorSettings").innerHTML=
      supervisors
      .map(x=>
        `<div class="masterRow">

          <span>
            ${esc(x.supervisor)}
          </span>

          <button
            class="dangerBtn"
            onclick="deleteSupervisor('${escAttr(x.supervisor)}')">

            ปิดใช้งาน

          </button>

        </div>`
      )
      .join("")

      ||

      '<div class="empty">
        ยังไม่มีรายชื่อผู้อนุมัติ
      </div>';

  }


  if($("pinStatusText")){

    $("pinStatusText").textContent=
      hasPin
      ?"สถานะ PIN: ตั้งค่าแล้ว"
      :"สถานะ PIN: ยังไม่ได้ตั้งค่า";

  }

}


/* =========================================================
   EXPORT
========================================================= */

function exportCSV(){

  const h=[

    "วันที่เริ่ม",
    "Material Code",
    "Batch No.",
    "Unit",
    "Incoming Qty",
    "Sampling Size IN",
    "วันที่ออก",
    "Sampling Size OUT",
    "Sampling Usage",
    "Balance",
    "Approve By",
    "Approve Time",
    "Room",
    "Remark"

  ];


  const d=
    allHistory.map(x=>[

      x.startTime,
      x.code,
      x.batch,
      x.unit,
      x.incomingCarton,
      x.sampleIn,
      x.finishTime,
      x.sampleOut,
      x.sampleUsage,
      x.balance,
      x.approveBy,
      x.approveTime,
      x.room,
      x.remark

    ]);


  const csv=
    "\uFEFF"+
    [h,...d]
    .map(r=>
      r
      .map(v=>
        `"${String(v??"")
          .replaceAll('"','""')}"`
      )
      .join(",")
    )
    .join("\r\n");


  const a=
    document.createElement("a");


  a.href=
    URL.createObjectURL(
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8"
        }
      )
    );


  a.download=
    `Q-Sampling-${
      new Date()
        .toISOString()
        .slice(0,10)
    }.csv`;


  a.click();

}


/* =========================================================
   QR SCANNER
========================================================= */

function openScanner(){

  if(!$("scannerModal"))
    return;


  $("scannerModal")
    .classList
    .remove("hidden");


  if(
    !navigator.mediaDevices?.getUserMedia ||
    typeof jsQR!=="function"
  ){

    if($("scanHint"))
      $("scanHint").textContent=
        "อุปกรณ์นี้ไม่พร้อมสำหรับกล้อง";

    return;

  }


  navigator.mediaDevices
    .getUserMedia({
      video:{
        facingMode:{
          ideal:"environment"
        }
      }
    })
    .then(async s=>{

      scanStream=s;

      $("qrVideo").srcObject=s;

      await $("qrVideo").play();


      scanCanvas=
        document.createElement("canvas");

      scanCtx=
        scanCanvas.getContext(
          "2d",
          {
            willReadFrequently:true
          }
        );


      scanTimer=
        setInterval(
          scanFrame,
          180
        );

    })
    .catch(()=>{

      if($("scanHint"))
        $("scanHint").textContent=
          "กรุณาอนุญาต Camera แล้วลองใหม่";

    });

}


function scanFrame(){

  const v=$("qrVideo");


  if(!v||!v.videoWidth)
    return;


  const w=
    Math.min(
      v.videoWidth,
      900
    );


  const h=
    Math.round(
      v.videoHeight*w/v.videoWidth
    );


  scanCanvas.width=w;
  scanCanvas.height=h;


  scanCtx.drawImage(
    v,
    0,
    0,
    w,
    h
  );


  const q=
    jsQR(
      scanCtx.getImageData(
        0,
        0,
        w,
        h
      ).data,
      w,
      h,
      {
        inversionAttempts:
          "attemptBoth"
      }
    );


  if(q?.data){

    useQrText(q.data);

    closeScanner();

  }

}


function useManualQr(){

  const v=
    $("qrManual")?.value.trim()||"";


  if(v){

    useQrText(v);

    closeScanner();

  }

}


function useQrText(raw){

  const v=
    String(raw||"").trim();


  let code="";
  let batch="";


  /* JSON */

  try{

    const o=
      JSON.parse(v);


    code=
      o.code||
      o.materialCode||
      o.material_code||
      o.material||
      "";

    batch=
      o.batch||
      o.batchNo||
      o.batch_no||
      o.batchNumber||
      "";

  }catch(_){}


  /* URL */

  if(!code||!batch){

    try{

      const u=
        new URL(v);

      const q=
        u.searchParams;


      code=
        code||
        q.get("code")||
        q.get("materialCode")||
        q.get("material_code")||
        "";


      batch=
        batch||
        q.get("batch")||
        q.get("batchNo")||
        q.get("batch_no")||
        "";

    }catch(_){}

  }


  /* TEXT */

  if(!code||!batch){

    const m=
      v.match(
        /(?:code|material\s*code)\s*[:=]\s*([^,;|\s]+)[,;|\s]+(?:batch|batch\s*no)\s*[:=]\s*([^,;|\s]+)/i
      );


    if(m){

      code=m[1];

      batch=m[2];

    }

  }


  /* SIMPLE */

  if(!code||!batch){

    const p=
      v.split(/[|,;]/);


    if(p.length>=2){

      code=
        p[0].trim();

      batch=
        p[1].trim();

    }

  }


  if(code){

    if($("code"))
      $("code").value=
        code.toUpperCase();


    if(batch&&$("batch"))
      $("batch").value=
        batch.toUpperCase();


    toast(
      batch
      ?"สแกน QR สำเร็จ — Code + Batch ถูกเติมแล้ว"
      :"สแกน QR สำเร็จ — เติม Code แล้ว",
      "success"
    );


    if(batch)
      loadStartForFinish();


    return;

  }


  if($("code"))
    $("code").value=
      v.toUpperCase();


  toast(
    "อ่าน QR แล้ว แต่ยังแยก Batch ไม่ได้",
    "error"
  );

}


function closeScanner(){

  if(scanTimer)
    clearInterval(scanTimer);


  scanTimer=null;


  if(scanStream)
    scanStream
      .getTracks()
      .forEach(t=>t.stop());


  scanStream=null;


  if($("qrVideo"))
    $("qrVideo").srcObject=null;


  if($("scannerModal"))
    $("scannerModal")
      .classList
      .add("hidden");

}


/* =========================================================
   UTILITIES
========================================================= */

function balanceBadge(v){

  if(!v)
    return "";


  const ok=
    String(v).includes("✅");


  return `
    <span class="balance ${ok?"ok":"bad"}">
      ${esc(v)}
    </span>
  `;

}


function setOnline(){

  if(!$("serverStatus"))
    return;


  $("serverStatus").className=
    "statusPill online";

  $("serverStatus").textContent=
    "🟢 Connected";

}


function setOffline(){

  if(!$("serverStatus"))
    return;


  $("serverStatus").className=
    "statusPill offline";

  $("serverStatus").textContent=
    "🔴 Offline";

}


function toast(
  m,
  t="success"
){

  if(!$("toast"))
    return;


  const e=$("toast");


  e.textContent=m;


  e.className=
    `toast show ${t}`;


  setTimeout(
    ()=>e.classList.remove("show"),
    3000
  );

}


function esc(v){

  return String(v??"")
    .replace(
      /[&<>"']/g,
      c=>({

        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        "\"":"&quot;",
        "'":"&#039;"

      }[c])
    );

}


function escAttr(v){

  return esc(v)
    .replace(
      /`/g,
      "&#096;"
    );

}


/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.goRoom=goRoom;

window.approveRow=approveRow;

window.deleteRoom=deleteRoom;

window.deleteInspector=deleteInspector;

window.deleteSupervisor=deleteSupervisor;

window.openProtectedTab=openProtectedTab;

window.activateTab=activateTab;

window.loadSupervisor=loadSupervisor;
