/*******************************************
 * Q-Sampling Realtime
 *******************************************/

// ===== Apps Script URL =====

const API =
"https://script.google.com/macros/s/AKfycbxqpVP_0BxZy-UwVqDFzqa_C_O8HjEZ_XWGwJ9-ZdP9fRli0YF-jNfu55TApzhfB91K3g/exec";



// โหลดข้อมูลทันที
loadDashboard();



// Refresh ทุก 10 วินาที
setInterval(loadDashboard,10000);



// ===============================
// Dashboard
// ===============================

async function loadDashboard(){

    try{

        const res = await fetch(
            API + "?action=dashboard"
        );

        const json = await res.json();

        if(!json.success){

            return;

        }

        showDashboard(json.data);

    }
    catch(error){

        console.log(error);

        document.getElementById("serverStatus").innerHTML =
        "🔴 Offline";

    }

}



// ===============================
// แสดง Dashboard
// ===============================

function showDashboard(data){

    let sampling = 0;

    let completed = 0;



    let room = {

        "B.14":0,
        "B.9":0,
        "B.10":0,
        "B.4":0,
        "SSL":0,
        "PT":0

    };



    data.forEach(item=>{

        if(item.status=="Sampling"){

            sampling++;

            room[item.room]++;

        }

        if(item.status=="Completed"){

            completed++;

        }

    });



    document.getElementById("samplingNow").innerHTML =
    sampling;

    document.getElementById("completedToday").innerHTML =
    completed;

    document.getElementById("totalToday").innerHTML =
    data.length;



    drawRoom(room);

    drawTable(data);

}



// ===============================
// Room
// ===============================

function drawRoom(room){

    let html="";



    for(let r in room){

        html+=`

        <div class="roomCard">

            <div class="roomName">

                ${r}

            </div>

            <div class="roomStatus">

                ${room[r]>0 ?

                "🟠 "+room[r]+" งาน"

                :

                "🟢 ว่าง"

                }

            </div>

        </div>

        `;

    }



    document.getElementById("roomContainer").innerHTML =
    html;

}



// ===============================
// Table
// ===============================

function drawTable(data){

    let html="";



    data.forEach(item=>{

        html+=`

<tr>

<td>${item.room}</td>

<td>${item.code}</td>

<td>${item.batch}</td>

<td>${item.status}</td>

<td>${item.inspector}</td>

</tr>

`;

    });



    document.getElementById("tblBody").innerHTML =
    html;

}



// ===============================
// Search
// ===============================

document
.getElementById("txtSearch")
.addEventListener(
"keyup",
function(){


const key =
this.value.toLowerCase();


const rows =
document
.querySelectorAll("#tblBody tr");


rows.forEach(r=>{


if(

r.innerText
.toLowerCase()
.includes(key)

){

r.style.display="";

}
else{

r.style.display="none";

}


});


});