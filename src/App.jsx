import { useState, useEffect, useRef, useCallback } from "react";

const SB_URL = "https://ncqsuxqxujyfekjbgzch.supabase.co";
const SB_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcXN1eHF4dWp5ZmVramJnemNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTcyMjAsImV4cCI6MjA5MDQ3MzIyMH0.xgwXSHE8dijOa7dtnzZ-CEG1_sP6L3yFvp3JYJ7LE3w";
const HUB     = "https://wylvex-backend-production.up.railway.app";

async function sbInsert(table, body) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
    if (!r.ok) return null;
    return r.json().catch(() => null);
  } catch { return null; }
}
function fbTrack(evt, data) {
  try { window.fbq && window.fbq("track", evt, data); } catch {}
}

async function salvarLead(dados) {
  const row = {
    nome: dados.nome, clinica: dados.clinica||"",
    whatsapp: (dados.whatsapp||"").replace(/\D/g,""),
    tel: (dados.whatsapp||"").replace(/\D/g,""),
    email: dados.email||"",
    pacientes: parseInt(dados.pacientes)||20,
    dor: dados.dor||"",
    perda: parseInt(dados.perda)||0,
    score: parseInt(Math.min(99, 60+(dados.perda>5000?20:dados.perda>2000?12:5)+(dados.dor?10:0)+((parseInt(dados.pacientes)||20)>30?5:0))),
    clinica_id: "wylvex", origem: "lp", status: "novo",
  };
  try {
    await sbInsert("leads", row);
    fbTrack("Lead", { content_name: "Diagnóstico Ritual", currency: "BRL", value: row.perda||0 });
    // Mensagem enviada só ao confirmar agendamento (salvarReuniao)
  } catch(e) { console.error("salvarLead:", e.message); }
  return row;
}

async function salvarReuniao(dados){
  const nova={
    nome:dados.nome, clinica:dados.clinica||"", tel:dados.tel||"",
    whatsapp:dados.tel||"", email:dados.email||"",
    data:dados.data, hora:dados.hora, dia:dados.dia,
    score:dados.score||0, perda:dados.perda||0,
    status:"agendada", origem:"lp", clinica_id:"wylvex",
  };
  try{
    await sbInsert("reunioes", nova);
    fbTrack("Schedule", {content_name:"Call Ritual",currency:"BRL",value:nova.perda||0,content_category:"call_agendada",num_items:1});
    fetch(`${HUB}/api/confirm-lead`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({phone:((dados.tel||"").replace(/\D/g,"").startsWith("55")?"":"55")+(dados.tel||"").replace(/\D/g,""),nome:dados.nome,clinica:dados.clinica,data:dados.data,hora:dados.hora})
    }).catch(()=>{});
  }catch(e){console.error("salvarReuniao:",e.message);}
  return nova;
}
/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
const DIAS=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const MESES=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
function gerarSlots(){
  // Usa horário local do browser (Brasil = UTC-3)
  // Garante que dateStr e bloqueio de hora passada usam o mesmo timezone
  const slots=[];
  const now=new Date();
  // Local date string sem dependência de UTC
  const localDateStr=(d)=>{
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,"0");
    const day=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  };
  const nowMin=now.getHours()*60+now.getMinutes(); // hora local
  const HORAS=["09:00","10:00","11:00","13:00","14:00","15:00","16:00"];
  for(let d=0;d<=21;d++){
    const dt=new Date(now.getFullYear(),now.getMonth(),now.getDate()+d); // midnight local
    if(dt.getDay()===0||dt.getDay()===6)continue;
    const dateStr=localDateStr(dt);
    HORAS.forEach(h=>{
      const [hh,mm]=h.split(":").map(Number);
      const slotMin=hh*60+mm;
      // Bloqueia slots do dia atual que já passaram + 90min de buffer
      if(d===0&&slotMin<=nowMin+90)return;
      slots.push({dt,h,
        key:`${dateStr}:${h}`,
        label:`${DIAS[dt.getDay()]}, ${dt.getDate()} de ${MESES[dt.getMonth()]}`,
        dateStr});
    });
  }
  return slots;
}
function calcPerda(p,t){return Math.round((p||20)*(t||500)*0.18);}
function sanitize(s){return typeof s==="string"?s.trim().replace(/[<>]/g,"").slice(0,150):s;}

/* ══════════════════════════════════════
   ANIMATED COUNTER
══════════════════════════════════════ */
function Counter({target,prefix="R$ ",suffix="/mês",duration=1800}){
  const [val,setVal]=useState(0);
  const ran=useRef(false);
  const ref=useRef(null);
  useEffect(()=>{
    const obs=new IntersectionObserver(([e])=>{
      if(e.isIntersecting&&!ran.current){
        ran.current=true;
        let start=0;const step=target/60;let t=0;
        const tick=setInterval(()=>{
          t+=step;if(t>=target){setVal(target);clearInterval(tick);}
          else setVal(Math.round(t));
        },duration/60);
      }
    },{threshold:.3});
    if(ref.current)obs.observe(ref.current);
    return()=>obs.disconnect();
  },[target,duration]);
  return(<span ref={ref}>{prefix}{val.toLocaleString("pt-BR")}{suffix}</span>);
}

/* ══════════════════════════════════════
   REVEAL ON SCROLL
══════════════════════════════════════ */
function Reveal({children,delay=0,direction="up",className=""}){
  const ref=useRef(null);
  const [vis,setVis]=useState(false);
  useEffect(()=>{
    const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting)setVis(true);},{threshold:.15});
    if(ref.current)obs.observe(ref.current);
    return()=>obs.disconnect();
  },[]);
  const transforms={up:"translateY(32px)",down:"translateY(-32px)",left:"translateX(-32px)",right:"translateX(32px)",scale:"scale(0.92)"};
  return(
    <div ref={ref} className={className} style={{
      opacity:vis?1:0,transform:vis?"none":transforms[direction]||transforms.up,
      transition:`opacity .7s cubic-bezier(.16,1,.3,1) ${delay}ms, transform .7s cubic-bezier(.16,1,.3,1) ${delay}ms`
    }}>{children}</div>
  );
}

