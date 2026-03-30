"use client";
import { useState, useEffect, useRef } from "react";
import { loadPlanner, savePlanner } from "../lib/supabase";

const RACE_DAY = new Date(2026, 8, 20);
const LS_KEY = "tri-planner-local-v2";

const TYPES = {
  swim: { label: "Swim", icon: "🏊", color: "#0284c7", bg: "#e0f2fe" },
  bike: { label: "Bike", icon: "🚴", color: "#15803d", bg: "#dcfce7" },
  run:  { label: "Run",  icon: "🏃", color: "#c2410c", bg: "#fff7ed" },
};

const SHIFT_OPTIONS = [8, 10, 12, 16, 24];
const HOSPITALS = ["HFH", "GR"];
const HOSP_COLORS = { HFH: "#7c3aed", GR: "#0891b2" };

const YMCA_DEFAULT = {
  0:["9:30a–11:50a","1–2:30p"],1:["6:30–8:50a","10:10a–12:30p","3:30–4:50p","7:10–8:30p"],
  2:["6:30–8:50a","9a–12:30p","3:30–4:20p","7:40–8:30p"],3:[],4:[],5:[],6:[],
};

const EVENTS_PRESET = {
  "2026-04-05":["Easter"],"2026-05-03":["Cinci Marathon"],
  "2026-06-13":["Syl's Wedding"],"2026-06-24":["Triceratops Sprint"],
  "2026-06-26":["Family Reunion"],"2026-06-27":["Family Reunion"],"2026-06-28":["Family Reunion"],
  "2026-07-04":["July 4th"],"2026-07-22":["Pterodactyl Half"],"2026-07-26":["SF Half"],
  "2026-08-19":["T Rex Sprint"],"2026-08-23":["Chicago Tri"],
  "2026-09-12":["Robyn"],"2026-09-20":["🏁 FRANKFORT 70.3"],
};

const ds=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addD=(d,n)=>{const r=new Date(d);r.setDate(r.getDate()+n);return r};
const getMonday=d=>{const r=new Date(d);const day=r.getDay();r.setDate(r.getDate()-day+(day===0?-6:1));r.setHours(0,0,0,0);return r};
const weeksTo=(a,b)=>Math.max(0,Math.ceil((a-b)/(7*864e5)));

function getMonthGrid(year,month){
  const first=new Date(year,month,1);let off=first.getDay()===0?6:first.getDay()-1;
  const dim=new Date(year,month+1,0).getDate();const cells=[];
  for(let i=off-1;i>=0;i--)cells.push({date:new Date(year,month,-i),cur:false});
  for(let i=1;i<=dim;i++)cells.push({date:new Date(year,month,i),cur:true});
  while(cells.length%7){const d=addD(new Date(year,month+1,0),cells.length-off-dim+1);cells.push({date:d,cur:false})}
  return cells;
}

function getWeekStartsForMonth(year,month){
  const dim=new Date(year,month+1,0).getDate();const ws=[];const seen=new Set();
  for(let i=1;i<=dim;i++){const d=new Date(year,month,i);const m=getMonday(d);const k=ds(m);if(!seen.has(k)){seen.add(k);ws.push(m)}}
  return ws;
}

function migrateData(data){
  if(!data)return data;const migrated={};
  for(const[k,v]of Object.entries(data)){
    const day={...v};
    if(typeof day.work==="number"&&day.work>0&&!day.shift){day.shift={hours:day.work,hospital:""};}
    delete day.work;
    if(!day.shift)day.shift=null;if(!day.workouts)day.workouts=[];if(!day.events)day.events=[];if(day.vacation===undefined)day.vacation=false;
    migrated[k]=day;
  }
  return migrated;
}

