"use client";
import { useState, useEffect, useRef } from "react";
import { loadPlanner, savePlanner } from "../lib/supabase";

/* ═══════════════════════════════════════════════
   70.3 TRAINING + WORK MONTHLY PLANNER
   Supabase sync with localStorage fallback
   ═══════════════════════════════════════════════ */

const RACE_DAY = new Date(2026, 8, 20);
const LS_KEY = "tri-planner-local";

const TYPES = {
  swim: { label: "Swim", icon: "🏊", color: "#0284c7", bg: "#e0f2fe" },
  bike: { label: "Bike", icon: "🚴", color: "#15803d", bg: "#dcfce7" },
  run:  { label: "Run",  icon: "🏃", color: "#c2410c", bg: "#fff7ed" },
};

const WORK_COLORS = { 8: "#1e293b", 10: "#334155", 12: "#0f172a" };

const YMCA_DEFAULT = {
  0: ["9:30a–11:50a","1–2:30p"],
  1: ["6:30–8:50a","10:10a–12:30p","3:30–4:50p","7:10–8:30p"],
  2: ["6:30–8:50a","9a–12:30p","3:30–4:20p","7:40–8:30p"],
  3: [], 4: [], 5: [], 6: [],
};

const EVENTS_PRESET = {
  "2026-04-05":["Easter"],"2026-05-03":["Cinci Marathon"],
  "2026-06-13":["Syl's Wedding"],"2026-06-24":["Triceratops Sprint"],
  "2026-06-26":["Family Reunion"],"2026-06-27":["Family Reunion"],"2026-06-28":["Family Reunion"],
  "2026-07-04":["July 4th"],"2026-07-22":["Pterodactyl Half"],"2026-07-26":["SF Half"],
  "2026-08-19":["T Rex Sprint"],"2026-08-23":["Chicago Tri"],
  "2026-09-12":["Robyn"],"2026-09-20":["🏁 FRANKFORT 70.3"],
};

// ── Utils ──
const ds = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addD = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
const getMonday = d => { const r=new Date(d); const day=r.getDay(); r.setDate(r.getDate()-day+(day===0?-6:1)); r.setHours(0,0,0,0); return r; };
const weeksTo = (a,b) => Math.max(0, Math.ceil((a-b)/(7*864e5)));

function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  let startOff = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const dim = new Date(year, month+1, 0).getDate();
  const cells = [];
  for (let i = startOff-1; i >= 0; i--) cells.push({ date: new Date(year, month, -i), out: true });
  for (let i = 1; i <= dim; i++) cells.push({ date: new Date(year, month, i), out: false });
  while (cells.length % 7) { const d = addD(new Date(year, month+1, 0), cells.length - startOff - dim + 1); cells.push({ date: d, out: true }); }
  return cells;
}

function getWeekStarts(year, month) {
  const dim = new Date(year, month+1, 0).getDate();
  const weeks = [];
  const seen = new Set();
  for (let i = 1; i <= dim; i++) {
    const d = new Date(year, month, i);
    const mon = getMonday(d);
    const k = ds(mon);
    if (!seen.has(k)) { seen.add(k); weeks.push(mon); }
  }
  return weeks;
}