/* ══════════════════════════════════════
   MINI DEMO
══════════════════════════════════════ */
function MiniDemo({perda,pacientes}){
  const chart=[18,24,21,30,27,38,35,46,42,55,51,64];
  const pacientes_demo=[
    {n:"Ana Lima",proc:"Toxina botulínica",status:"retorno hoje",urgente:true,diasStatus:"#c9956c"},
    {n:"Carla M.",proc:"Preenchimento labial",status:"venceu ontem",urgente:true,diasStatus:"#ef4444"},
    {n:"Bianca R.",proc:"Bioestimulador",status:"em 12 dias",urgente:false,diasStatus:"rgba(240,217,204,.3)"},
    {n:"Fernanda S.",proc:"Protocolo facial",status:"em 18 dias",urgente:false,diasStatus:"rgba(240,217,204,.3)"},
  ];
  const max=Math.max(...chart),min=Math.min(...chart);
  const px=(i)=>((i/(chart.length-1))*220).toFixed(1);
  const py=(v)=>((1-(v-min)/(max-min))*34+4).toFixed(1);
  const path=chart.map((v,i)=>`${i===0?"M":"L"}${px(i)},${py(v)}`).join(" ");
  return(
    <div style={{background:"#0a0608",borderRadius:18,overflow:"hidden",border:"1px solid rgba(201,149,108,.25)",boxShadow:"0 32px 80px rgba(0,0,0,.7),0 0 0 1px rgba(201,149,108,.08)",fontFamily:"'Jost',sans-serif"}}>
      <div style={{height:2,background:"linear-gradient(90deg,transparent 0%,#c9956c 30%,#f0d9cc 50%,#c9956c 70%,transparent 100%)"}}/>
      {/* Header */}
      <div style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,borderRadius:8,background:"rgba(201,149,108,.12)",border:"1px solid rgba(201,149,108,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#c9956c",fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic"}}>R</div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:"#f0d9cc",letterSpacing:.3}}>Ritual · Dashboard</div>
            <div style={{fontSize:8,color:"rgba(255,255,255,.22)",letterSpacing:.5}}>Jornada da Paciente · ao vivo</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",borderRadius:20,padding:"3px 10px"}}>
          <div style={{width:4,height:4,borderRadius:"50%",background:"#10b981"}}/>
          <span style={{fontSize:8,color:"#10b981",fontWeight:700}}>Sistema ativo</span>
        </div>
      </div>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
        {[
          {l:"Faturamento",v:"R$ 2.840",delta:"+23%",cor:"#c9956c"},
          {l:"Pacientes hoje",v:`${Math.min(pacientes||20,14)}`,delta:"3 retornos",cor:"#f0d9cc"},
          {l:"Recuperadas",v:`R${(perda/1000).toFixed(0)}k`,delta:"este mês",cor:"#10b981"},
        ].map((k,i)=>(
          <div key={i} style={{padding:"10px 12px",borderRight:i<2?"1px solid rgba(255,255,255,.04)":"none"}}>
            <div style={{fontSize:7,color:"rgba(255,255,255,.22)",letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>{k.l}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:k.cor,lineHeight:1,marginBottom:2}}>{k.v}</div>
            <div style={{fontSize:8,color:"#10b981",fontWeight:600}}>{k.delta}</div>
          </div>
        ))}
      </div>
      {/* Chart */}
      <div style={{padding:"10px 14px 6px",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
        <div style={{fontSize:7,color:"rgba(255,255,255,.18)",letterSpacing:1,textTransform:"uppercase",marginBottom:5}}>Faturamento · 12 meses</div>
        <div style={{position:"relative",height:42}}>
          <svg width="100%" height="42" viewBox="0 0 220 42" preserveAspectRatio="none" style={{position:"absolute",inset:0}}>
            <defs>
              <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c9956c" stopOpacity=".25"/>
                <stop offset="100%" stopColor="#c9956c" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d={`${path} L220,42 L0,42 Z`} fill="url(#rg)"/>
            <path d={path} fill="none" stroke="#c9956c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx={px(chart.length-1)} cy={py(chart[chart.length-1])} r="3" fill="#c9956c"/>
          </svg>
        </div>
      </div>
      {/* Pacientes */}
      <div style={{padding:"10px 14px"}}>
        <div style={{fontSize:7,color:"rgba(255,255,255,.18)",letterSpacing:1,textTransform:"uppercase",marginBottom:7}}>Jornada das pacientes · agora</div>
        <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:8}}>
          {pacientes_demo.map((p,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:p.urgente?"rgba(201,149,108,.04)":"rgba(255,255,255,.015)",border:`1px solid ${p.urgente?"rgba(201,149,108,.12)":"rgba(255,255,255,.04)"}`,borderRadius:8,padding:"6px 10px"}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:`${p.diasStatus}18`,border:`1px solid ${p.diasStatus}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:p.diasStatus,flexShrink:0}}>{p.n.charAt(0)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,fontWeight:600,color:p.urgente?"#f0d9cc":"rgba(255,255,255,.3)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.n}</div>
                <div style={{fontSize:8,color:"rgba(255,255,255,.2)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.proc}</div>
              </div>
              <div style={{fontSize:8,color:p.diasStatus,fontWeight:700,background:`${p.diasStatus}12`,borderRadius:10,padding:"2px 7px",flexShrink:0,whiteSpace:"nowrap"}}>{p.status}</div>
            </div>
          ))}
        </div>
        <div style={{background:"rgba(201,149,108,.06)",border:"1px solid rgba(201,149,108,.14)",borderRadius:8,padding:"7px 10px",display:"flex",alignItems:"center",gap:7}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:"#c9956c",flexShrink:0,animation:"pulse_d 1.8s infinite"}}/>
          <div style={{fontSize:9,color:"#c9956c",fontWeight:600}}>Sistema identificou 3 retornos hoje — mensagem enviada automaticamente</div>
        </div>
      </div>
      <div style={{padding:"5px 14px 9px",display:"flex",justifyContent:"space-between"}}>
        <div style={{fontSize:7,color:"rgba(255,255,255,.1)",letterSpacing:1}}>RITUAL · JORNADA DA PACIENTE</div>
        <div style={{fontSize:7,color:"rgba(255,255,255,.08)"}}>pré-visualização</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   AGENDADOR
══════════════════════════════════════ */
function Agendador({leadData}){
  const [blocked,setBlocked]=useState({});
  const [loadingSlots,setLoadingSlots]=useState(true);
  const [erroSalvar,setErroSalvar]=useState(null);
  const slots=gerarSlots(); // recalcula no mount — sem cache stale
  const diasUniq=(()=>{const seen=new Set();return slots.filter(s=>{if(seen.has(s.dateStr))return false;seen.add(s.dateStr);return true;});})();
  const [selDia,setSelDia]=useState(null);
  const [selHora,setSelHora]=useState(null);
  const [status,setStatus]=useState("idle");

  const carregarOcupados=async()=>{
    try{
      const r=await fetch(`${SB_URL}/rest/v1/reunioes?clinica_id=eq.wylvex&status=eq.agendada&select=data,hora`,
        {headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`}});
      const rows=await r.json();
      const b={};(rows||[]).forEach(x=>{if(x.data&&x.hora)b[`${x.data}:${x.hora}`]=true;});
      setBlocked(b);
    }catch{}
    setLoadingSlots(false);
  };

  useEffect(()=>{
    carregarOcupados();
    const iv=setInterval(carregarOcupados,60000); // recarrega a cada 60s
    return()=>clearInterval(iv);
  },[]);

  // FIX: usa gerarSlots filtrado — horários passados de HOJE nunca aparecem
  const horasParaDia=selDia?slots.filter(s=>s.dateStr===selDia.dateStr&&!blocked[s.key]).map(s=>s.h):[];

  const confirmar=async()=>{
    if(!selDia||!selHora||status==="loading")return;
    setErroSalvar(null);setStatus("loading");
    try{
      await salvarReuniao({
        data:selDia.dateStr,hora:selHora,dia:selDia.label,
        nome:leadData.nome,tel:leadData.tel,
        email:leadData.email||"",clinica:leadData.clinica||"",
        score:leadData.score||0,perda:leadData.perda||0
      });
      setBlocked(b=>({...b,[`${selDia.dateStr}:${selHora}`]:true})); // atualiza só após sucesso
      setStatus("done");
    }catch(e){
      setStatus("idle");
      setErroSalvar("Erro ao confirmar. Tente novamente ou fale pelo WhatsApp.");
    }
  };

  if(status==="done")return(
    <div style={{textAlign:"center",padding:"28px 20px",animation:"fadeIn .6s ease"}}>
      <div style={{fontSize:40,marginBottom:12}}>✨</div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#f0d9cc",marginBottom:6}}>Call confirmada.</div>
      <div style={{fontSize:14,color:"#10b981",fontWeight:700,marginBottom:6}}>{selDia?.label} · {selHora}</div>
      <div style={{fontSize:12,color:"rgba(240,217,204,.35)",lineHeight:1.8}}>Você vai receber a confirmação no WhatsApp.<br/>Nossa equipe estará pronta com seu diagnóstico completo.</div>
    </div>
  );

  return(
    <div>
      <div style={{fontSize:9,color:"rgba(201,149,108,.6)",fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:14,display:"flex",alignItems:"center",gap:6}}>
        <div style={{width:5,height:5,borderRadius:"50%",background:"#c9956c"}}/>
        Agende sua call gratuita
      </div>
      {/* Dias */}
      <div style={{fontSize:9,color:"rgba(240,217,204,.3)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Escolha o dia</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5,marginBottom:16}}>
        {diasUniq.slice(0,10).map((d,i)=>{
          const sel=selDia?.dateStr===d.dateStr;
          const temVaga=slots.some(s=>s.dateStr===d.dateStr&&!blocked[s.key]);
          return(<button key={i} disabled={!temVaga||loadingSlots} onClick={()=>{setSelDia(d);setSelHora(null);}}
            style={{background:sel?"rgba(255,92,26,.15)":temVaga?"rgba(255,255,255,.04)":"rgba(255,255,255,.01)",border:`1.5px solid ${sel?"#FF5C1A":temVaga?"rgba(255,255,255,.08)":"rgba(255,255,255,.03)"}`,borderRadius:10,padding:"10px 4px",cursor:temVaga&&!loadingSlots?"pointer":"not-allowed",opacity:temVaga?1:.35,transition:"all .2s"}}>
            <div style={{fontSize:7,color:sel?"#FF5C1A":"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:1,fontWeight:700}}>{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d.dt.getDay()]}</div>
            <div style={{fontSize:14,fontWeight:700,color:sel?"#FF5C1A":temVaga?"rgba(255,255,255,.8)":"rgba(255,255,255,.3)",marginTop:1}}>{d.dt.getDate()}</div>
            <div style={{fontSize:7,color:sel?"rgba(255,92,26,.6)":"rgba(255,255,255,.2)"}}>{["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][d.dt.getMonth()]}</div>
          </button>);
        })}
      </div>
      {/* Horários — usa horasParaDia (filtrado de gerarSlots) */}
      {selDia&&<>
        <div style={{fontSize:9,color:"rgba(240,217,204,.3)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>
          Horário disponível {!loadingSlots&&horasParaDia.length===0?"— sem vagas neste dia":""}
        </div>
        {loadingSlots?<div style={{textAlign:"center",padding:"12px",fontSize:11,color:"rgba(255,255,255,.2)"}}>Carregando...</div>:
         horasParaDia.length===0?<div style={{textAlign:"center",padding:"16px",fontSize:12,color:"rgba(255,255,255,.3)"}}>Sem horários disponíveis.<br/><span style={{fontSize:11,color:"rgba(201,149,108,.5)"}}>Escolha outro dia →</span></div>:
         <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:14}}>
          {horasParaDia.map(h=>{
            const sel=selHora===h;
            return(<button key={h} onClick={()=>setSelHora(sel?null:h)}
              style={{background:sel?"linear-gradient(135deg,#FF5C1A,#da4600)":"rgba(255,255,255,.04)",border:`1px solid ${sel?"#FF5C1A":"rgba(255,255,255,.08)"}`,borderRadius:8,padding:"10px 4px",cursor:"pointer",transition:"all .2s"}}>
              <div style={{fontSize:11,fontWeight:700,color:sel?"white":"rgba(255,255,255,.75)"}}>{h}</div>
            </button>);
          })}
        </div>}
      </>}
      {/* Confirmar */}
      {selDia&&selHora&&<div style={{animation:"fadeUp .35s ease"}}>
        <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:12,color:"rgba(240,217,204,.6)",textAlign:"center"}}>
          ✨ {selDia.label} · {selHora} · 30 minutos
        </div>
        {erroSalvar&&<div style={{background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.2)",borderRadius:8,padding:"10px",marginBottom:10,fontSize:11,color:"#ef4444",textAlign:"center"}}>{erroSalvar}</div>}
        <button disabled={status==="loading"} onClick={confirmar}
          style={{background:status==="loading"?"rgba(255,255,255,.04)":"linear-gradient(135deg,#FF5C1A,#da4600)",border:"none",borderRadius:12,padding:"15px",cursor:status==="loading"?"not-allowed":"pointer",color:status==="loading"?"rgba(255,255,255,.3)":"white",fontSize:14,fontWeight:800,fontFamily:"'Plus Jakarta Sans',sans-serif",width:"100%",transition:"all .2s"}}>
          {status==="loading"?"Confirmando...":"Confirmar minha call →"}
        </button>
        <div style={{fontSize:10,color:"rgba(255,255,255,.2)",textAlign:"center",marginTop:10}}>Gratuita · 30 minutos · Diagnóstico ao vivo</div>
      </div>}
    </div>
  );
}


/* ══════════════════════════════════════
   CANVAS PARTICLES
══════════════════════════════════════ */
function ParticleCanvas(){
  const ref=useRef(null);
  useEffect(()=>{
    const c=ref.current;if(!c)return;
    const ctx=c.getContext("2d");
    const resize=()=>{c.width=c.offsetWidth;c.height=c.offsetHeight;};resize();
    const N=window.innerWidth<640?18:32;
    const pts=Array.from({length:N},()=>({
      x:Math.random()*c.width,y:Math.random()*c.height,
      vx:(Math.random()-.5)*.12,vy:(Math.random()-.5)*.12,
      r:Math.random()*.7+.2,opacity:Math.random()*.5+.1
    }));
    let fc=0,raf;
    const draw=()=>{
      fc++;if(fc%2!==0&&window.innerWidth<640){raf=requestAnimationFrame(draw);return;}
      ctx.clearRect(0,0,c.width,c.height);
      pts.forEach(p=>{
        p.x+=p.vx;p.y+=p.vy;
        if(p.x<0||p.x>c.width)p.vx*=-1;if(p.y<0||p.y>c.height)p.vy*=-1;
        ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(201,149,108,${p.opacity*.15})`;ctx.fill();
      });
      for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
        const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<90){
          ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);
          ctx.strokeStyle=`rgba(201,149,108,${.025*(1-d/90)})`;ctx.lineWidth=.4;ctx.stroke();
        }
      }
      raf=requestAnimationFrame(draw);
    };
    draw();window.addEventListener("resize",resize);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);};
  },[]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}/>;
}

/* ══════════════════════════════════════
   MAIN APP
══════════════════════════════════════ */
export default function App(){
  // Fase: hero → form (diagnóstico curto) → resultado + agendar
  const [fase,setFase]=useState("hero"); // hero | form | resultado
  const [step,setStep]=useState(0); // etapas do form
  const [res,setRes]=useState({});
  const [form,setForm]=useState({nome:"",clinica:"",whatsapp:"",email:""});
  const [loading,setLoading]=useState(false);
  const [savedLead,setSavedLead]=useState(null);
  const [scrollY,setScrollY]=useState(0);
  const [isMobile,setIsMobile]=useState(false);
  const [cursor,setCursor]=useState({x:-200,y:-200});
  const [cursorScale,setCursorScale]=useState(1);
  const topo=useRef(null);

  useEffect(()=>{
    const ck=()=>setIsMobile(window.innerWidth<768);ck();
    const sc=()=>setScrollY(window.scrollY);
    const mm=(e)=>setCursor({x:e.clientX,y:e.clientY});
    window.addEventListener("resize",ck);
    window.addEventListener("scroll",sc,{passive:true});
    window.addEventListener("mousemove",mm);
    // Fonts
    const F="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&family=Jost:wght@300;400;500;600;700&family=Syne:wght@700;800;900&family=Unbounded:wght@700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
    if(!document.querySelector(`link[href="${F}"]`)){const l=document.createElement("link");l.rel="stylesheet";l.href=F;l.media="print";l.onload=()=>{l.media="all";};document.head.appendChild(l);}
    return()=>{window.removeEventListener("resize",ck);window.removeEventListener("scroll",sc);window.removeEventListener("mousemove",mm);};
  },[]);

  const perda=calcPerda(res.pacientes,res.ticket);

  const ETAPAS=[
    {id:"pacientes",tipo:"slider",titulo:"Quantas pacientes você atende por mês?",sub:"Calcularemos exatamente quanto você está perdendo.",min:5,max:120,step:5,uni:"pacientes/mês"},
    {id:"ticket",tipo:"cards",titulo:"Qual seu ticket médio por procedimento?",sub:"Necessário para calcular sua perda real.",ops:[
      {ic:"💫",l:"Até R$ 300",v:250},{ic:"✨",l:"R$ 300 – R$ 600",v:450},
      {ic:"💎",l:"R$ 600 – R$ 1.500",v:900},{ic:"👑",l:"Acima de R$ 1.500",v:1800}
    ]},
    {id:"dor",tipo:"cards",titulo:"O que mais trava sua clínica hoje?",sub:"Uma resposta. A que mais dói.",ops:[
      {ic:"👻",l:"Paciente que some antes do retorno"},{ic:"📸",l:"Fotos e protocolos espalhados"},
      {ic:"📋",l:"Consentimento perdido ou no papel"},{ic:"📱",l:"WhatsApp pessoal misturado"},
      {ic:"🗓️",l:"Agenda com buraco sem lista de espera"},{ic:"😰",l:"Protocolo só na minha cabeça"}
    ]},
    {id:"contato",tipo:"form",titulo:"Última etapa.",sub:"Para onde enviamos o diagnóstico completo?"},
  ];

  const etapaAtual=ETAPAS[step];

  const goNext=(val,campo)=>{
    if(campo)setRes(p=>({...p,[campo]:val}));
    if(step<ETAPAS.length-1){setStep(s=>s+1);}
  };

  const handleSubmit=async()=>{
    const wLen=(form.whatsapp||"").replace(/\D/g,"").length;
    if(!form.nome.trim()||wLen<10)return;
    setLoading(true);
    try{
      const dadosCompletos={...res,...form,nome:sanitize(form.nome),clinica:sanitize(form.clinica),
        whatsapp:sanitize(form.whatsapp),email:sanitize(form.email||""),perda};
      const lead=await salvarLead(dadosCompletos);
      setSavedLead({...dadosCompletos,...lead});
    }catch(e){console.error("submit:",e.message);}
    setLoading(false);setFase("resultado");
    if(topo.current)topo.current.scrollIntoView({behavior:"smooth"});
  };

  const entrarForm=()=>{
    setFase("form");setStep(0);
    if(topo.current)topo.current.scrollIntoView({behavior:"smooth"});
  };

  return(
    <div ref={topo} style={{fontFamily:"'Jost',sans-serif",background:"#0A0A0B",color:"#e8d8cc",minHeight:"100vh",overflowX:"hidden",cursor:isMobile?"auto":"none"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        ::-webkit-scrollbar{width:2px}
        ::-webkit-scrollbar-thumb{background:rgba(201,149,108,.3);border-radius:2px}
        @media(pointer:coarse){body{cursor:auto!important}}

        @keyframes float{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-14px) rotate(1deg)}}
        @keyframes floatR{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-10px) rotate(-1deg)}}
        @keyframes pulse_d{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.4)}}
        @keyframes shimmer_g{0%{background-position:-300% center}100%{background-position:300% center}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes orb1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-30px) scale(1.1)}66%{transform:translate(-20px,20px) scale(.95)}}
        @keyframes orb2{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-50px,40px) scale(.9)}66%{transform:translate(30px,-20px) scale(1.05)}}
        @keyframes lineGrow{from{stroke-dashoffset:1000}to{stroke-dashoffset:0}}
        @keyframes cardIn{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes spin_slow{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(201,149,108,.1)}50%{box-shadow:0 0 40px rgba(201,149,108,.25)}}

        .shimmer-g{
          background:linear-gradient(90deg,#c9956c 0%,#f0d9cc 25%,#fffaf5 50%,#f0d9cc 75%,#c9956c 100%);
          background-size:300% auto;
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;
          animation:shimmer_g 4s linear infinite;
        }

        .opt{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:14px 12px;cursor:pointer;transition:all .22s cubic-bezier(.16,1,.3,1);display:flex;align-items:center;gap:10px;position:relative;overflow:hidden}
        .opt::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(201,149,108,.06),transparent);opacity:0;transition:opacity .2s}
        .opt:hover{background:rgba(201,149,108,.07);border-color:rgba(201,149,108,.3);transform:translateX(4px)}
        .opt:hover::before{opacity:1}
        .opt.active{background:rgba(201,149,108,.12);border-color:#c9956c;box-shadow:0 0 0 1px rgba(201,149,108,.3)}

        .inp{background:rgba(255,255,255,.035);border:1.5px solid rgba(255,255,255,.08);color:#f0d9cc;padding:14px 16px;border-radius:10px;font-size:15px;width:100%;outline:none;font-family:'Jost',sans-serif;transition:border-color .2s}
        .inp:focus{border-color:rgba(201,149,108,.45);background:rgba(201,149,108,.03)}
        .inp::placeholder{color:rgba(240,217,204,.18)}

        .cta{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#c9956c 0%,#b8845b 100%);color:white;padding:16px 36px;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;border:none;transition:all .25s cubic-bezier(.16,1,.3,1);font-family:'Jost',sans-serif;box-shadow:0 8px 28px rgba(201,149,108,.22),inset 0 1px 0 rgba(255,255,255,.12);letter-spacing:.3px}
        .cta:hover{transform:translateY(-2px);box-shadow:0 18px 48px rgba(201,149,108,.38),inset 0 1px 0 rgba(255,255,255,.15)}
        .cta:disabled{opacity:.4;transform:none}

        .card{background:rgba(14,10,16,.88);border:1px solid rgba(201,149,108,.1);border-radius:18px;position:relative;overflow:hidden;backdrop-filter:blur(20px)}
        .card::before{content:"";position:absolute;top:0;left:0;right:0;height:1.5px;background:linear-gradient(90deg,transparent 0%,#c9956c 30%,#f0d9cc 50%,#c9956c 70%,transparent 100%)}

        .prog{height:3px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;margin-bottom:20px}
        .prog-inner{height:100%;background:linear-gradient(90deg,#c9956c,#f0d9cc);border-radius:2px;transition:width .5s cubic-bezier(.16,1,.3,1)}

        .back-btn{background:none;border:none;color:rgba(240,217,204,.3);cursor:pointer;font-size:12px;font-family:'Jost',sans-serif;padding:0;transition:color .2s}
        .back-btn:hover{color:rgba(240,217,204,.6)}

        input[type=range]{-webkit-appearance:none;width:100%;height:3px;background:rgba(255,255,255,.1);border-radius:2px;outline:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#c9956c;cursor:pointer;box-shadow:0 0 12px rgba(201,149,108,.4);transition:transform .15s}
        input[type=range]::-webkit-slider-thumb:hover{transform:scale(1.2)}

        /* GRAIN */
        .grain::after{content:"";position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");opacity:.022;pointer-events:none;z-index:9999;}

        /* ── Stitch Obsidian tokens ── */
        :root{--orange:#FF5C1A;--gold:#D4AF37;--cream:#f0d9cc;--bg:#0A0A0B;--s1:#131314;--s2:#1c1b1c;}
        .shimmer-gold{background:linear-gradient(90deg,#c9956c 0%,#D4AF37 20%,#FFE088 50%,#D4AF37 80%,#c9956c 100%);background-size:300% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer_g 4s linear infinite}
        .glass-card{background:rgba(28,27,28,.5);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06)}
        .oracle-border{border:1px solid transparent;background:linear-gradient(#0A0A0B,#0A0A0B) padding-box,linear-gradient(135deg,#FF5C1A,#D4AF37) border-box}
        .cta-orange{background:linear-gradient(135deg,#FF5C1A 0%,#da4600 100%)!important;box-shadow:0 8px 28px rgba(255,92,26,.28),inset 0 1px 0 rgba(255,255,255,.15)!important}
        .cta-orange:hover{box-shadow:0 18px 48px rgba(255,92,26,.45),inset 0 1px 0 rgba(255,255,255,.18)!important}
        @keyframes orb-pulse{0%,100%{opacity:.12}50%{opacity:.22}}
        .orb-orange{background:radial-gradient(circle,rgba(255,92,26,.15) 0%,transparent 65%);filter:blur(60px);animation:orb-pulse 8s ease-in-out infinite}
        .orb-gold{background:radial-gradient(circle,rgba(212,175,55,.1) 0%,transparent 65%);filter:blur(70px);animation:orb-pulse 10s ease-in-out infinite;animation-delay:3s}
        /* Grid background */
        .grid-bg-lp{background-image:radial-gradient(circle at 1px 1px,rgba(255,255,255,.02) 1px,transparent 0);background-size:48px 48px}
      `}</style>

      {/* CURSOR CUSTOM */}
      {!isMobile&&<>
        <div style={{position:"fixed",left:cursor.x-5,top:cursor.y-5,width:10,height:10,borderRadius:"50%",background:"#c9956c",pointerEvents:"none",zIndex:10000,transform:`scale(${cursorScale})`,transition:"transform .15s",mixBlendMode:"screen"}}/>
        <div style={{position:"fixed",left:cursor.x-22,top:cursor.y-22,width:44,height:44,borderRadius:"50%",border:"1px solid rgba(201,149,108,.2)",pointerEvents:"none",zIndex:9999,transition:"left .08s,top .08s"}}/>
      </>}

      {/* NAV */}
      <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:500,height:52,display:"flex",alignItems:"center",justifyContent:"space-between",padding:`0 ${isMobile?"18px":"clamp(24px,6vw,64px)"}`,background:scrollY>40?"rgba(8,4,7,.94)":"transparent",backdropFilter:scrollY>40?"blur(24px)":"none",borderBottom:scrollY>40?"1px solid rgba(201,149,108,.07)":"none",transition:"all .4s"}}>
        <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:14,fontWeight:900,color:"#F8F9FA",letterSpacing:"-0.5px"}}>RITUAL<span style={{color:"#FF5C1A",marginLeft:4}}>·</span></div>
        {fase==="hero"&&(
          <button className="cta cta-orange" style={{padding:"7px 20px",fontSize:11,borderRadius:50,letterSpacing:".5px",fontWeight:700}} onMouseEnter={()=>setCursorScale(2)} onMouseLeave={()=>setCursorScale(1)} onClick={entrarForm}>
            Diagnóstico Gratuito →
          </button>
        )}
      </nav>

      {/* ════ HERO ════ */}
      {fase==="hero"&&(
        <div className="grain">
          {/* S1 — HERO PRINCIPAL */}
          <section style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:`clamp(90px,12vh,120px) ${isMobile?"20px":"clamp(24px,8vw,100px)"} 80px`,textAlign:"center",position:"relative",overflow:"hidden"}}>
            <ParticleCanvas/>
            {/* Orbs */}
            <div className="orb-orange" style={{position:"absolute",top:"8%",left:"12%",width:500,height:500,pointerEvents:"none",animation:"orb1 12s ease-in-out infinite"}}/>
            <div className="orb-gold" style={{position:"absolute",bottom:"8%",right:"10%",width:420,height:420,pointerEvents:"none",animation:"orb2 15s ease-in-out infinite",animationDelay:"4s"}}/>
            <div style={{position:"absolute",top:"40%",right:"25%",width:280,height:280,background:"radial-gradient(circle,rgba(212,175,55,.06) 0%,transparent 65%)",filter:"blur(50px)",pointerEvents:"none"}}/>
            {/* Thin lines */}
            <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",opacity:.08}} viewBox="0 0 1440 900" preserveAspectRatio="none">
              <line x1="0" y1="450" x2="1440" y2="450" stroke="#c9956c" strokeWidth=".5" strokeDasharray="4 12"/>
              <line x1="720" y1="0" x2="720" y2="900" stroke="#c9956c" strokeWidth=".5" strokeDasharray="4 12"/>
            </svg>

            <div style={{position:"relative",zIndex:1,maxWidth:900,width:"100%"}}>
              {/* Badge */}
              {/* Badge Monolith */}
              <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,92,26,.05)",border:"1px solid rgba(255,92,26,.15)",borderRadius:40,padding:"5px 18px",marginBottom:28,animation:"fadeUp .6s ease"}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#FF5C1A",animation:"pulse_d 1.8s infinite"}}/>
                <span style={{fontSize:8,fontWeight:700,letterSpacing:3,color:"rgba(255,92,26,.8)",textTransform:"uppercase",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Edição Monolith · Gestão para Clínicas de Elite</span>
              </div>

              {/* H1 */}
              <h1 style={{fontFamily:"'Unbounded',sans-serif",fontSize:isMobile?"clamp(30px,9.5vw,52px)":"clamp(42px,6.5vw,88px)",fontWeight:900,lineHeight:.88,letterSpacing:isMobile?"-1px":"-2.5px",marginBottom:24,animation:"fadeUp .7s ease .1s both",textTransform:"uppercase"}}>
                <span style={{display:"block",color:"rgba(248,249,250,.08)",WebkitTextStroke:(isMobile?"1px":"1.5px")+" rgba(248,249,250,.12)"}}>Pare de perder</span>
                <span style={{display:"block",color:"rgba(248,249,250,.08)",WebkitTextStroke:(isMobile?"1px":"1.5px")+" rgba(248,249,250,.12)"}}>pacientes para</span>
                <span className="shimmer-gold" style={{display:"block",fontFamily:"'Unbounded',sans-serif",fontSize:isMobile?"clamp(30px,9.5vw,52px)":"clamp(42px,6.5vw,88px)",fontWeight:900,lineHeight:.88,letterSpacing:isMobile?"-1px":"-2.5px"}}>o silêncio.</span>
              </h1>

              {/* Sub */}
              <p style={{fontSize:isMobile?14:17,color:"rgba(240,217,204,.38)",lineHeight:1.85,maxWidth:540,margin:"0 auto 36px",fontWeight:300,animation:"fadeUp .7s ease .2s both",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
                A infraestrutura de elite para consultórios que buscam o próximo nível de autoridade e conversão. Retorno automático, protocolo e agenda numa só plataforma.
              </p>

              {/* CTAs */}
              <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:12,justifyContent:"center",alignItems:"center",animation:"fadeUp .7s ease .3s both"}}>
                <button className="cta cta-orange" style={{fontSize:isMobile?14:16,padding:isMobile?"14px 28px":"18px 48px",borderRadius:50,fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,letterSpacing:".3px"}} onMouseEnter={()=>setCursorScale(2)} onMouseLeave={()=>setCursorScale(1)} onClick={entrarForm}>
                  Iniciar Diagnóstico Gratuito
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
                <div style={{fontSize:11,color:"rgba(255,255,255,.18)"}}>5 minutos · gratuito · sem compromisso</div>
              </div>

              {/* Stats */}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:0,marginTop:52,background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,overflow:"hidden",animation:"fadeUp .7s ease .45s both"}}>
                {[["Mês 1","organiza tudo"],["Mês 3","age sozinho"],["Mês 6","aprende cada paciente"],["Mês 12","insubstituível"]].map(([v,l],i)=>(
                  <div key={v} style={{padding:"16px 12px",textAlign:"center",borderRight:i<3?"1px solid rgba(255,255,255,.04)":"none",borderBottom:isMobile&&i<2?"1px solid rgba(255,255,255,.04)":"none"}}>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:isMobile?18:22,fontWeight:700,color:"#c9956c",marginBottom:2,fontStyle:"italic"}}>{v}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.3)",fontWeight:400}}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scroll indicator */}
            <div style={{position:"absolute",bottom:24,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",alignItems:"center",gap:6,opacity:.2,animation:"float 2.8s ease-in-out infinite"}}>
              <div style={{width:1,height:44,background:"linear-gradient(to bottom,#c9956c,transparent)"}}/>
              <div style={{fontSize:7,letterSpacing:4,color:"#c9956c",textTransform:"uppercase"}}>role</div>
            </div>
          </section>

          {/* S2 — O PROBLEMA */}
          <section style={{background:"#0e0a12",padding:`clamp(80px,10vh,120px) ${isMobile?"20px":"clamp(20px,8vw,100px)"}`,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",fontFamily:"'Unbounded',sans-serif",fontSize:"clamp(50px,12vw,180px)",fontWeight:900,letterSpacing:-4,color:"rgba(255,255,255,.018)",whiteSpace:"nowrap",top:"50%",left:-20,transform:"translateY(-50%)",userSelect:"none",pointerEvents:"none",textTransform:"uppercase"}}>protocolo</div>
            <div style={{maxWidth:960,margin:"0 auto",position:"relative",zIndex:1}}>
              <Reveal>
                <div style={{fontSize:9,letterSpacing:4,color:"#c9956c",fontWeight:700,textTransform:"uppercase",marginBottom:16}}>O problema que ninguém resolveu</div>
                <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:isMobile?"clamp(28px,8vw,52px)":"clamp(36px,5vw,72px)",fontWeight:700,lineHeight:.9,letterSpacing:-1,color:"#f0d9cc",marginBottom:28}}>
                  iClinic registra.<br/>Clinicorp registra.<br/><em style={{color:"#c9956c",fontStyle:"italic"}}>Nenhum aprende.</em>
                </h2>
              </Reveal>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:24,marginTop:16}}>
                <Reveal delay={100}>
                  <p style={{fontSize:isMobile?15:16,color:"rgba(240,217,204,.45)",lineHeight:1.9,borderLeft:"2.5px solid #c9956c",paddingLeft:20,fontWeight:300}}>
                    Nenhum sistema sabe que toxina tem retoque em 14 dias e manutenção em 5 meses.<br/><br/>
                    Nenhum sabe que <em>aquela paciente específica</em> some após o segundo procedimento.<br/><br/>
                    <strong style={{color:"rgba(240,217,204,.8)",fontWeight:600}}>Eles registram. O Ritual aprende e age.</strong>
                  </p>
                </Reveal>
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {[["❌","Sabe quando a toxina vence","Tem o dado. Não age no momento certo."],["❌","Aprende o ciclo da paciente","Cada uma fica igual no sistema. Zero personalização."],["❌","Gera o consentimento certo","Você procura o papel. Assina manual. Perde."],["❌","Preenche buraco de agenda","Tem lista de espera. Ninguém controla."]].map(([ic,t,d],i)=>(
                    <Reveal key={i} delay={i*80} direction="right">
                      <div style={{background:"rgba(30,20,25,.8)",borderRadius:10,padding:"13px 15px",border:"1px solid rgba(201,149,108,.1)",backdropFilter:"blur(10px)"}}>
                        <div style={{fontWeight:700,fontSize:12,color:"#f0d9cc",marginBottom:3}}>{ic} {t}</div>
                        <div style={{fontSize:11,color:"rgba(240,217,204,.4)",lineHeight:1.5}}>{d}</div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* S3 — O QUE FAZ */}
          <section style={{background:"#0A0A0B",padding:`clamp(80px,10vh,120px) ${isMobile?"20px":"clamp(20px,8vw,100px)"}`,position:"relative",overflow:"hidden"}}>
            {[500,800].map((sz,i)=>(<div key={sz} style={{position:"absolute",width:sz,height:sz,borderRadius:"50%",border:"1px solid rgba(201,149,108,.04)",top:"50%",left:"50%",transform:"translate(-50%,-50%)",animation:`float ${6+i*2}s ease-in-out infinite`,pointerEvents:"none"}}/>))}
            <div style={{maxWidth:960,margin:"0 auto",position:"relative",zIndex:1}}>
              <Reveal>
                <div style={{textAlign:"center",marginBottom:48}}>
                  <div style={{fontSize:9,letterSpacing:4,color:"#c9956c",fontWeight:700,textTransform:"uppercase",marginBottom:14}}>Jornada da Paciente · Ritual</div>
                  <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:isMobile?"clamp(28px,8vw,52px)":"clamp(36px,5vw,68px)",fontWeight:700,lineHeight:.9,letterSpacing:-1}}>
                    Um sistema que aprende<br/><span style={{color:"#c9956c",fontStyle:"italic"}}>cada paciente sua.</span>
                  </h2>
                </div>
              </Reveal>

              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:12,marginBottom:40}}>
                {[
                  {ic:"🧬",n:"01",t:"Jornada Individual",d:"Timeline visual por paciente — procedimentos, fotos antes/depois, aderência e retornos num único card."},
                  {ic:"🤖",n:"02",t:"Ritual Intelligence",d:"Monitora cada paciente em silêncio, detecta sinais de desengajamento e age automaticamente antes da perda."},
                  {ic:"⏱️",n:"03",t:"Retorno Automático",d:"O sistema aprende o ciclo de cada paciente. Dispara via WhatsApp no momento exato. Sem você lembrar."},
                  {ic:"🧠",n:"04",t:"Assistente Ritual",d:"Conhece cada paciente da clínica, sugere ações com base no histórico e responde como parte da sua equipe."},
                  {ic:"🗓️",n:"05",t:"Agenda Inteligente",d:"Prioridade automática toda manhã. Briefing por consulta. Ritual Ready por atendimento — zero improviso."},
                  {ic:"📊",n:"06",t:"Dashboard de Resultados",d:"ROI, taxa de retorno, perda estimada e benchmarks. Você sabe exatamente o que está funcionando."},
                  ].map((s,i)=>(
                  <Reveal key={s.n} delay={i*60} direction="up">
                    <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:"22px 18px",height:"100%",transition:"all .3s",cursor:"default"}}
                      onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,92,26,.04)";e.currentTarget.style.borderColor="rgba(255,92,26,.2)";e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(255,92,26,.1)"}}
                      onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.02)";e.currentTarget.style.borderColor="rgba(255,255,255,.05)";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none"}}>
                      <div style={{fontSize:9,color:"rgba(201,149,108,.3)",fontWeight:700,letterSpacing:2,marginBottom:8}}>{s.n}</div>
                      <div style={{fontSize:20,marginBottom:8}}>{s.ic}</div>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:700,color:"#f0d9cc",marginBottom:6,lineHeight:1.1}}>{s.t}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.3)",lineHeight:1.65}}>{s.d}</div>
                    </div>
                  </Reveal>
                ))}
              </div>

              {/* Demo */}
              <Reveal direction="scale">
                <div style={{maxWidth:520,margin:"0 auto"}}>
                  <div style={{fontSize:9,color:"#c9956c",fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:10,textAlign:"center",display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:"#c9956c",animation:"pulse_d 2s infinite"}}/>
                    Ritual ao vivo · Como funciona na prática
                  </div>
                  <MiniDemo perda={4200} pacientes={23}/>
                </div>
              </Reveal>
            </div>
          </section>

          {/* S4 — NÚMEROS */}
          <section style={{background:"linear-gradient(150deg,#2a0d04 0%,#4a1e0a 50%,#6a2e14 100%)",padding:`clamp(80px,10vh,120px) ${isMobile?"20px":"clamp(20px,8vw,100px)"}`,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundImage:"radial-gradient(ellipse at 30% 50%, rgba(201,149,108,.12) 0%, transparent 60%)",pointerEvents:"none"}}/>
            <div style={{maxWidth:960,margin:"0 auto",position:"relative",zIndex:1}}>
              <Reveal>
                <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:isMobile?"clamp(26px,7vw,46px)":"clamp(32px,4.5vw,62px)",fontWeight:700,color:"#f0d9cc",lineHeight:.9,letterSpacing:-1,marginBottom:36}}>
                  O que acontece quando<br/><em style={{color:"#c9956c",opacity:.9,fontStyle:"italic"}}>o sistema aprende o protocolo.</em>
                </h2>
              </Reveal>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:1,background:"rgba(255,255,255,.1)",borderRadius:14,overflow:"hidden",marginBottom:28}}>
                {[["R$ 4.200",4200,"recuperados/mês com retornos automáticos ativos"],["−68%",68,"das pacientes que somem após o ciclo ser identificado"],["14 dias",14,"para ver o primeiro resultado concreto no sistema"]].map(([label,num,desc],i)=>(
                  <Reveal key={i} delay={i*100}>
                    <div style={{background:"rgba(0,0,0,.12)",padding:"clamp(18px,3vw,28px)"}}>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:isMobile?"clamp(30px,7vw,52px)":"clamp(30px,4.5vw,52px)",fontWeight:700,color:"#f0d9cc",lineHeight:1,marginBottom:6,fontStyle:"italic"}}>
                        {i===0?<Counter target={4200} prefix="R$ " suffix="/mês"/>:i===1?<Counter target={68} prefix="−" suffix="%"/>:<Counter target={14} prefix="" suffix=" dias"/>}
                      </div>
                      <div style={{fontSize:11,color:"rgba(240,217,204,.5)",lineHeight:1.55}}>{desc}</div>
                    </div>
                  </Reveal>
                ))}
              </div>
              <Reveal delay={200}>
                <div style={{background:"rgba(0,0,0,.15)",borderRadius:12,padding:"clamp(16px,3vw,24px)",borderLeft:"3px solid rgba(240,217,204,.2)"}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:isMobile?15:18,color:"rgba(240,217,204,.82)",lineHeight:1.7,fontStyle:"italic",marginBottom:8}}>
                    "Em 45 dias o sistema já tinha identificado 28 pacientes no período de retorno que eu não tinha contactado. Sozinho, trouxe 9 de volta naquela semana."
                  </div>
                  <div style={{fontSize:10,color:"rgba(240,217,204,.35)",fontWeight:600,letterSpacing:1}}>Dra. Camila Ferreira — Harmonização & Estética Avançada · São Paulo</div>
                </div>
              </Reveal>
            </div>
          </section>

          {/* S5 — CTA FINAL */}
          <section style={{minHeight:"70vh",display:"flex",alignItems:"center",justifyContent:"center",padding:`clamp(80px,10vh,110px) ${isMobile?"20px":"clamp(20px,8vw,100px)"}`,background:"#0A0A0B",position:"relative",overflow:"hidden",textAlign:"center"}}>
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"min(600px,100vw)",height:"min(600px,100vw)",background:"radial-gradient(circle,rgba(201,149,108,.08) 0%,transparent 70%)",pointerEvents:"none"}}/>
            <Reveal direction="scale">
              <div style={{position:"relative",zIndex:1,maxWidth:680}}>
                <div style={{fontSize:9,letterSpacing:5,color:"rgba(201,149,108,.5)",fontWeight:700,textTransform:"uppercase",marginBottom:18}}>Diagnóstico gratuito</div>
                <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:isMobile?"clamp(38px,10vw,64px)":"clamp(48px,7vw,88px)",fontWeight:700,lineHeight:.85,letterSpacing:-2,marginBottom:18}}>
                  <span style={{display:"block",WebkitTextStroke:"1.5px rgba(240,217,204,.1)",color:"transparent"}}>Quanto você perde</span>
                  <span style={{display:"block",color:"#c9956c",fontStyle:"italic"}}>todo mês?</span>
                </h2>
                <p style={{fontSize:isMobile?13:16,color:"rgba(240,217,204,.35)",lineHeight:1.8,maxWidth:480,margin:"0 auto 28px",fontWeight:300}}>5 perguntas. Calculamos a perda real. Mostramos a demo com sua clínica. Você agenda a call se quiser.
                </p>
                <button className="cta cta-orange" style={{fontSize:isMobile?14:16,padding:isMobile?"14px 28px":"18px 52px",borderRadius:50,fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700}} onMouseEnter={()=>setCursorScale(2)} onMouseLeave={()=>setCursorScale(1)} onClick={entrarForm}>
                  Ver meu diagnóstico gratuito →
                </button>
                <div style={{marginTop:14,fontSize:11,color:"rgba(255,255,255,.15)"}}>Sem compromisso · Demo ao vivo na call</div>
              </div>
            </Reveal>
          </section>

          {/* FOOTER */}
          <footer style={{borderTop:"1px solid rgba(255,255,255,.04)",padding:`16px ${isMobile?"18px":"clamp(20px,5vw,60px)"}`,display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:10,background:"#0A0A0B"}}>
            <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:13,fontWeight:900,color:"#F8F9FA",letterSpacing:"-0.5px"}}>RITUAL<span style={{color:"#FF5C1A",marginLeft:4}}>·</span></div>
            <span style={{fontSize:9,color:"rgba(240,217,204,.12)"}}>© 2026 Ritual · Gestão inteligente para clínicas de procedimentos estéticos.</span>
            <button className="cta" style={{padding:"6px 16px",fontSize:11}} onClick={entrarForm}>Diagnóstico →</button>
          </footer>
        </div>
      )}

      {/* ════ FORM — DIAGNÓSTICO ════ */}
      {fase==="form"&&(
        <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:`80px ${isMobile?"16px":"24px"}`,position:"relative",background:"#0A0A0B"}}>
          <ParticleCanvas/>
          <div style={{width:"100%",maxWidth:580,position:"relative",zIndex:1}}>
            {/* Progress */}
            <div className="prog">
              <div className="prog-inner" style={{width:`${((step+1)/ETAPAS.length)*100}%`}}/>
            </div>

            {/* Step info */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:9,color:"#c9956c",fontWeight:700,letterSpacing:2,textTransform:"uppercase"}}>{etapaAtual?.id==="contato"?"CONTATO":etapaAtual?.id==="pacientes"?"VOLUME":etapaAtual?.id==="ticket"?"FINANCEIRO":etapaAtual?.id==="dor"?"DOR PRINCIPAL":""}</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {perda>0&&<div style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.15)",borderRadius:20,padding:"3px 10px"}}>
                  <span style={{fontSize:8,color:"rgba(239,68,68,.6)",letterSpacing:1}}>PERDA EST.</span>
                  <span style={{fontSize:11,fontWeight:700,color:"#ef4444",fontFamily:"'Syne',sans-serif"}}>R${perda.toLocaleString("pt-BR")}/mês</span>
                </div>}
                {step>0&&<button className="back-btn" onClick={()=>setStep(s=>s-1)}>← voltar</button>}
              </div>
            </div>

            {/* Card */}
            <div key={step} className="card" style={{padding:isMobile?"22px 18px":"40px 36px",animation:"cardIn .45s cubic-bezier(.16,1,.3,1)"}}>

              {/* SLIDER — pacientes */}
              {etapaAtual?.tipo==="slider"&&(()=>{
                const val=res.pacientes||20;
                return(<div>
                  <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:isMobile?20:26,fontWeight:700,marginBottom:6,lineHeight:1.15}}>{etapaAtual.titulo}</h2>
                  <p style={{fontSize:12,color:"rgba(240,217,204,.35)",marginBottom:32}}>{etapaAtual.sub}</p>
                  <div style={{textAlign:"center",marginBottom:28}}>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:72,fontWeight:700,color:"#c9956c",lineHeight:1,fontStyle:"italic"}}>{val}</div>
                    <div style={{fontSize:12,color:"rgba(240,217,204,.3)",marginTop:4}}>pacientes/mês</div>
                  </div>
                  <input type="range" min={5} max={120} step={5} value={val} onChange={e=>setRes(p=>({...p,pacientes:+e.target.value}))} style={{marginBottom:24}}/>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"rgba(240,217,204,.2)",marginBottom:28}}>
                    <span>5</span><span>120</span>
                  </div>
                  <button className="cta" style={{width:"100%"}} onClick={()=>goNext(val,"pacientes")}>
                    Confirmar: {val} pacientes/mês →
                  </button>
                  {val>=20&&<div style={{marginTop:12,fontSize:11,color:"rgba(239,68,68,.5)",textAlign:"center"}}>
                    Perda estimada: R$ {calcPerda(val,res.ticket||500).toLocaleString("pt-BR")}/mês sem retorno automático
                  </div>}
                </div>);
              })()}

              {/* CARDS — ticket */}
              {etapaAtual?.tipo==="cards"&&etapaAtual?.id==="ticket"&&(<div>
                <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:isMobile?20:26,fontWeight:700,marginBottom:6,lineHeight:1.15}}>{etapaAtual.titulo}</h2>
                <p style={{fontSize:12,color:"rgba(240,217,204,.35)",marginBottom:22}}>{etapaAtual.sub}</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {etapaAtual.ops.map(op=>(
                    <div key={op.l} className={`opt ${res.ticket===op.v?"active":""}`} onClick={()=>goNext(op.v,"ticket")}>
                      <span style={{fontSize:20}}>{op.ic}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:500,color:"rgba(240,217,204,.8)"}}>{op.l}</div>
                        {res.pacientes&&<div style={{fontSize:10,color:"rgba(240,217,204,.3)",marginTop:2}}>Perda est: R$ {calcPerda(res.pacientes,op.v).toLocaleString("pt-BR")}/mês</div>}
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(201,149,108,.4)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                  ))}
                </div>
              </div>)}

              {/* CARDS — dor */}
              {etapaAtual?.tipo==="cards"&&etapaAtual?.id==="dor"&&(<div>
                <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:isMobile?20:26,fontWeight:700,marginBottom:6,lineHeight:1.15}}>{etapaAtual.titulo}</h2>
                <p style={{fontSize:12,color:"rgba(240,217,204,.35)",marginBottom:22}}>{etapaAtual.sub}</p>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8}}>
                  {etapaAtual.ops.map(op=>(
                    <div key={op.l} className={`opt ${res.dor===op.l?"active":""}`} onClick={()=>goNext(op.l,"dor")}>
                      <span style={{fontSize:18}}>{op.ic}</span>
                      <span style={{fontSize:13,fontWeight:500,color:"rgba(240,217,204,.75)",lineHeight:1.3}}>{op.l}</span>
                    </div>
                  ))}
                </div>
              </div>)}

              {/* FORM — contato */}
              {etapaAtual?.tipo==="form"&&(<div>
                {/* Perda calculada em destaque */}
                {perda>0&&(<div style={{background:"rgba(201,149,108,.07)",border:"1px solid rgba(201,149,108,.18)",borderRadius:12,padding:"16px 18px",marginBottom:22}}>
                  <div style={{fontSize:9,color:"rgba(201,149,108,.5)",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Sua perda estimada por mês</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:700,color:"#ef4444",lineHeight:1,marginBottom:4,fontStyle:"italic"}}>R$ {perda.toLocaleString("pt-BR")}</div>
                  <div style={{fontSize:11,color:"rgba(240,217,204,.4)"}}>Com retorno automático ativo, o Ritual recupera em média 65% desse valor no primeiro mês.</div>
                </div>)}
                <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:isMobile?20:26,fontWeight:700,marginBottom:6}}>{etapaAtual.titulo}</h2>
                <p style={{fontSize:12,color:"rgba(240,217,204,.35)",marginBottom:20}}>{etapaAtual.sub}</p>
                <div style={{display:"flex",flexDirection:"column",gap:11,marginBottom:18}}>
                  {[["nome","Seu nome completo","text"],["clinica","Nome da clínica / consultório (opcional)","text"],["whatsapp","WhatsApp com DDD","numeric"],["email","E-mail (opcional)","email"]].map(([k,ph,mode])=>(
                    <input key={k} className="inp" placeholder={ph} inputMode={mode} maxLength={k==="whatsapp"?20:80} autoComplete="off" value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}/>
                  ))}
                </div>
                <button className="cta" style={{width:"100%"}} disabled={!form.nome.trim()||form.whatsapp.replace(/\D/g,"").length<10||loading} onClick={handleSubmit}>
                  {loading?"Calculando diagnóstico...":"Ver diagnóstico e agendar call →"}
                </button>
                <p style={{fontSize:10,color:"rgba(240,217,204,.15)",textAlign:"center",marginTop:10}}>Zero spam. Só o diagnóstico e a demonstração.</p>
              </div>)}
            </div>

            {/* Ritual brand */}
            <div style={{textAlign:"center",marginTop:16,fontFamily:"'Cormorant Garamond',serif",fontSize:14,color:"rgba(240,217,204,.12)",fontStyle:"italic"}}>ritual</div>
          </div>
        </div>
      )}

      {/* ════ RESULTADO + AGENDAR ════ */}
      {fase==="resultado"&&savedLead&&(
        <div style={{minHeight:"100vh",padding:`80px ${isMobile?"16px":"clamp(16px,5vw,48px)"}`,background:"#0A0A0B",position:"relative"}}>
          <ParticleCanvas/>
          <div style={{maxWidth:1040,margin:"0 auto",position:"relative",zIndex:1}}>

            {/* Header resultado */}
            <div style={{textAlign:"center",marginBottom:36,animation:"fadeUp .6s ease"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:isMobile?24:32,fontWeight:700,color:"#f0d9cc",marginBottom:8}}>
                {savedLead.nome?.split(" ")[0]||"Olá"}, diagnóstico concluído.
              </div>
              <div style={{fontSize:13,color:"rgba(240,217,204,.35)"}}>Equipe Ritual entra em contato em até <span style={{color:"#c9956c",fontWeight:600}}>2 horas</span></div>
            </div>

            {/* Grid 2 colunas */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,marginBottom:16}}>

              {/* Col esquerda — dados */}
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {/* Perda */}
                <div style={{background:"rgba(239,68,68,.04)",border:"1px solid rgba(239,68,68,.12)",borderRadius:14,padding:"20px 18px",animation:"fadeUp .6s ease .1s both"}}>
                  <div style={{fontSize:9,color:"rgba(239,68,68,.45)",letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>Perda estimada por mês</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:44,fontWeight:700,color:"#ef4444",lineHeight:1,marginBottom:6,fontStyle:"italic"}}>
                    <Counter target={savedLead.perda||0} prefix="R$ " suffix=""/>
                    <span style={{fontSize:22}}>/mês</span>
                  </div>
                  <div style={{fontSize:11,color:"rgba(239,68,68,.4)",lineHeight:1.6}}>Com retorno automático ativo, o Ritual recupera em média 65% em 30 dias.</div>
                </div>

                {/* O que resolve */}
                {savedLead.dor&&(<div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"16px 18px",animation:"fadeUp .6s ease .2s both"}}>
                  <div style={{fontSize:9,color:"#c9956c",letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>O Ritual resolve primeiro</div>
                  <div style={{display:"flex",alignItems:"center",gap:10,fontSize:13,color:"rgba(240,217,204,.6)"}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:"#c9956c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"white",flexShrink:0}}>1</div>
                    {savedLead.dor}
                  </div>
                </div>)}

                {/* Mini demo */}
                <div style={{animation:"fadeUp .6s ease .3s both"}}>
                  <div style={{fontSize:9,color:"#c9956c",letterSpacing:2,textTransform:"uppercase",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:"#c9956c",animation:"pulse_d 2s infinite"}}/>
                    Pré-demo · sua clínica no Ritual
                  </div>
                  <MiniDemo perda={savedLead.perda||4200} pacientes={savedLead.pacientes||20}/>
                  <div style={{fontSize:10,color:"rgba(240,217,204,.2)",textAlign:"center",marginTop:6}}>Na call, você vê a versão completa com seus dados reais.</div>
                </div>
              </div>

              {/* Col direita — agendar */}
              <div style={{animation:"fadeUp .6s ease .2s both"}}>
                <div style={{fontSize:9,color:"rgba(240,217,204,.35)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>Agende sua demonstração</div>
                                <Agendador leadData={savedLead}/>
                <div style={{marginTop:12,background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:10,padding:"12px 14px"}}>
                  <div style={{fontSize:11,color:"rgba(240,217,204,.4)",lineHeight:1.65}}>
                    Na demonstração ao vivo você vê o sistema com os dados da sua clínica — pacientes, protocolos, agenda e retornos automáticos configurados.
                  </div>
                </div>
              </div>
            </div>

            <div style={{textAlign:"center",fontFamily:"'Cormorant Garamond',serif",fontSize:13,color:"rgba(240,217,204,.12)",fontStyle:"italic"}}>ritual · o sistema que aprende o protocolo de cada paciente</div>
          </div>
        </div>
      )}
    </div>
  );
}