function buildDefaults(){
  const d={};
  const wk=(base,shifts,wo,vac)=>{
    for(let i=0;i<7;i++){
      const k=ds(addD(new Date(base),i));const sh=shifts[i];
      d[k]={shift:sh?{hours:sh[0],hospital:sh[1]||""}:null,workouts:wo[i]||[],vacation:vac?.includes(i)||false,events:EVENTS_PRESET[k]||[]};
    }
  };
  wk("2026-03-30",[[12,"HFH"],[8,"HFH"],null,[8,"HFH"],null,null,null],[["bike"],["run"],["swim"],[],["swim"],[],["bike"]]);
  wk("2026-04-06",[[12,"HFH"],null,null,[12,"HFH"],[8,"HFH"],null,null],[[],["swim"],["bike"],[],["swim"],["bike"],["run"]]);
  wk("2026-04-13",[[8,"HFH"],[10,"HFH"],[8,"HFH"],[8,"HFH"],null,null,null],[["swim"],["bike"],["run"],[],["swim"],["bike"],["run"]]);
  wk("2026-04-20",[null,[8,"HFH"],[8,"HFH"],null,[12,"HFH"],[8,"HFH"],null],[["swim"],["bike"],["run"],["swim"],[],["run"],["bike"]]);
  wk("2026-04-27",[[12,"HFH"],[8,"HFH"],[8,"HFH"],null,null,null,null],[[],["bike"],["swim"],["run"],["swim"],[],["run"]]);
  wk("2026-05-04",[null,null,[10,"HFH"],[10,"HFH"],[12,"HFH"],[8,"HFH"],null],[[],["swim"],["bike"],["run"],[],["bike"],["run"]]);
  wk("2026-05-11",[null,[10,"HFH"],[12,"HFH"],null,[10,"HFH"],null,null],[["swim"],["bike"],[],["swim"],["run"],["bike"],["run"]]);
  wk("2026-05-18",[[8,"HFH"],[8,"HFH"],[8,"HFH"],null,null,null,null],[["swim"],["bike"],[],[],[],[],[]],[2,3,4,5,6]);
  wk("2026-05-25",[null,null,null,null,null,null,null],[[],[],[],[],[],[],[]],[0,1,2,3,4,5,6]);
  wk("2026-06-01",[null,null,[8,"HFH"],[8,"HFH"],[12,"HFH"],null,null],[[],[],["swim"],["bike"],[],["bike"],["run"]],[0,1]);
  wk("2026-06-08",[null,null,[12,"HFH"],[10,"HFH"],[10,"HFH"],null,null],[["swim"],["bike"],[],["run"],["swim"],["bike"],["run"]]);
  wk("2026-06-15",[[12,"HFH"],[8,"HFH"],null,[12,"HFH"],null,null,null],[["bike"],["swim"],["run"],["swim"],[],["bike"],["run"]]);
  wk("2026-06-22",[[12,"HFH"],[10,"HFH"],[8,"HFH"],[10,"HFH"],null,null,null],[["bike"],[],[],[],["swim"],["bike"],["run"]]);
  wk("2026-06-29",[[8,"HFH"],null,[12,"HFH"],[8,"HFH"],null,null,null],[["bike"],["swim"],[],["run"],["swim"],["bike"],["run"]]);
  const pat=(base,w1,w2,w3)=>{wk(base,w1||[[8,"HFH"],[8,"HFH"],[12,"HFH"],[8,"HFH"],null,null,null],w2||[["bike"],["swim"],[],["run"],["swim"],["bike"],["run"]],w3)};
  pat("2026-07-06");pat("2026-07-13",[[8,"HFH"],null,[12,"HFH"],[8,"HFH"],null,null,null]);
  pat("2026-07-20",[[8,"HFH"],[12,"HFH"],null,[8,"HFH"],null,null,null]);
  pat("2026-07-27",[[8,"HFH"],null,[12,"HFH"],[8,"HFH"],null,null,null]);
  pat("2026-08-03");pat("2026-08-10");
  pat("2026-08-17",[[8,"HFH"],null,null,[8,"HFH"],null,null,null]);
  pat("2026-08-24",[[8,"HFH"],null,[12,"HFH"],[8,"HFH"],null,null,null]);
  pat("2026-08-31");pat("2026-09-07");
  wk("2026-09-14",[[8,"HFH"],null,[12,"HFH"],[8,"HFH"],null,null,null],[["bike"],["swim"],[],["run"],[],[],[]]);
  wk("2026-09-21",[null,null,[12,"HFH"],[8,"HFH"],null,null,null],[[],["swim"],[],["run"],["swim"],["bike"],["run"]]);
  return d;
}

const DEFAULT_SETTINGS = { annualGoal: 285000, rates: { HFH: 233, GR: 250 } };

function lsLoad(){try{const r=localStorage.getItem(LS_KEY);return r?JSON.parse(r):null}catch{return null}}
function lsSave(d,s,tr,cfg){try{localStorage.setItem(LS_KEY,JSON.stringify({d,s,tr,cfg}))}catch{}}

function getMonthRange(){
  const now=new Date();const start={y:now.getFullYear(),m:now.getMonth()};const months=[];
  for(let i=-1;i<12;i++){let y=start.y,m=start.m+i;if(m<0){y--;m+=12}if(m>11){y++;m-=12}months.push({y,m})}
  return months;
}