// ── Default Data ──
function buildDefaults() {
  const d = {};
  const wk = (base, work, wo, vac) => {
    for (let i = 0; i < 7; i++) {
      const k = ds(addD(new Date(base), i));
      d[k] = { work: work[i]||0, workouts: wo[i]||[], vacation: vac?.includes(i)||false, events: EVENTS_PRESET[k]||[] };
    }
  };
  wk("2026-03-30",[12,8,0,8,0,0,0],[["bike"],["run"],["swim"],[],["swim"],[],["bike"]]);
  wk("2026-04-06",[12,0,0,12,8,0,0],[[],["swim"],["bike"],[],["swim"],["bike"],["run"]]);
  wk("2026-04-13",[8,10,8,8,0,0,0],[["swim"],["bike"],["run"],[],["swim"],["bike"],["run"]]);
  wk("2026-04-20",[0,8,8,0,12,8,0],[["swim"],["bike"],["run"],["swim"],[],["run"],["bike"]]);
  wk("2026-04-27",[12,8,8,0,0,0,0],[[],["bike"],["swim"],["run"],["swim"],[],["run"]]);
  wk("2026-05-04",[0,0,10,10,12,8,0],[[],["swim"],["bike"],["run"],[],["bike"],["run"]]);
  wk("2026-05-11",[0,10,12,0,10,0,0],[["swim"],["bike"],[],["swim"],["run"],["bike"],["run"]]);
  wk("2026-05-18",[8,8,8,0,0,0,0],[["swim"],["bike"],[],[],[],[],[]],[2,3,4,5,6]);
  wk("2026-05-25",[0,0,0,0,0,0,0],[[],[],[],[],[],[],[]],[0,1,2,3,4,5,6]);
  wk("2026-06-01",[0,0,8,8,12,0,0],[[],[],["swim"],["bike"],[],["bike"],["run"]],[0,1]);
  wk("2026-06-08",[0,0,12,10,10,0,0],[["swim"],["bike"],[],["run"],["swim"],["bike"],["run"]]);
  wk("2026-06-15",[12,8,0,12,0,0,0],[["bike"],["swim"],["run"],["swim"],[],["bike"],["run"]]);
  wk("2026-06-22",[12,10,8,10,0,0,0],[["bike"],[],[],[],["swim"],["bike"],["run"]]);
  wk("2026-06-29",[8,0,12,8,0,0,0],[["bike"],["swim"],[],["run"],["swim"],["bike"],["run"]]);
  wk("2026-07-06",[8,8,12,8,0,0,0],[["bike"],["swim"],[],["run"],["swim"],["bike"],["run"]]);
  wk("2026-07-13",[8,0,12,8,0,0,0],[["bike"],["swim"],[],["run"],["swim"],["bike"],["run"]]);
  wk("2026-07-20",[8,12,0,8,0,0,0],[["bike"],["swim"],[],["run"],["swim"],["bike"],["run"]]);
  wk("2026-07-27",[8,0,12,8,0,0,0],[["bike"],["swim"],[],["run"],["swim"],["bike"],["run"]]);
  wk("2026-08-03",[8,0,12,8,0,0,0],[["bike"],["swim"],[],["run"],["swim"],["bike"],["run"]]);
  wk("2026-08-10",[8,0,12,8,0,0,0],[["bike"],["swim"],[],["run"],["swim"],["bike"],["run"]]);
  wk("2026-08-17",[8,0,0,8,0,0,0],[["bike"],["swim"],[],["run"],["swim"],["bike"],["run"]]);
  wk("2026-08-24",[8,0,12,8,0,0,0],[["bike"],["swim"],[],["run"],["swim"],["bike"],["run"]]);
  wk("2026-08-31",[8,0,12,8,0,0,0],[["bike"],["swim"],[],["run"],["swim"],["bike"],["run"]]);
  wk("2026-09-07",[8,0,12,8,0,0,0],[["bike"],["swim"],[],["run"],["swim"],["bike"],["run"]]);
  wk("2026-09-14",[8,0,12,8,0,0,0],[["bike"],["swim"],[],["run"],[],[],[]]);
  wk("2026-09-21",[0,0,12,8,0,0,0],[[],["swim"],[],["run"],["swim"],["bike"],["run"]]);
  return d;
}

// ── localStorage helpers ──
function lsLoad() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function lsSave(schedule, swimHours) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ d: schedule, s: swimHours })); } catch {}
}

// ── Component ──
export default function Planner() {
  const [data, setData] = useState(null);
  const [mo, setMo] = useState(() => new Date().getMonth());
  const [yr, setYr] = useState(() => new Date().getFullYear());
  const [popup, setPopup] = useState(null);
  const [sel, setSel] = useState(null);
  const [drag, setDrag] = useState(null);
  const [drop, setDrop] = useState(null);
  const [ymca, setYmca] = useState(false);
  const [swim, setSwim] = useState(YMCA_DEFAULT);
  const [ok, setOk] = useState(false);
  const [syncStatus, setSyncStatus] = useState("loading"); // loading | synced | local | error

  // Load: try Supabase first, fall back to localStorage, then defaults
  useEffect(() => {
    (async () => {
      let loaded = false;

      // Try Supabase
      try {
        const remote = await loadPlanner();
        if (remote?.schedule) {
          setData(remote.schedule);
          if (remote.swim_hours) setSwim(remote.swim_hours);
          setSyncStatus("synced");
          loaded = true;
        }
      } catch (e) {
        console.warn("Supabase load failed, trying localStorage", e);
      }

      // Try localStorage
      if (!loaded) {
        const local = lsLoad();
        if (local?.d) {
          setData(local.d);
          if (local.s) setSwim(local.s);
          setSyncStatus("local");
          loaded = true;
        }
      }

      // Defaults
      if (!loaded) {
        setData(buildDefaults());
        setSyncStatus("local");
      }

      setOk(true);
    })();
  }, []);

  // Save: debounced to both Supabase and localStorage
  const sRef = useRef(null);
  useEffect(() => {
    if (!ok || !data) return;
    clearTimeout(sRef.current);
    sRef.current = setTimeout(async () => {
      // Always save to localStorage as backup
      lsSave(data, swim);

      // Try Supabase
      try {
        const success = await savePlanner(data, swim);
        setSyncStatus(success ? "synced" : "local");
      } catch {
        setSyncStatus("local");
      }
    }, 800);
  }, [data, swim, ok]);

  const now = new Date(); now.setHours(0,0,0,0);
  const nowKey = ds(now);
  const wLeft = weeksTo(RACE_DAY, now);
  const cells = getMonthGrid(yr, mo);
  const wStarts = getWeekStarts(yr, mo);

  const gd = k => data?.[k] || { work:0, workouts:[], vacation:false, events:[] };
  const ud = (k, fn) => setData(p => ({ ...p, [k]: fn(p[k] || { work:0, workouts:[], vacation:false, events:[] }) }));

  const mvWo = (fk, fi, tk) => {
    if (fk === tk) return;
    setData(p => {
      const f = { ...(p[fk]||{work:0,workouts:[],vacation:false,events:[]}), workouts:[...(p[fk]||{}).workouts||[]] };
      const t = { ...(p[tk]||{work:0,workouts:[],vacation:false,events:[]}), workouts:[...(p[tk]||{}).workouts||[]] };
      const w = f.workouts[fi]; if (!w) return p;
      f.workouts.splice(fi, 1);
      t.workouts.push(w);
      return { ...p, [fk]: f, [tk]: t };
    });
  };

  const mvWk = (fk, tk) => {
    if (fk === tk) return;
    setData(p => {
      const fh = (p[fk]||{}).work || 0;
      return { ...p, [fk]: { ...(p[fk]||{work:0,workouts:[],vacation:false,events:[]}), work: 0 }, [tk]: { ...(p[tk]||{work:0,workouts:[],vacation:false,events:[]}), work: fh } };
    });
  };

  // Budgets
  const budgets = wStarts.map(mon => {
    const end = addD(mon, 6);
    const c = { swim:0, bike:0, run:0 };
    for (let d = new Date(mon); d <= end; d = addD(d, 1)) {
      const day = gd(ds(d));
      (day.workouts||[]).forEach(w => { if (c[w] !== undefined) c[w]++; });
    }
    const isCur = now >= mon && now <= end;
    return { ...c, label: `${mon.getMonth()+1}/${mon.getDate()}`, isCur };
  });

  const prevMo = () => { if (mo===0){setMo(11);setYr(y=>y-1)}else setMo(m=>m-1) };
  const nextMo = () => { if (mo===11){setMo(0);setYr(y=>y+1)}else setMo(m=>m+1) };
  const goNow = () => { setMo(now.getMonth()); setYr(now.getFullYear()); };
  const mName = new Date(yr, mo).toLocaleDateString("en-US",{month:"long",year:"numeric"});

  // CSV Export
  const exportWork = () => {
    if (!data) return;
    const rows = [["Date","Day","Shift Hours","Start","End","Events"]];
    Object.keys(data).filter(k => data[k].work > 0).sort().forEach(k => {
      const d = data[k];
      const dt = new Date(k + "T12:00:00");
      const day = dt.toLocaleDateString("en-US",{weekday:"long"});
      const dateStr = dt.toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"});
      const end = d.work === 8 ? "3:00 PM" : d.work === 10 ? "5:00 PM" : "7:00 PM";
      const evts = (d.events||[]).join("; ");
      rows.push([dateStr, day, d.work, "7:00 AM", end, evts]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "kms-work-schedule.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const cellClick = (e, k, out) => {
    if (out) return;
    if (sel) {
      if (sel.t === "wo") mvWo(sel.k, sel.i, k);
      else mvWk(sel.k, k);
      setSel(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setPopup({ k, x: Math.min(r.right+4, window.innerWidth-260), y: Math.min(r.top, window.innerHeight-360) });
  };

  const onDS = (e, k, t, i) => { setDrag({k,t,i}); e.dataTransfer.effectAllowed="move"; e.stopPropagation(); };
  const onDO = (e, k) => { e.preventDefault(); setDrop(k); };
  const onDL = () => setDrop(null);
  const onDr = (e, tk) => {
    e.preventDefault(); setDrop(null);
    if (!drag) return;
    if (drag.t==="wo") mvWo(drag.k, drag.i, tk); else mvWk(drag.k, tk);
    setDrag(null);
  };

  if (!ok) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"}}>
      <div style={{textAlign:"center",color:"#999",fontSize:13}}>🏊🚴🏃 Loading...</div>
    </div>
  );

  return (
    <div>
      <div className="hdr">
        <div className="hdr-left">
          <div className="logo">70.3 Planner</div>
          <div className="race-pill">{wLeft}w to Frankfort</div>
          {syncStatus === "synced" && <span className="sync-ok">● synced</span>}
          {syncStatus === "local" && <span className="sync-err">● local only</span>}
        </div>
        <div className="nav">
          <button className="nbtn today" onClick={goNow}>Today</button>
          <button className="nbtn" onClick={prevMo}>◀</button>
          <div className="mlabel">{mName}</div>
          <button className="nbtn" onClick={nextMo}>▶</button>
          <button className="ymca-btn" onClick={()=>setYmca(!ymca)} title="YMCA Hours">🏊</button>
          <button className="nbtn" onClick={exportWork} title="Export Work Schedule CSV">📤 CSV</button>
          <button className="nbtn" onClick={()=>{if(confirm("Reset?"))setData(buildDefaults())}}>↺</button>
        </div>
      </div>

      <div className="budget">
        {budgets.map((b,i) => (
          <div key={i} className={`bwk ${b.isCur?"cur":""}`}>
            <span className="bwk-label">Wk {b.label}</span>
            {Object.entries(TYPES).map(([k,m]) => (
              <span key={k} className={`bpill ${b[k]>=2?"ok":""}`} style={{color:m.color}}>
                {m.icon}{b[k]}/2
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="ghd">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><div key={d} className="ghd-c">{d}</div>)}
      </div>

      <div className="grid">
        {cells.map(({date,out},ci) => {
          const k = ds(date);
          const day = gd(k);
          const isT = k===nowKey;
          const isP = date<now && !isT;
          const dow = date.getDay();
          const hasSw = (day.workouts||[]).includes("swim");
          const isStr = dow===1||dow===4;
          const isDrp = drop===k;
          const isSrc = sel?.k===k;
          const slots = swim[dow]||[];

          return (
            <div key={ci}
              className={`dc ${out?"out":""} ${isT?"tod":""} ${day.vacation?"vac":""} ${isDrp?"drp":""} ${isP?"past":""} ${isSrc?"src":""}`}
              onClick={e=>cellClick(e,k,out)}
              onDragOver={e=>onDO(e,k)}
              onDragLeave={onDL}
              onDrop={e=>onDr(e,k)}
            >
              <div style={{display:"flex",alignItems:"center",gap:3,flexWrap:"wrap"}}>
                <span className={`dnum ${isT?"tn":""}`}>{date.getDate()}</span>
                {day.work>0 && (
                  <span className="wb" style={{background:WORK_COLORS[day.work]||"#1e293b"}}
                    draggable onDragStart={e=>onDS(e,k,"wk",0)}
                    onClick={e=>{e.stopPropagation();setSel(sel?.k===k&&sel?.t==="wk"?null:{k,t:"wk"})}}
                  >
                    {day.work}h
                    <span className="x" onClick={e=>{e.stopPropagation();ud(k,d=>({...d,work:0}))}}>×</span>
                  </span>
                )}
              </div>

              {(day.events||[]).map((ev,ei)=><span key={ei} className="etag">{ev}</span>)}
              {day.vacation && <span className="etag" style={{background:"#fbbf24",color:"#78350f"}}>Vacation</span>}

              <div className="woa">
                {(day.workouts||[]).map((wo,wi) => {
                  const m = TYPES[wo]; if (!m) return null;
                  const bl = day.vacation;
                  const isSl = sel?.k===k&&sel?.t==="wo"&&sel?.i===wi;
                  const isDg = drag?.k===k&&drag?.t==="wo"&&drag?.i===wi;
                  return (
                    <span key={wi}
                      className={`wp ${bl?"blocked":""} ${isSl?"sel":""} ${isDg?"drg":""}`}
                      style={{color:m.color,borderColor:m.color,background:bl?"#f5f5f5":m.bg}}
                      draggable onDragStart={e=>onDS(e,k,"wo",wi)}
                      onClick={e=>{e.stopPropagation();setSel(isSl?null:{k,t:"wo",i:wi})}}
                    >
                      {m.icon}{m.label}
                      <span className="x" onClick={e=>{e.stopPropagation();ud(k,d=>({...d,workouts:d.workouts.filter((_,j)=>j!==wi)}));}}>×</span>
                    </span>
                  );
                })}
              </div>

              {isStr && (day.workouts||[]).length>0 && !day.vacation && !out && <span className="stag">+🏋️</span>}
              {hasSw && slots.length>0 && !day.vacation && <div className="swim-t">{slots.join(", ")}</div>}
            </div>
          );
        })}
      </div>

      {sel && (
        <div className="hint">
          Click a day to move {sel.t==="wk"?"shift":"workout"}
          <button onClick={()=>setSel(null)}>Cancel</button>
        </div>
      )}

      {popup && <>
        <div className="pov" onClick={()=>setPopup(null)}/>
        <DayPop k={popup.k} day={gd(popup.k)} x={popup.x} y={popup.y} ud={ud} close={()=>setPopup(null)}/>
      </>}

      <div className={`ypnl ${ymca?"open":""}`}>
        <div className="yt">🏊 YMCA Lap Swim Hours</div>
        <p style={{fontSize:10,color:"#999",marginBottom:10}}>Comma-separated. Update monthly.</p>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((n,dow)=>(
          <div key={dow} className="yr">
            <div className="yd">{n}</div>
            <input className="yi" defaultValue={(swim[dow]||[]).join(", ")} placeholder="e.g. 6:30–8:50a, 3:30–4:50p"
              onBlur={e=>{const v=e.target.value.trim();setSwim(p=>({...p,[dow]:v?v.split(",").map(s=>s.trim()).filter(Boolean):[]}))}}
            />
          </div>
        ))}
        <button className="ysave" onClick={()=>setYmca(false)}>Done</button>
      </div>
    </div>
  );
}

function DayPop({k, day, x, y, ud, close}) {
  const [ev, setEv] = useState("");
  const dt = new Date(k+"T12:00:00");
  const lbl = dt.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  const toggleW = h => ud(k, d=>({...d, work:d.work===h?0:h}));
  const toggleWo = t => ud(k, d=>{const has=d.workouts.includes(t);return{...d,workouts:has?d.workouts.filter(w=>w!==t):[...d.workouts,t]};});
  const addEv = () => {if(!ev.trim())return;ud(k,d=>({...d,events:[...(d.events||[]),ev.trim()]}));setEv("");};
  const rmEv = i => ud(k,d=>({...d,events:(d.events||[]).filter((_,j)=>j!==i)}));

  return (
    <div className="pop" style={{left:x,top:y}} onClick={e=>e.stopPropagation()}>
      <h4>{lbl}<button onClick={close} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#bbb"}}>✕</button></h4>
      <div className="psec">
        <div className="plbl">Work Shift</div>
        <div className="prow">
          {[8,10,12].map(h=><button key={h} className={`sbtn ${day.work===h?"on":""}`} onClick={()=>toggleW(h)}>{h}h</button>)}
          {day.work>0&&<button className="sbtn" onClick={()=>ud(k,d=>({...d,work:0}))}>None</button>}
        </div>
      </div>
      <div className="psec">
        <div className="plbl">Workouts</div>
        <div className="prow">
          {Object.entries(TYPES).map(([t,m])=>{
            const on=day.workouts.includes(t);
            return <button key={t} className={`wbtn ${on?"on":""}`}
              style={{borderColor:m.color,background:on?m.color:"#fff",color:on?"#fff":m.color}}
              onClick={()=>toggleWo(t)}>{m.icon} {m.label}</button>;
          })}
        </div>
      </div>
      <div className="psec">
        <button className={`vtog ${day.vacation?"on":""}`} onClick={()=>ud(k,d=>({...d,vacation:!d.vacation}))}>
          {day.vacation?"🏖️ On Vacation (remove)":"🏖️ Mark Vacation"}
        </button>
      </div>
      <div className="psec">
        <div className="plbl">Events</div>
        {(day.events||[]).map((e,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:3,marginBottom:2}}>
            <span className="etag">{e}</span>
            <span style={{cursor:"pointer",color:"#ccc",fontSize:11}} onClick={()=>rmEv(i)}>×</span>
          </div>
        ))}
        <div style={{display:"flex",gap:3}}>
          <input className="einp" placeholder="Add event..." value={ev} onChange={e=>setEv(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addEv()}}/>
          <button className="sbtn" onClick={addEv} style={{padding:"3px 7px",fontSize:10}}>+</button>
        </div>
      </div>
      <button className="pcls" onClick={close}>Done</button>
    </div>
  );
}