export default function Planner(){
  const[data,setData]=useState(null);
  const[popup,setPopup]=useState(null);
  const[sel,setSel]=useState(null);
  const[drag,setDrag]=useState(null);
  const[drop,setDrop]=useState(null);
  const[ymca,setYmca]=useState(false);
  const[swim,setSwim]=useState(YMCA_DEFAULT);
  const[ok,setOk]=useState(false);
  const[showTraining,setShowTraining]=useState(true);
  const[syncStatus,setSyncStatus]=useState("loading");
  const[settings,setSettings]=useState(DEFAULT_SETTINGS);
  const[showDash,setShowDash]=useState(false);
  const[showSettings,setShowSettings]=useState(false);
  const[paintHours,setPaintHours]=useState(null);
  const[paintHosp,setPaintHosp]=useState(null);
  const[customHours,setCustomHours]=useState("");
  const paintActive=paintHours!==null&&paintHosp!==null;

  useEffect(()=>{
    (async()=>{
      let loaded=false;
      try{
        const remote=await loadPlanner();
        if(remote?.schedule){setData(migrateData(remote.schedule));if(remote.swim_hours)setSwim(remote.swim_hours);if(remote.settings)setSettings({...DEFAULT_SETTINGS,...remote.settings});setSyncStatus("synced");loaded=true;}
      }catch(e){console.warn("Supabase load failed",e)}
      if(!loaded){const local=lsLoad();if(local?.d){setData(migrateData(local.d));if(local.s)setSwim(local.s);if(local.tr!==undefined)setShowTraining(local.tr);if(local.cfg)setSettings({...DEFAULT_SETTINGS,...local.cfg});setSyncStatus("local");loaded=true;}}
      if(!loaded){setData(buildDefaults());setSyncStatus("local")}
      setOk(true);
    })();
  },[]);

  const sRef=useRef(null);
  useEffect(()=>{
    if(!ok||!data)return;clearTimeout(sRef.current);
    sRef.current=setTimeout(async()=>{
      lsSave(data,swim,showTraining,settings);
      try{const success=await savePlanner(data,swim);setSyncStatus(success?"synced":"local")}catch{setSyncStatus("local")}
    },800);
  },[data,swim,ok,showTraining,settings]);

  const now=new Date();now.setHours(0,0,0,0);const nowKey=ds(now);const wLeft=weeksTo(RACE_DAY,now);const months=getMonthRange();
  const gd=k=>data?.[k]||{shift:null,workouts:[],vacation:false,events:[]};
  const ud=(k,fn)=>setData(p=>({...p,[k]:fn(p[k]||{shift:null,workouts:[],vacation:false,events:[]})}));

  const mvWo=(fk,fi,tk)=>{if(fk===tk)return;setData(p=>{const f={...(p[fk]||{shift:null,workouts:[],vacation:false,events:[]}),workouts:[...(p[fk]||{}).workouts||[]]};const t={...(p[tk]||{shift:null,workouts:[],vacation:false,events:[]}),workouts:[...(p[tk]||{}).workouts||[]]};const w=f.workouts[fi];if(!w)return p;f.workouts.splice(fi,1);t.workouts.push(w);return{...p,[fk]:f,[tk]:t}})};
  const mvSh=(fk,tk)=>{if(fk===tk)return;setData(p=>{const fs=(p[fk]||{}).shift;return{...p,[fk]:{...(p[fk]||{shift:null,workouts:[],vacation:false,events:[]}),shift:null},[tk]:{...(p[tk]||{shift:null,workouts:[],vacation:false,events:[]}),shift:fs}}})};

  const cellClick=(e,k)=>{
    if(sel){if(sel.t==="wo")mvWo(sel.k,sel.i,k);else mvSh(sel.k,k);setSel(null);return}
    if(paintActive){ud(k,d=>({...d,shift:{hours:paintHours,hospital:paintHosp}}));return}
    const r=e.currentTarget.getBoundingClientRect();
    setPopup({k,x:Math.min(r.right+4,window.innerWidth-270),y:Math.min(r.top,window.innerHeight-400)});
  };

  const onDS=(e,k,t,i)=>{setDrag({k,t,i});e.dataTransfer.effectAllowed="move";e.stopPropagation()};
  const onDO=(e,k)=>{e.preventDefault();setDrop(k)};
  const onDL=()=>setDrop(null);
  const onDr=(e,tk)=>{e.preventDefault();setDrop(null);if(!drag)return;if(drag.t==="wo")mvWo(drag.k,drag.i,tk);else mvSh(drag.k,tk);setDrag(null)};

  const exportWork=()=>{
    if(!data)return;const rows=[["Date","Day","Hours","Hospital","Start","End","Events"]];
    Object.keys(data).filter(k=>data[k].shift).sort().forEach(k=>{
      const d=data[k];const dt=new Date(k+"T12:00:00");const day=dt.toLocaleDateString("en-US",{weekday:"long"});
      const dateStr=dt.toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"});
      const h=d.shift.hours;const end=h===8?"3:00 PM":h===10?"5:00 PM":h===12?"7:00 PM":h===16?"11:00 PM":h===24?"7:00 AM +1":"";
      rows.push([dateStr,day,h,d.shift.hospital||"","7:00 AM",end,(d.events||[]).join("; ")]);
    });
    const csv=rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="kms-work-schedule.csv";a.click();URL.revokeObjectURL(url);
  };

  const clearPaint=()=>{setPaintHours(null);setPaintHosp(null);setCustomHours("")};

  const clearMonth=(year,month)=>{
    const mName=new Date(year,month).toLocaleDateString("en-US",{month:"long",year:"numeric"});
    if(!confirm(`Clear all shifts for ${mName}? This cannot be undone.`))return;
    setData(prev=>{
      const u={...prev};const dim=new Date(year,month+1,0).getDate();
      for(let i=1;i<=dim;i++){const k=ds(new Date(year,month,i));if(u[k])u[k]={...u[k],shift:null}}
      return u;
    });
  };

  const exportICal=()=>{
    if(!data)return;
    const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//KMS Anesthesia//Schedule Planner//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:KMS Work Schedule"];
    Object.keys(data).filter(k=>data[k].shift).sort().forEach(k=>{
      const d=data[k];const dt=k.replace(/-/g,"");const h=d.shift.hours;
      const endH=7+h;const endDay=endH>=24?addD(new Date(k+"T12:00:00"),1):null;
      const endDt=endDay?ds(endDay).replace(/-/g,""):dt;const eH=endH>=24?endH-24:endH;
      const hospFull=d.shift.hospital==="HFH"?"Henry Ford Health Providence":d.shift.hospital==="GR"?"Grand Rapids":"";
      lines.push("BEGIN:VEVENT",`DTSTART:${dt}T070000`,`DTEND:${endDt}T${String(eH).padStart(2,"0")}0000`,
        `SUMMARY:${h}h Shift${d.shift.hospital?" - "+d.shift.hospital:""}`,
        hospFull?`LOCATION:${hospFull}`:"",`UID:${k}-shift@kms-planner`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").split(".")[0]}Z`,"END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    const blob=new Blob([lines.filter(Boolean).join("\r\n")],{type:"text/calendar"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="kms-schedule.ics";a.click();URL.revokeObjectURL(url);
  };
  const selectHours=h=>{setPaintHours(paintHours===h?null:h);setCustomHours("")};
  const applyCustom=()=>{const n=parseInt(customHours);if(n>0)setPaintHours(n)};

  // ── Dashboard Computation ──
  const dash = (() => {
    if (!data) return null;
    const yr = now.getFullYear();
    const yearStart = new Date(yr, 0, 1);
    const totalWeeksInYear = 52.14;
    const weeksElapsed = Math.max(0.01, (now - yearStart) / (7 * 864e5));
    const weeksRemaining = Math.max(0.01, totalWeeksInYear - weeksElapsed);
    const goal = settings.annualGoal || 285000;

    let ytdHours = 0, ytdGross = 0, futureHours = 0, futureGross = 0;
    let ytdShifts = 0, futureShifts = 0, pastVacDays = 0, futureVacDays = 0;

    for (const [k, day] of Object.entries(data)) {
      const dt = new Date(k + "T12:00:00");
      if (dt.getFullYear() !== yr) continue;
      const isPast = dt <= now;
      if (day.vacation) { if (isPast) pastVacDays++; else futureVacDays++; }
      if (day.shift) {
        const h = day.shift.hours;
        const rate = settings.rates?.[day.shift.hospital] || settings.rates?.HFH || 233;
        const income = h * rate;
        if (isPast) { ytdHours += h; ytdGross += income; ytdShifts++; }
        else { futureHours += h; futureGross += income; futureShifts++; }
      }
    }

    const pastVacWeeks = Math.round(pastVacDays / 7 * 10) / 10;
    const futureVacWeeks = Math.round(futureVacDays / 7 * 10) / 10;
    const totalVacWeeks = pastVacWeeks + futureVacWeeks;

    // Vacation-adjusted weeks
    const workedWeeks = Math.max(0.01, weeksElapsed - pastVacWeeks);
    const futureWorkingWeeks = Math.max(0.01, weeksRemaining - futureVacWeeks);
    const totalWorkingWeeks = totalWeeksInYear - totalVacWeeks;

    // Pace target adjusted for vacation (goal spread across working weeks only)
    const whereIShouldBe = goal * (workedWeeks / totalWorkingWeeks);
    const aheadBehind = ytdGross - whereIShouldBe;

    // Pace projection: earning rate per worked week × remaining working weeks
    const earningRate = ytdGross / workedWeeks;
    const paceProjection = ytdGross + (earningRate * futureWorkingWeeks);

    const schedProjection = ytdGross + futureGross;
    const incomeGap = Math.max(0, goal - schedProjection);
    const avgWeeklyHours = ytdHours / workedWeeks;
    const avgWeeklyIncome = ytdGross / workedWeeks;
    const utilization = (avgWeeklyHours / 40) * 100;
    const neededWeeklyIncome = futureWorkingWeeks > 0 ? Math.max(0, goal - ytdGross - futureGross) / futureWorkingWeeks : 0;

    return { ytdHours, ytdGross, futureHours, futureGross, futureShifts, whereIShouldBe, aheadBehind, paceProjection, schedProjection, incomeGap, avgWeeklyHours, avgWeeklyIncome, utilization, weeksElapsed: Math.round(weeksElapsed*10)/10, weeksRemaining: Math.round(weeksRemaining*10)/10, ytdShifts, goal, neededWeeklyIncome, pastVacWeeks, futureVacWeeks, totalVacWeeks, futureWorkingWeeks: Math.round(futureWorkingWeeks*10)/10 };
  })();

  if(!ok)return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"}}><div style={{textAlign:"center",color:"#999",fontSize:13}}>Loading...</div></div>);

  return(
    <div>
      <div className="hdr">
        <div className="hdr-left">
          <div className="logo">Schedule Planner</div>
          {showTraining&&<div className="race-pill">{wLeft}w to Frankfort</div>}
          {syncStatus==="synced"&&<span className="sync-ok">● synced</span>}
          {syncStatus==="local"&&<span className="sync-err">● local only</span>}
        </div>
        <div className="hdr-btns">
          <button className={`nbtn ${showDash?"today":""}`} onClick={()=>{setShowDash(!showDash);setShowSettings(false)}}>📊 Dash</button>
          <button className="nbtn" onClick={()=>{setShowSettings(!showSettings);setShowDash(false)}}>⚙️</button>
          <button className="nbtn today" onClick={()=>{document.getElementById("month-now")?.scrollIntoView({behavior:"smooth",block:"start"})}}>Today</button>
          {showTraining&&<button className="nbtn" onClick={()=>setYmca(!ymca)}>🏊</button>}
          <button className="nbtn" onClick={exportWork}>📤 CSV</button>
          <button className="nbtn" onClick={exportICal}>📅 iCal</button>
          <button className="nbtn" onClick={()=>{if(confirm("Reset all?"))setData(buildDefaults())}}>↺</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="tb-section">
          <span className="tb-label">Shift:</span>
          {SHIFT_OPTIONS.map(h=>(<button key={h} className={`tb-btn ${paintHours===h?"on":""}`} onClick={()=>selectHours(h)}>{h}h</button>))}
          <input className="tb-other" placeholder="Hrs" value={customHours} onChange={e=>setCustomHours(e.target.value.replace(/\D/g,""))} onKeyDown={e=>{if(e.key==="Enter")applyCustom()}} onBlur={applyCustom}/>
          {paintHours&&!SHIFT_OPTIONS.includes(paintHours)&&<button className="tb-btn on">{paintHours}h</button>}
        </div>
        <div className="tb-divider"/>
        <div className="tb-section">
          <span className="tb-label">Site:</span>
          {HOSPITALS.map(h=>(<button key={h} className={`tb-hosp ${paintHosp===h?"on":""}`} style={{borderColor:HOSP_COLORS[h],background:paintHosp===h?HOSP_COLORS[h]:"#fff",color:paintHosp===h?"#fff":HOSP_COLORS[h]}} onClick={()=>setPaintHosp(paintHosp===h?null:h)}>{h}</button>))}
        </div>
        <div className="tb-divider"/>
        {paintActive?(<><div className="tb-active"><span className="paint-dot"/>Paint: {paintHours}h @ {paintHosp}</div><button className="tb-clear" onClick={clearPaint}>Clear</button></>):(<span style={{fontSize:10,color:"#bbb"}}>Select shift + site to paint</span>)}
        <button className={`tb-toggle ${showTraining?"on":"off"}`} onClick={()=>setShowTraining(!showTraining)}>🏋️ Training {showTraining?"ON":"OFF"}</button>
      </div>

      {/* Dashboard */}
      {showDash && dash && (
        <div className="dash-panel">
          <div className="dash-grid">
            <div className="dash-card">
              <div className="dash-label">YTD Gross</div>
              <div className="dash-value">${dash.ytdGross.toLocaleString()}</div>
              <div className="dash-sub">{dash.ytdShifts} shifts · {Math.round(dash.ytdHours)}h · {dash.weeksElapsed}wk elapsed</div>
            </div>
            <div className={`dash-card ${dash.aheadBehind>=0?"dash-good":"dash-bad"}`}>
              <div className="dash-label">vs Pace Target</div>
              <div className="dash-value">{dash.aheadBehind>=0?"+":""}${Math.round(dash.aheadBehind).toLocaleString()}</div>
              <div className="dash-sub">{dash.aheadBehind>=0?"Ahead":"Behind"} · should be ${Math.round(dash.whereIShouldBe).toLocaleString()}</div>
            </div>
            <div className="dash-card">
              <div className="dash-label">Pace Projection (EOY)</div>
              <div className="dash-value">${Math.round(dash.paceProjection).toLocaleString()}</div>
              <div className="dash-sub">{dash.paceProjection>=dash.goal?"✅ On track":"⚠️ Below goal"} · adjusted for {dash.totalVacWeeks}wk vacation</div>
            </div>
            <div className="dash-card">
              <div className="dash-label">Scheduled Projection</div>
              <div className="dash-value">${Math.round(dash.schedProjection).toLocaleString()}</div>
              <div className="dash-sub">{dash.futureShifts} future shifts · {Math.round(dash.futureHours)}h booked</div>
            </div>
            <div className={`dash-card ${dash.incomeGap>0?"dash-warn":"dash-good"}`}>
              <div className="dash-label">Income Gap</div>
              <div className="dash-value">{dash.incomeGap>0?"$"+Math.round(dash.incomeGap).toLocaleString():"$0 ✅"}</div>
              <div className="dash-sub">{dash.incomeGap>0?`Need $${Math.round(dash.neededWeeklyIncome).toLocaleString()}/wk × ${dash.futureWorkingWeeks} working wks`:"Fully booked to goal"}</div>
            </div>
            <div className="dash-card">
              <div className="dash-label">Weekly Averages</div>
              <div className="dash-value">{Math.round(dash.avgWeeklyHours)}h / ${Math.round(dash.avgWeeklyIncome).toLocaleString()}</div>
              <div className="dash-sub">{Math.round(dash.utilization)}% utilization · Vacation: {dash.totalVacWeeks}wk ({dash.futureVacWeeks} future)</div>
            </div>
          </div>
          <div style={{padding:"0 16px 8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{height:6,flex:1,background:"#e4e4de",borderRadius:3,marginRight:12,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.min(100,Math.round(dash.ytdGross/dash.goal*100))}%`,background:dash.ytdGross/dash.goal>=dash.weeksElapsed/52.14?"#22c55e":"#f59e0b",borderRadius:3,transition:"width .3s"}}/>
            </div>
            <span style={{fontSize:11,fontWeight:600,fontFamily:"'JetBrains Mono',monospace",color:"#666"}}>{Math.round(dash.ytdGross/dash.goal*100)}% of goal</span>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <div style={{padding:"12px 16px",display:"flex",flexWrap:"wrap",gap:16,alignItems:"flex-end"}}>
            <div>
              <label className="dash-label" style={{display:"block",marginBottom:4}}>Annual Goal ($)</label>
              <input type="number" className="tb-other" style={{width:100}} value={settings.annualGoal}
                onChange={e=>setSettings(s=>({...s,annualGoal:parseInt(e.target.value)||0}))}/>
            </div>
            {HOSPITALS.map(h=>(
              <div key={h}>
                <label className="dash-label" style={{display:"block",marginBottom:4}}>{h} Rate ($/hr)</label>
                <input type="number" className="tb-other" style={{width:80}} value={settings.rates?.[h]||0}
                  onChange={e=>setSettings(s=>({...s,rates:{...s.rates,[h]:parseInt(e.target.value)||0}}))}/>
              </div>
            ))}
            <button className="nbtn" style={{color:"#111",border:"1px solid #ddd",fontSize:11,padding:"4px 10px"}} onClick={()=>setShowSettings(false)}>Done</button>
          </div>
        </div>
      )}

      {months.map(({y,m})=>{
        const cells=getMonthGrid(y,m);const mName=new Date(y,m).toLocaleDateString("en-US",{month:"long",year:"numeric"});
        const isNowMonth=y===now.getFullYear()&&m===now.getMonth();const wStarts=getWeekStartsForMonth(y,m);
        const budgets=showTraining?wStarts.map(mon=>{const end=addD(mon,6);const c={swim:0,bike:0,run:0};for(let d=new Date(mon);d<=end;d=addD(d,1)){const day=gd(ds(d));(day.workouts||[]).forEach(w=>{if(c[w]!==undefined)c[w]++})}return{...c,label:`${mon.getMonth()+1}/${mon.getDate()}`,isCur:now>=mon&&now<=end}}):[];

        return(
          <div key={`${y}-${m}`} id={isNowMonth?"month-now":undefined}>
            <div className="month-hdr"><span>{mName}</span>{(y>now.getFullYear()||(y===now.getFullYear()&&m>=now.getMonth()))&&<button onClick={()=>clearMonth(y,m)} style={{float:"right",background:"none",border:"1px solid #ddd",borderRadius:4,padding:"2px 8px",fontSize:10,color:"#999",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>🗑️ Clear shifts</button>}</div>
            {showTraining&&budgets.length>0&&(<div className="budget">{budgets.map((b,i)=>(<div key={i} className={`bwk ${b.isCur?"cur":""}`}><span className="bwk-label">Wk {b.label}</span>{Object.entries(TYPES).map(([k,mt])=>(<span key={k} className={`bpill ${b[k]>=2?"ok":""}`} style={{color:mt.color}}>{mt.icon}{b[k]}/2</span>))}</div>))}</div>)}
            <div className="ghd">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><div key={d} className="ghd-c">{d}</div>)}</div>
            <div className="grid">
              {cells.map(({date,cur},ci)=>{
                const k=ds(date);const day=gd(k);const isT=k===nowKey;const isP=date<now&&!isT;
                const dow=date.getDay();const hasSw=(day.workouts||[]).includes("swim");const isStr=dow===1||dow===4;
                const isDrp=drop===k;const isSrc=sel?.k===k;const slots=swim[dow]||[];
                const hospColor=day.shift?.hospital?HOSP_COLORS[day.shift.hospital]||"#1e293b":"#1e293b";
                return(
                  <div key={ci} className={`dc ${!cur?"notcur":""} ${isT?"tod":""} ${day.vacation?"vac":""} ${isDrp?"drp":""} ${isP?"past":""} ${isSrc?"src":""} ${paintActive?"paint-hover":""}`}
                    onClick={e=>cellClick(e,k)} onDragOver={e=>onDO(e,k)} onDragLeave={onDL} onDrop={e=>onDr(e,k)}>
                    <div style={{display:"flex",alignItems:"center",gap:3,flexWrap:"wrap"}}>
                      <span className={`dnum ${isT?"tn":""}`}>{date.getDate()}</span>
                      {day.shift&&(<span className="sb" style={{background:hospColor}} draggable onDragStart={e=>onDS(e,k,"sh",0)} onClick={e=>{e.stopPropagation();setSel(sel?.k===k&&sel?.t==="sh"?null:{k,t:"sh"})}}>{day.shift.hours}h{day.shift.hospital?" · "+day.shift.hospital:""}<span className="x" onClick={e=>{e.stopPropagation();ud(k,d=>({...d,shift:null}))}}>×</span></span>)}
                    </div>
                    {(day.events||[]).map((ev,ei)=><span key={ei} className="etag">{ev}</span>)}
                    {day.vacation&&<span className="etag" style={{background:"#fbbf24",color:"#78350f"}}>Vacation</span>}
                    {showTraining&&(<div className="woa">{(day.workouts||[]).map((wo,wi)=>{const mt=TYPES[wo];if(!mt)return null;const bl=day.vacation;const isSl=sel?.k===k&&sel?.t==="wo"&&sel?.i===wi;const isDg=drag?.k===k&&drag?.t==="wo"&&drag?.i===wi;return(<span key={wi} className={`wp ${bl?"blocked":""} ${isSl?"sel":""} ${isDg?"drg":""}`} style={{color:mt.color,borderColor:mt.color,background:bl?"#f5f5f5":mt.bg}} draggable onDragStart={e=>onDS(e,k,"wo",wi)} onClick={e=>{e.stopPropagation();setSel(isSl?null:{k,t:"wo",i:wi})}}>{mt.icon}{mt.label}<span className="x" onClick={e=>{e.stopPropagation();ud(k,d=>({...d,workouts:d.workouts.filter((_,j)=>j!==wi)}));}}>×</span></span>)})}</div>)}
                    {showTraining&&isStr&&(day.workouts||[]).length>0&&!day.vacation&&<span className="stag">+🏋️</span>}
                    {showTraining&&hasSw&&slots.length>0&&!day.vacation&&<div className="swim-t">{slots.join(", ")}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {sel&&(<div className="hint">Click a day to move {sel.t==="sh"?"shift":"workout"}<button onClick={()=>setSel(null)}>Cancel</button></div>)}
      {popup&&<><div className="pov" onClick={()=>setPopup(null)}/><DayPop k={popup.k} day={gd(popup.k)} x={popup.x} y={popup.y} ud={ud} close={()=>setPopup(null)} showTraining={showTraining}/></>}

      <div className={`ypnl ${ymca?"open":""}`}>
        <div className="yt">🏊 YMCA Lap Swim Hours</div>
        <p style={{fontSize:10,color:"#999",marginBottom:10}}>Comma-separated. Update monthly.</p>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((n,dow)=>(<div key={dow} className="yr"><div className="yd">{n}</div><input className="yi" defaultValue={(swim[dow]||[]).join(", ")} placeholder="e.g. 6:30–8:50a" onBlur={e=>{const v=e.target.value.trim();setSwim(p=>({...p,[dow]:v?v.split(",").map(s=>s.trim()).filter(Boolean):[]}));}}/></div>))}
        <button className="ysave" onClick={()=>setYmca(false)}>Done</button>
      </div>
    </div>
  );
}

function DayPop({k,day,x,y,ud,close,showTraining}){
  const[ev,setEv]=useState("");const dt=new Date(k+"T12:00:00");
  const lbl=dt.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  const setShift=(h,hosp)=>ud(k,d=>{if(d.shift&&d.shift.hours===h&&d.shift.hospital===hosp)return{...d,shift:null};return{...d,shift:{hours:h,hospital:hosp||d.shift?.hospital||""}}});
  const setHosp=h=>ud(k,d=>({...d,shift:d.shift?{...d.shift,hospital:h}:{hours:8,hospital:h}}));
  const toggleWo=t=>ud(k,d=>{const has=d.workouts.includes(t);return{...d,workouts:has?d.workouts.filter(w=>w!==t):[...d.workouts,t]}});
  const addEv=()=>{if(!ev.trim())return;ud(k,d=>({...d,events:[...(d.events||[]),ev.trim()]}));setEv("")};
  const rmEv=i=>ud(k,d=>({...d,events:(d.events||[]).filter((_,j)=>j!==i)}));

  return(
    <div className="pop" style={{left:x,top:y}} onClick={e=>e.stopPropagation()}>
      <h4>{lbl}<button onClick={close} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#bbb"}}>✕</button></h4>
      <div className="psec"><div className="plbl">Shift Hours</div><div className="prow">{[8,10,12,16,24].map(h=><button key={h} className={`sbtn ${day.shift?.hours===h?"on":""}`} onClick={()=>setShift(h,day.shift?.hospital||"")}>{h}h</button>)}{day.shift&&<button className="sbtn" onClick={()=>ud(k,d=>({...d,shift:null}))}>None</button>}</div></div>
      <div className="psec"><div className="plbl">Hospital</div><div className="prow">{HOSPITALS.map(h=>(<button key={h} className={`tb-hosp ${day.shift?.hospital===h?"on":""}`} style={{borderColor:HOSP_COLORS[h],background:day.shift?.hospital===h?HOSP_COLORS[h]:"#fff",color:day.shift?.hospital===h?"#fff":HOSP_COLORS[h]}} onClick={()=>setHosp(h)}>{h}</button>))}</div></div>
      {showTraining&&(<div className="psec"><div className="plbl">Workouts</div><div className="prow">{Object.entries(TYPES).map(([t,m])=>{const on=day.workouts.includes(t);return <button key={t} className={`wbtn ${on?"on":""}`} style={{borderColor:m.color,background:on?m.color:"#fff",color:on?"#fff":m.color}} onClick={()=>toggleWo(t)}>{m.icon} {m.label}</button>})}</div></div>)}
      <div className="psec"><button className={`vtog ${day.vacation?"on":""}`} onClick={()=>ud(k,d=>({...d,vacation:!d.vacation}))}>
        {day.vacation?"🏖️ On Vacation (remove)":"🏖️ Mark Vacation"}</button></div>
      <div className="psec"><div className="plbl">Events</div>
        {(day.events||[]).map((e,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:3,marginBottom:2}}><span className="etag">{e}</span><span style={{cursor:"pointer",color:"#ccc",fontSize:11}} onClick={()=>rmEv(i)}>×</span></div>))}
        <div style={{display:"flex",gap:3}}><input className="einp" placeholder="Add event..." value={ev} onChange={e=>setEv(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addEv()}}/><button className="sbtn" onClick={addEv} style={{padding:"3px 7px",fontSize:10}}>+</button></div>
      </div>
      <button className="pcls" onClick={close}>Done</button>
    </div>
  );
}
