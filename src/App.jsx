import { useState, useEffect, useRef } from "react";

/* ─── SUPABASE ─── */
const SB_URL = "https://ncqsuxqxujyfekjbgzch.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcXN1eHF4dWp5ZmVramJnemNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTcyMjAsImV4cCI6MjA5MDQ3MzIyMH0.xgwXSHE8dijOa7dtnzZ-CEG1_sP6L3yFvp3JYJ7LE3w";

async function sbInsert(table, data) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method:"POST",
      headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, "Content-Type":"application/json", Prefer:"return=representation" },
      body: JSON.stringify(data),
    });
    if(!r.ok) return null;
    const d = await r.json();
    return d[0]||null;
  } catch { return null; }
}

async function sbQuery(table, query) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}${query}`, {
      headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}` }
    });
    if(!r.ok) return [];
    return r.json();
  } catch { return []; }
}

function calcPerda(p,t){ return Math.round((p||20)*(t||500)*0.18); }
function san(s){ return typeof s==="string"?s.trim().replace(/[<>]/g,"").slice(0,150):s; }

function gerarSlots(){
  const slots=[];const now=new Date();
  const HORAS=["09:00","10:00","11:00","13:00","14:00","15:00"];
  for(let d=0;d<21;d++){
    const date=new Date(now);date.setDate(now.getDate()+d+1);
    if(date.getDay()===0)continue;
    HORAS.forEach(h=>{
      slots.push({date:date.toISOString().slice(0,10),hora:h,
        dia:["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][date.getDay()],
        diaNum:date.getDate(),
        mes:["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][date.getMonth()]
      });
    });
  }
  return slots;
}

/* ─── IC ─── */
function Ic({n,size=20,col="currentColor",style={}}){
  return <span className="material-symbols-outlined" style={{fontSize:size,color:col,display:"inline-flex",alignItems:"center",lineHeight:1,fontVariationSettings:"'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24",...style}}>{n}</span>;
}

/* ─── COUNTER ─── */
function Counter({target,prefix="R$ ",suffix="/mês",duration=1800}){
  const [val,setVal]=useState(0);
  const ref=useRef();
  useEffect(()=>{
    const obs=new IntersectionObserver(([e])=>{
      if(!e.isIntersecting)return;
      let v=0;const step=target/60;
      const iv=setInterval(()=>{v+=step;if(v>=target){setVal(target);clearInterval(iv);}else setVal(Math.round(v));},duration/60);
      obs.disconnect();
    },{threshold:0.3});
    if(ref.current)obs.observe(ref.current);
    return()=>obs.disconnect();
  },[target]);
  return <span ref={ref}>{prefix}{val.toLocaleString("pt-BR")}{suffix}</span>;
}

/* ─── REVEAL ─── */
function Reveal({children,delay=0}){
  const [vis,setVis]=useState(false);
  const ref=useRef();
  useEffect(()=>{
    const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting){setVis(true);obs.disconnect();}},{threshold:0.1});
    if(ref.current)obs.observe(ref.current);
    return()=>obs.disconnect();
  },[]);
  return <div ref={ref} style={{opacity:vis?1:0,transform:vis?"none":"translateY(22px)",transition:`opacity .65s ease ${delay}s, transform .65s cubic-bezier(.16,1,.3,1) ${delay}s`}}>{children}</div>;
}

/* ─── PARTICLES ─── */
function Particles(){
  const ref=useRef();
  useEffect(()=>{
    const c=ref.current;if(!c)return;
    const ctx=c.getContext("2d");
    const resize=()=>{c.width=c.offsetWidth;c.height=c.offsetHeight;};resize();
    const pts=Array.from({length:18},()=>({x:Math.random()*c.width,y:Math.random()*c.height,vx:(Math.random()-.5)*.12,vy:(Math.random()-.5)*.12,r:Math.random()*.6+.2}));
    let raf,fc=0;
    const draw=()=>{fc++;if(fc%2!==0){raf=requestAnimationFrame(draw);return;}
      ctx.clearRect(0,0,c.width,c.height);
      pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>c.width)p.vx*=-1;if(p.y<0||p.y>c.height)p.vy*=-1;
        ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle="rgba(201,149,108,.07)";ctx.fill();});
      for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<100){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.strokeStyle=`rgba(201,149,108,${.02*(1-d/100)})`;ctx.lineWidth=.3;ctx.stroke();}}
      raf=requestAnimationFrame(draw);};
    draw();window.addEventListener("resize",resize);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);};
  },[]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:0}}/>;
}

/* ─── MINI DEMO ─── */
function MiniDemo({perda,pacientes,nome}){
  const pList=[
    {n:nome?nome.split(" ")[0]+" "+(nome.split(" ")[1]||"").charAt(0)+".":"Ana Lima",proc:"Toxina botulínica",status:"retorno hoje",ad:91,urgente:true,cor:"#c9956c"},
    {n:"Carla M.",proc:"Preenchimento labial",status:"venceu ontem",ad:68,urgente:true,cor:"#ef4444"},
    {n:"Bianca R.",proc:"Bioestimulador",status:"em 12 dias",ad:96,urgente:false,cor:"#10b981"},
    {n:"Fernanda S.",proc:"Skinbooster",status:"em 18 dias",ad:88,urgente:false,cor:"#10b981"},
  ];
  const chart=[18,24,21,30,27,38,35,46,42,55,51,64];
  const max=Math.max(...chart),min=Math.min(...chart);
  const px=i=>((i/(chart.length-1))*220).toFixed(1);
  const py=v=>((1-(v-min)/(max-min))*34+4).toFixed(1);
  const path=chart.map((v,i)=>`${i===0?"M":"L"}${px(i)},${py(v)}`).join(" ");
  return(
    <div style={{background:"#080407",borderRadius:20,overflow:"hidden",border:"1px solid rgba(201,149,108,.2)",boxShadow:"0 40px 100px rgba(0,0,0,.8)"}}>
      <div style={{height:2,background:"linear-gradient(90deg,transparent,#c9956c 30%,#f0d9cc 50%,#c9956c 70%,transparent)"}}/>
      <div style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,.05)",background:"rgba(20,20,22,.6)",backdropFilter:"blur(20px)"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:30,height:30,borderRadius:8,background:"rgba(201,149,108,.12)",border:"1px solid rgba(201,149,108,.25)",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic n="neurology" size={16} col="#c9956c"/></div>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#f0d9cc",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Ritual · Clinical Intelligence</div>
            <div style={{fontSize:8,color:"rgba(255,255,255,.22)",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>jornada da paciente · ao vivo</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",borderRadius:20,padding:"3px 10px"}}>
          <div style={{width:4,height:4,borderRadius:"50%",background:"#10b981",animation:"pulse_d 2s infinite"}}/>
          <span style={{fontSize:8,color:"#10b981",fontWeight:700,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>ATIVO</span>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
        {[
          {ic:"payments",l:"Recuperado",v:`R$ ${Math.round(perda*.65/1000*10)/10}k`,d:"este mês",cor:"#c9956c"},
          {ic:"group",l:"Pacientes",v:`${Math.min(pacientes||20,14)}`,d:"ativas hoje",cor:"#f0d9cc"},
          {ic:"trending_up",l:"Aderência",v:"89%",d:"+12% vs anterior",cor:"#10b981"},
        ].map((k,i)=>(
          <div key={i} style={{padding:"10px 12px",borderRight:i<2?"1px solid rgba(255,255,255,.04)":"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}><Ic n={k.ic} size={11} col="rgba(255,255,255,.2)"/><span style={{fontSize:7,color:"rgba(255,255,255,.2)",letterSpacing:1,textTransform:"uppercase",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{k.l}</span></div>
            <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:16,fontWeight:700,color:k.cor,lineHeight:1,marginBottom:2}}>{k.v}</div>
            <div style={{fontSize:8,color:"#10b981",fontWeight:600,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{k.d}</div>
          </div>
        ))}
      </div>
      <div style={{padding:"10px 14px 8px",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
        <div style={{fontSize:7,color:"rgba(255,255,255,.18)",letterSpacing:1,textTransform:"uppercase",marginBottom:5,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>faturamento · 12 meses</div>
        <div style={{position:"relative",height:42}}>
          <svg width="100%" height="42" viewBox="0 0 220 42" preserveAspectRatio="none" style={{position:"absolute",inset:0}}>
            <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c9956c" stopOpacity=".28"/><stop offset="100%" stopColor="#c9956c" stopOpacity="0"/></linearGradient></defs>
            <path d={`${path} L220,42 L0,42 Z`} fill="url(#rg)"/>
            <path d={path} fill="none" stroke="#c9956c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx={px(chart.length-1)} cy={py(chart[chart.length-1])} r="3" fill="#c9956c"/>
          </svg>
        </div>
      </div>
      <div style={{padding:"10px 14px"}}>
        <div style={{fontSize:7,color:"rgba(255,255,255,.18)",letterSpacing:1,textTransform:"uppercase",marginBottom:8,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>active journeys · agora</div>
        <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:8}}>
          {pList.map((p,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:p.urgente?"rgba(255,255,255,.03)":"rgba(255,255,255,.015)",border:`1px solid ${p.urgente?"rgba(201,149,108,.12)":"rgba(255,255,255,.04)"}`,borderRadius:9,padding:"7px 10px",borderLeft:`2px solid ${p.cor}`}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:`${p.cor}18`,border:`1.5px solid ${p.cor}35`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:p.cor,flexShrink:0,fontFamily:"'Cormorant Garamond',serif"}}>{p.n.charAt(0)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,fontWeight:600,color:p.urgente?"#f0d9cc":"rgba(255,255,255,.3)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{p.n}</div>
                <div style={{display:"flex",alignItems:"center",gap:4,marginTop:2}}>
                  <div style={{height:2,background:"rgba(255,255,255,.06)",borderRadius:1,flex:1,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${p.ad}%`,background:p.cor,borderRadius:1}}/>
                  </div>
                  <span style={{fontSize:8,color:p.cor,fontWeight:700,flexShrink:0}}>{p.ad}%</span>
                </div>
              </div>
              <div style={{fontSize:8,color:p.cor,fontWeight:700,background:`${p.cor}12`,borderRadius:10,padding:"2px 7px",flexShrink:0,whiteSpace:"nowrap",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{p.status}</div>
            </div>
          ))}
        </div>
        <div style={{background:"rgba(201,149,108,.06)",border:"1px solid rgba(201,149,108,.14)",borderRadius:9,padding:"8px 11px",display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:"#c9956c",flexShrink:0,animation:"pulse_d 1.8s infinite"}}/>
          <Ic n="model_training" size={13} col="#c9956c"/>
          <div style={{fontSize:9,color:"#c9956c",fontWeight:600,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>IA identificou 3 retornos hoje — mensagem enviada automaticamente</div>
        </div>
      </div>
      <div style={{padding:"5px 14px 9px",display:"flex",justifyContent:"space-between"}}>
        <div style={{fontSize:7,color:"rgba(255,255,255,.1)",letterSpacing:1,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>RITUAL · CLINICAL INTELLIGENCE</div>
        <div style={{fontSize:7,color:"rgba(255,255,255,.08)",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>pré-visualização</div>
      </div>
    </div>
  );
}

/* ─── AGENDADOR ─── */
function Agendador({leadData}){
  const todos=gerarSlots();
  const [diasUniq]=useState(()=>{const seen=new Set();return todos.filter(s=>{if(seen.has(s.date))return false;seen.add(s.date);return true;}).slice(0,10);});
  const [diaSel,setDiaSel]=useState(diasUniq[0]?.date);
  const [horaSel,setHoraSel]=useState(null);
  const [bloq,setBloq]=useState({});
  const [status,setStatus]=useState("idle");
  const slots=todos.filter(s=>s.date===diaSel);

  useEffect(()=>{
    if(!diaSel)return;
    (async()=>{
      const rows=await sbQuery("reunioes",`?data=eq.${diaSel}&select=hora`);
      const b={};(rows||[]).forEach(r=>{b[r.hora]=true;});setBloq(b);
    })();
  },[diaSel]);

  const confirmar=async()=>{
    if(!horaSel||status==="loading")return;
    setStatus("loading");
    const slot=todos.find(s=>s.date===diaSel&&s.hora===horaSel);
    const ok=await sbInsert("reunioes",{clinica_id:"wylvex",nome:leadData?.nome,clinica:leadData?.clinica,tel:leadData?.whatsapp,data:diaSel,hora:horaSel,dia:`${slot?.dia}, ${slot?.diaNum} de ${slot?.mes}`,score:leadData?.score||0,perda:leadData?.perda||0,status:"agendada",origem:"lp"});
    setStatus(ok?"done":"error");
  };

  const diaAtual=diasUniq.find(d=>d.date===diaSel);

  if(status==="done") return(
    <div style={{background:"rgba(16,185,129,.05)",border:"1px solid rgba(16,185,129,.18)",borderRadius:16,padding:"28px 22px",textAlign:"center"}}>
      <div style={{width:56,height:56,borderRadius:"50%",background:"rgba(16,185,129,.12)",border:"1px solid rgba(16,185,129,.25)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Ic n="check_circle" size={28} col="#10b981"/></div>
      <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:17,fontWeight:700,color:"#f0d9cc",marginBottom:8}}>Demonstração confirmada!</div>
      <div style={{fontSize:14,color:"#10b981",fontWeight:600,marginBottom:6,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{diaAtual?.dia}, {diaAtual?.diaNum} de {diaAtual?.mes} · {horaSel}</div>
      <div style={{fontSize:12,color:"rgba(255,255,255,.28)",fontFamily:"'Plus Jakarta Sans',sans-serif",lineHeight:1.6}}>A equipe Wylvex vai entrar em contato para confirmar o link da call.</div>
    </div>
  );

  return(
    <div>
      <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:6,marginBottom:14,scrollbarWidth:"none"}}>
        {diasUniq.slice(0,7).map(d=>(
          <button key={d.date} onClick={()=>{setDiaSel(d.date);setHoraSel(null);}} style={{background:diaSel===d.date?"rgba(201,149,108,.12)":"rgba(255,255,255,.03)",border:`1px solid ${diaSel===d.date?"rgba(201,149,108,.35)":"rgba(255,255,255,.07)"}`,borderRadius:11,padding:"10px 13px",cursor:"pointer",textAlign:"center",flexShrink:0,minWidth:62,transition:"all .2s"}}>
            <div style={{fontSize:9,color:diaSel===d.date?"#c9956c":"rgba(255,255,255,.28)",textTransform:"uppercase",letterSpacing:.5,marginBottom:2,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{d.dia}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:diaSel===d.date?"#f0d9cc":"rgba(255,255,255,.45)"}}>{d.diaNum}</div>
            <div style={{fontSize:9,color:diaSel===d.date?"rgba(201,149,108,.6)":"rgba(255,255,255,.22)",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{d.mes}</div>
          </button>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:14}}>
        {slots.map(s=>{
          const b=bloq[s.hora],sel=horaSel===s.hora;
          return(
            <button key={s.hora} disabled={b} onClick={()=>setHoraSel(s.hora)} style={{background:sel?"rgba(201,149,108,.14)":b?"rgba(255,255,255,.02)":"rgba(255,255,255,.04)",border:`1px solid ${sel?"#c9956c":b?"rgba(255,255,255,.04)":"rgba(255,255,255,.08)"}`,borderRadius:9,padding:"10px 0",cursor:b?"not-allowed":"pointer",fontSize:13,fontWeight:sel?700:400,color:sel?"#c9956c":b?"rgba(255,255,255,.15)":"rgba(240,217,204,.7)",fontFamily:"'Cormorant Garamond',serif",transition:"all .2s",textDecoration:b?"line-through":"none"}}>
              {s.hora}
            </button>
          );
        })}
      </div>
      <button onClick={confirmar} disabled={!horaSel||status==="loading"} style={{width:"100%",background:horaSel?"linear-gradient(135deg,#c9956c,#b8845b)":"rgba(255,255,255,.04)",border:"none",color:horaSel?"white":"rgba(255,255,255,.25)",borderRadius:11,padding:"14px",fontSize:14,fontWeight:700,cursor:horaSel?"pointer":"not-allowed",fontFamily:"'Plus Jakarta Sans',sans-serif",transition:"all .25s",boxShadow:horaSel?"0 8px 28px rgba(201,149,108,.28)":"none"}}>
        {status==="loading"?"Confirmando...":horaSel?`Confirmar demo · ${horaSel} →`:"Selecione um horário"}
      </button>
    </div>
  );
}

/* ─── MAIN ─── */
export default function App(){
  const fbTrack=(e,d)=>{try{window.fbq&&window.fbq('track',e,d||{});}catch(_){}};



  const [fase,setFase]=useState("hero");
  const [step,setStep]=useState(0);
  const [res,setRes]=useState({});
  const [form,setForm]=useState({nome:"",clinica:"",whatsapp:""});
  const [loading,setLoading]=useState(false);
  const [savedLead,setSavedLead]=useState(null);
  const [scrollY,setScrollY]=useState(0);
  const [isMobile,setIsMobile]=useState(false);
  useEffect(()=>{try{window.fbq&&window.fbq("track","ViewContent",{content_name:"Ritual Diagnóstico"});}catch(_){}},[]);
  const [isTablet,setIsTablet]=useState(false);
  const topo=useRef(null);

  useEffect(()=>{
    const ck=()=>{setIsMobile(window.innerWidth<640);setIsTablet(window.innerWidth>=640&&window.innerWidth<1024);};ck();
    const sc=()=>setScrollY(window.scrollY);
    window.addEventListener("resize",ck);
    window.addEventListener("scroll",sc,{passive:true});
    const fonts=[
      "https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&display=swap",
      "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap",
    ];
    fonts.forEach(f=>{if(!document.querySelector(`link[href="${f}"]`)){const l=document.createElement("link");l.rel="stylesheet";l.href=f;l.media="print";l.onload=()=>{l.media="all";};document.head.appendChild(l);}});
    return()=>{window.removeEventListener("resize",ck);window.removeEventListener("scroll",sc);};
  },[]);

  const perda=calcPerda(res.pacientes,res.ticket);
  const pad=isMobile?"18px":isTablet?"32px":"clamp(24px,7vw,80px)";

  const ETAPAS=[
    {id:"pacientes",tipo:"slider",titulo:"Quantas pacientes você atende por mês?",sub:"Calculamos exatamente quanto você está perdendo.",min:5,max:120,step:5},
    {id:"ticket",tipo:"cards",titulo:"Qual seu ticket médio por procedimento?",sub:"Para calcular sua perda real.",ops:[{ic:"💫",l:"Até R$ 300",v:250},{ic:"✨",l:"R$ 300 – R$ 600",v:450},{ic:"💎",l:"R$ 600 – R$ 1.500",v:900},{ic:"👑",l:"Acima de R$ 1.500",v:1800}]},
    {id:"dor",tipo:"cards",titulo:"O que mais trava sua clínica hoje?",sub:"Uma resposta. A que mais dói.",ops:[{ic:"👻",l:"Paciente que some antes do retorno"},{ic:"📸",l:"Fotos e protocolos espalhados"},{ic:"📋",l:"Consentimento no papel ou perdido"},{ic:"📱",l:"WhatsApp pessoal misturado"},{ic:"🗓️",l:"Agenda com buraco sem lista de espera"},{ic:"😰",l:"Protocolo só na minha cabeça"}]},
    {id:"contato",tipo:"form",titulo:"Última etapa.",sub:"Para onde enviamos o diagnóstico?"},
  ];

  const etapa=ETAPAS[step];

  const goNext=(val,campo)=>{
    if(campo)setRes(p=>({...p,[campo]:val}));
    if(step<ETAPAS.length-1)setStep(s=>s+1);
  };

  const submit=async()=>{
    if(!form.nome.trim()||form.whatsapp.replace(/\D/g,"").length<10)return;
    setLoading(true);
    const dados={...res,...form,nome:san(form.nome),clinica:san(form.clinica),whatsapp:san(form.whatsapp),perda,score:Math.min(95,70+(perda>5000?15:5)+(res.dor?10:0)),clinica_id:"wylvex",origem:"lp"};
    const lead=await sbInsert("leads",dados);
    setSavedLead({...dados,...lead});
    // Confirmação automática — Zap + Email (variantes anti-ban)
    if(dados.whatsapp){
      const tel="55"+dados.whatsapp.replace(/\D/g,"");
      const nome1=dados.nome?.split(" ")[0]||"";
      const perdaFmt=dados.perda?(dados.perda).toLocaleString("pt-BR"):"";
      const variantes=[
        `Oi, ${nome1}! Vi seu diagnóstico aqui 👋\n\nCalculei que você pode estar perdendo R$ ${perdaFmt}/mês em retornos que não acontecem na ${dados.clinica||"sua clínica"}.\n\nConsigo te mostrar como o Ritual resolve isso numa call de 30min. Faz sentido pra você?`,
        `${nome1}, recebi seu diagnóstico agora\n\nO número que calculei foi R$ ${perdaFmt}/mês — é bastante coisa.\n\nVou te mandar os detalhes e a gente agenda a demo. Pode ser?`,
        `Oi ${nome1}! Aqui é da equipe Wylvex 🎯\n\nSeu diagnóstico chegou — perda estimada de R$ ${perdaFmt}/mês em pacientes que somem antes do retorno.\n\nTenho um horário livre ainda essa semana. Quando seria melhor pra você?`,
      ];
      const idx=Math.floor(Date.now()/1000)%variantes.length;
      const msgZap=variantes[idx];
      // Route through server to avoid CORS
      fetch("https://wylvex-backend-production.up.railway.app/api/confirm-lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:tel,message:msgZap,nome:dados.nome,email:dados.email,perda:dados.perda,clinica:dados.clinica})}).catch(()=>{});
    }
    if(dados.email){
      // Email via servidor
      if(dados.email){fetch("https://wylvex-backend-production.up.railway.app/api/confirm-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:dados.email,nome:dados.nome,perda:dados.perda,clinica:dados.clinica})}).catch(()=>{});}
    }
    setLoading(false);setFase("resultado");fbTrack("Lead",{content_name:"Agendamento Ritual",currency:"BRL",value:0});
    if(topo.current)topo.current.scrollIntoView({behavior:"smooth"});
  };

  const entrarForm=()=>{setFase("form");setStep(0);if(topo.current)topo.current.scrollIntoView({behavior:"smooth"});};

  return(
    <div ref={topo} style={{fontFamily:"'Plus Jakarta Sans',sans-serif",background:"#080407",color:"#e8d8cc",minHeight:"100vh",overflowX:"hidden"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        ::-webkit-scrollbar{width:2px}::-webkit-scrollbar-thumb{background:rgba(201,149,108,.3);border-radius:2px}
        .material-symbols-outlined{font-variation-settings:'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24;font-style:normal;display:inline-flex;align-items:center}
        @keyframes pulse_d{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.5)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
        @keyframes shimG{0%{background-position:-300% center}100%{background-position:300% center}}
        @keyframes orb1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.1)}}
        @keyframes orb2{0%,100%{transform:translate(0,0)}50%{transform:translate(-40px,30px)}}
        .shim{background:linear-gradient(90deg,#c9956c 0%,#f0d9cc 25%,#fff8f4 50%,#f0d9cc 75%,#c9956c 100%);background-size:300% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimG 4s linear infinite}
        .opt{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:13px;padding:14px;cursor:pointer;transition:all .22s cubic-bezier(.16,1,.3,1);display:flex;align-items:center;gap:12px}
        .opt:hover{background:rgba(201,149,108,.07);border-color:rgba(201,149,108,.3);transform:translateX(4px)}
        .opt.sel{background:rgba(201,149,108,.12);border-color:#c9956c;box-shadow:0 0 0 1px rgba(201,149,108,.2)}
        .inp{background:rgba(255,255,255,.035);border:1.5px solid rgba(255,255,255,.08);color:#f0d9cc;padding:14px 14px 14px 44px;border-radius:11px;font-size:15px;width:100%;outline:none;font-family:'Plus Jakarta Sans',sans-serif;transition:all .2s}
        .inp:focus{border-color:rgba(201,149,108,.45);background:rgba(201,149,108,.03)}
        .inp::placeholder{color:rgba(240,217,204,.18)}
        .cta{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#c9956c,#b8845b);color:white;padding:16px 36px;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;border:none;transition:all .25s cubic-bezier(.16,1,.3,1);font-family:'Plus Jakarta Sans',sans-serif;box-shadow:0 8px 28px rgba(201,149,108,.25)}
        .cta:hover{transform:translateY(-2px);box-shadow:0 18px 48px rgba(201,149,108,.42)}
        .cta:disabled{opacity:.4;transform:none;cursor:not-allowed}
        .glass{background:rgba(20,20,22,.65);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,.07);border-radius:20px;position:relative;overflow:hidden}
        input[type=range]{-webkit-appearance:none;width:100%;height:3px;background:rgba(255,255,255,.1);border-radius:2px;outline:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#c9956c;cursor:pointer;box-shadow:0 0 14px rgba(201,149,108,.45);transition:transform .15s}
        input[type=range]::-webkit-slider-thumb:hover{transform:scale(1.2)}
        ::-webkit-scrollbar{width:0;height:0}
      
      @keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
      @keyframes shimmerGold{0%{background-position:-200% center}100%{background-position:200% center}}
      @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      @keyframes countUp{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
      @keyframes borderPulse{0%,100%{border-color:rgba(201,149,108,.2)}50%{border-color:rgba(201,149,108,.5)}}
      .fade-up{animation:fadeInUp .5s cubic-bezier(.16,1,.3,1) both}
      .float{animation:float 4s ease-in-out infinite}
      input:focus,select:focus,textarea:focus{outline:none!important;border-color:rgba(201,149,108,.5)!important;box-shadow:0 0 0 3px rgba(201,149,108,.08)!important;transition:all .2s}
      button:hover{transform:translateY(-1px)}
      button:active{transform:scale(.98)}
      `}</style>

      {/* NAV */}
      <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:500,height:56,display:"flex",alignItems:"center",justifyContent:"space-between",padding:`0 ${pad}`,background:scrollY>40?"rgba(8,4,7,.94)":"transparent",backdropFilter:scrollY>40?"blur(24px)":"none",borderBottom:scrollY>40?"1px solid rgba(201,149,108,.08)":"none",transition:"all .4s"}}>
        <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:18,fontWeight:900,color:"#f0d9cc",letterSpacing:1}}>ritual</div>
        {fase==="hero"&&<button className="cta" style={{padding:"8px 22px",fontSize:12}} onClick={entrarForm}>Ver diagnóstico →</button>}
      </nav>

      {/* ═══ HERO ═══ */}
      {fase==="hero"&&<>
        {/* S1 */}
        <section style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:`clamp(100px,14vh,130px) ${pad} 80px`,textAlign:"center",position:"relative",overflow:"hidden"}}>
          <Particles/>
          <div style={{position:"absolute",top:"10%",left:"10%",width:500,height:500,background:"radial-gradient(circle,rgba(201,149,108,.08) 0%,transparent 65%)",filter:"blur(60px)",animation:"orb1 14s ease-in-out infinite",pointerEvents:"none"}}/>
          <div style={{position:"absolute",bottom:"8%",right:"8%",width:380,height:380,background:"radial-gradient(circle,rgba(201,149,108,.06) 0%,transparent 65%)",filter:"blur(70px)",animation:"orb2 16s ease-in-out infinite",pointerEvents:"none"}}/>
          <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#c9956c 35%,#f0d9cc 50%,#c9956c 65%,transparent)"}}/>
          <div style={{position:"relative",zIndex:1,maxWidth:820}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(201,149,108,.07)",border:"1px solid rgba(201,149,108,.18)",borderRadius:40,padding:"6px 18px",marginBottom:28,animation:"fadeUp .6s ease"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:"#c9956c",animation:"pulse_d 2s infinite"}}/>
              <span style={{fontSize:10,color:"rgba(201,149,108,.8)",fontWeight:700,letterSpacing:2,textTransform:"uppercase"}}>Sistema para harmonização facial</span>
            </div>
            <h1 style={{fontFamily:"'Unbounded',sans-serif",fontSize:isMobile?34:isTablet?50:70,fontWeight:900,lineHeight:.88,letterSpacing:-2,marginBottom:20,animation:"fadeUp .6s ease .1s both"}}>
              <span className="shim">O sistema</span><br/>
              <span style={{color:"#f0d9cc"}}>que aprende o<br/>protocolo de cada</span><br/>
              <span style={{color:"rgba(240,217,204,.28)",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",fontSize:isMobile?42:isTablet?62:86}}>paciente sua.</span>
            </h1>
            <p style={{fontSize:isMobile?15:18,color:"rgba(240,217,204,.38)",lineHeight:1.8,maxWidth:560,margin:"0 auto 36px",fontWeight:300,animation:"fadeUp .6s ease .2s both"}}>
              iClinic registra. Clinicorp registra.<br/>
              <strong style={{color:"rgba(240,217,204,.65)",fontWeight:600}}>O Ritual aprende e age sozinho.</strong>
            </p>
            <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:12,alignItems:"center",justifyContent:"center",animation:"fadeUp .6s ease .3s both"}}>
              <button className="cta" style={{fontSize:isMobile?14:16,padding:isMobile?"15px 28px":"17px 44px",width:isMobile?"100%":"auto"}} onClick={entrarForm}>
                <Ic n="analytics" size={18} col="white"/> Ver meu diagnóstico gratuito →
              </button>
            </div>
            <div style={{marginTop:14,fontSize:11,color:"rgba(255,255,255,.18)",animation:"fadeUp .6s ease .4s both"}}>5 perguntas · sem compromisso · demo ao vivo</div>
          </div>
          {!isMobile&&<div style={{position:"relative",zIndex:1,width:"100%",maxWidth:520,marginTop:52,animation:"fadeUp .8s ease .5s both"}}><MiniDemo perda={4200} pacientes={23}/></div>}
        </section>

        {/* S2 — PERDA */}
        <section style={{background:"#f5ede8",padding:`clamp(80px,10vh,120px) ${pad}`,position:"relative",overflow:"hidden"}}>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            <Reveal>
              <div style={{textAlign:"center",marginBottom:52}}>
                <div style={{fontSize:10,color:"rgba(106,46,20,.5)",letterSpacing:3,textTransform:"uppercase",fontWeight:700,marginBottom:12}}>o problema que ninguém resolveu</div>
                <h2 style={{fontFamily:"'Unbounded',sans-serif",fontSize:isMobile?26:isTablet?36:50,fontWeight:900,color:"#2a0d04",lineHeight:.9,letterSpacing:-1.5}}>
                  Você perde pacientes<br/>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",color:"#c9956c",fontSize:isMobile?34:isTablet?46:64}}>toda semana.</span>
                </h2>
              </div>
            </Reveal>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":isTablet?"1fr 1fr":"repeat(3,1fr)",gap:16}}>
              {[
                {ic:"👻",n:"18%",l:"das pacientes não voltam sozinhas",sub:"Mesmo depois de um ótimo resultado. Elas esquecem."},
                {ic:"📉",n:"R$ 3.200",l:"é a perda média mensal",sub:"Com 25 pacientes e ticket de R$ 700."},
                {ic:"⏱️",n:"3 horas",l:"por semana buscando contatos",sub:"Anotações, prints, planilha. Tempo que podia atender."},
              ].map((x,i)=>(
                <Reveal key={i} delay={i*.1}>
                  <div style={{background:"white",borderRadius:18,padding:"28px 24px",boxShadow:"0 4px 24px rgba(0,0,0,.06)",border:"1px solid rgba(0,0,0,.04)"}}>
                    <div style={{fontSize:28,marginBottom:12}}>{x.ic}</div>
                    <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:28,fontWeight:900,color:"#2a0d04",marginBottom:4}}>{x.n}</div>
                    <div style={{fontSize:13,fontWeight:700,color:"#6a2e14",marginBottom:8}}>{x.l}</div>
                    <div style={{fontSize:12,color:"rgba(106,46,20,.5)",lineHeight:1.65}}>{x.sub}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* S3 — DEMO */}
        <section style={{background:"#080407",padding:`clamp(80px,10vh,120px) ${pad}`,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:"20%",right:"5%",width:400,height:400,background:"radial-gradient(circle,rgba(201,149,108,.06) 0%,transparent 65%)",filter:"blur(60px)",pointerEvents:"none"}}/>
          <div style={{maxWidth:1100,margin:"0 auto"}}>
            <div style={{display:"grid",gridTemplateColumns:isMobile||isTablet?"1fr":"1fr 1fr",gap:isMobile?40:64,alignItems:"center"}}>
              <Reveal>
                <div>
                  <div style={{fontSize:10,color:"rgba(201,149,108,.45)",letterSpacing:3,textTransform:"uppercase",fontWeight:700,marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
                    <span style={{display:"block",width:24,height:1,background:"#c9956c",opacity:.5}}/> demo ao vivo
                  </div>
                  <h2 style={{fontFamily:"'Unbounded',sans-serif",fontSize:isMobile?26:40,fontWeight:900,color:"#f0d9cc",lineHeight:.88,letterSpacing:-1.5,marginBottom:18}}>
                    Não é demo genérica.<br/>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",color:"#c9956c",fontSize:isMobile?34:50}}>É o seu sistema.</span>
                  </h2>
                  <p style={{fontSize:16,color:"rgba(240,217,204,.38)",lineHeight:1.9,fontWeight:300,marginBottom:28}}>
                    Com o nome da sua clínica.<br/>Com as suas pacientes.<br/>
                    <strong style={{color:"rgba(240,217,204,.65)"}}>Com seu protocolo configurado.</strong>
                  </p>
                  {[["search","IA identifica retornos toda manhã"],["schedule","Agenda priorizada por urgência"],["chat_bubble","WhatsApp no momento certo, automaticamente"]].map(([ic,t])=>(
                    <div key={ic} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                      <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(201,149,108,.1)",border:"1px solid rgba(201,149,108,.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <Ic n={ic} size={16} col="#c9956c"/>
                      </div>
                      <span style={{fontSize:14,color:"rgba(240,217,204,.65)"}}>{t}</span>
                    </div>
                  ))}
                  <button className="cta" style={{marginTop:24,width:isMobile?"100%":"auto"}} onClick={entrarForm}>Ver minha demonstração →</button>
                </div>
              </Reveal>
              <Reveal delay={.2}><MiniDemo perda={4200} pacientes={23}/></Reveal>
            </div>
          </div>
        </section>

        {/* S4 — PROVA */}
        <section style={{background:"linear-gradient(150deg,#2a0d04 0%,#4a1e0a 50%,#6a2e14 100%)",padding:`clamp(80px,10vh,120px) ${pad}`,position:"relative",overflow:"hidden"}}>
          <div style={{maxWidth:900,margin:"0 auto",textAlign:"center"}}>
            <Reveal>
              <div style={{fontSize:10,color:"rgba(240,217,204,.35)",letterSpacing:3,textTransform:"uppercase",fontWeight:700,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
                <span style={{display:"block",width:24,height:1,background:"rgba(240,217,204,.3)"}}/> caso real · harmonização · SP <span style={{display:"block",width:24,height:1,background:"rgba(240,217,204,.3)"}}/>
              </div>
              <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:isMobile?44:76,fontWeight:900,color:"#f0d9cc",lineHeight:.85,letterSpacing:-2,marginBottom:12}}>
                <Counter target={4200} prefix="R$ " suffix="" duration={1800}/>
              </div>
              <div style={{fontSize:isMobile?16:22,color:"rgba(240,217,204,.45)",marginBottom:36,fontWeight:300}}>recuperados em <strong style={{color:"#f0d9cc"}}>45 dias.</strong> Sem contratar ninguém.</div>
              <div style={{background:"rgba(0,0,0,.25)",border:"1px solid rgba(240,217,204,.1)",borderRadius:18,padding:"28px 32px",maxWidth:640,margin:"0 auto 32px",backdropFilter:"blur(12px)"}}>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:isMobile?17:21,color:"rgba(240,217,204,.75)",lineHeight:1.7,fontStyle:"italic",marginBottom:14}}>"O sistema identificou 28 pacientes no período de retorno. Mandou a mensagem sozinho. Em 45 dias, 9 voltaram — pacientes que eu achava que tinha perdido."</p>
                <div style={{fontSize:10,color:"rgba(255,255,255,.3)",letterSpacing:1.5,fontWeight:700}}>DRA. CAMILA F. · HARMONIZAÇÃO AVANÇADA · SÃO PAULO</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,maxWidth:540,margin:"0 auto"}}>
                {[["28","pacientes identificadas"],["9","voltaram em 1 semana"],["45d","para resultado mensurável"]].map(([n,l])=>(
                  <div key={n} style={{background:"rgba(255,255,255,.06)",borderRadius:14,padding:"16px 12px",textAlign:"center"}}>
                    <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:24,fontWeight:900,color:"#c9956c",marginBottom:5}}>{n}</div>
                    <div style={{fontSize:11,color:"rgba(240,217,204,.4)"}}>{l}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* S5 — CTA FINAL */}
        <section style={{minHeight:"60vh",display:"flex",alignItems:"center",justifyContent:"center",padding:`clamp(80px,10vh,110px) ${pad}`,background:"#080407",position:"relative",overflow:"hidden",textAlign:"center"}}>
          <Particles/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:600,height:600,background:"radial-gradient(circle,rgba(201,149,108,.06) 0%,transparent 65%)",filter:"blur(80px)",pointerEvents:"none"}}/>
          <div style={{position:"relative",zIndex:1,maxWidth:600}}>
            <Reveal>
              <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:isMobile?26:42,fontWeight:900,color:"#f0d9cc",lineHeight:.9,letterSpacing:-1.5,marginBottom:20}}>
                Quanto você está<br/><span className="shim">perdendo por mês?</span>
              </div>
              <p style={{fontSize:isMobile?14:16,color:"rgba(240,217,204,.35)",lineHeight:1.8,maxWidth:480,margin:"0 auto 32px",fontWeight:300}}>5 perguntas. Calculamos a perda real.<br/>Mostramos a demo com sua clínica. <strong style={{color:"rgba(240,217,204,.55)"}}>Você agenda se quiser.</strong></p>
              <button className="cta" style={{fontSize:isMobile?14:16,padding:isMobile?"15px 28px":"18px 48px",width:isMobile?"100%":"auto"}} onClick={entrarForm}>
                <Ic n="analytics" size={18} col="white"/> Calcular minha perda grátis →
              </button>
              <div style={{marginTop:14,fontSize:11,color:"rgba(255,255,255,.15)"}}>Sem compromisso · Diagnóstico em 2 minutos</div>
            </Reveal>
          </div>
        </section>
      </>}

      {/* ═══ FORM ═══ */}
      {fase==="form"&&(
        <div style={{minHeight:"100vh",background:"#080407",display:"flex",alignItems:"center",justifyContent:"center",padding:`80px ${pad} 40px`,position:"relative"}}>
          <Particles/>
          <div style={{width:"100%",maxWidth:520,position:"relative",zIndex:1}}>
            <div style={{marginBottom:28}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:10,color:"rgba(255,255,255,.25)",letterSpacing:1.5,textTransform:"uppercase"}}>Diagnóstico</span>
                <span style={{fontSize:10,color:"rgba(201,149,108,.5)",fontWeight:700}}>{step+1} / {ETAPAS.length}</span>
              </div>
              <div style={{height:3,background:"rgba(255,255,255,.06)",borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${((step+1)/ETAPAS.length)*100}%`,background:"linear-gradient(90deg,#c9956c,#f0d9cc)",borderRadius:2,transition:"width .5s cubic-bezier(.16,1,.3,1)"}}/>
              </div>
            </div>
            <div className="glass" style={{padding:isMobile?"24px 20px":"36px 32px"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#c9956c 40%,#f0d9cc 50%,#c9956c 60%,transparent)"}}/>
              <h2 style={{fontFamily:"'Unbounded',sans-serif",fontSize:isMobile?17:21,fontWeight:700,color:"#f0d9cc",marginBottom:6,lineHeight:1.2}}>{etapa.titulo}</h2>
              <p style={{fontSize:13,color:"rgba(255,255,255,.3)",marginBottom:24,lineHeight:1.6}}>{etapa.sub}</p>

              {etapa.tipo==="slider"&&<div>
                <div style={{textAlign:"center",marginBottom:24}}>
                  <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:64,fontWeight:900,color:"#c9956c",lineHeight:1}}>{res.pacientes||20}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.28)",marginTop:4}}>pacientes/mês</div>
                </div>
                <input type="range" min={etapa.min} max={etapa.max} step={etapa.step} value={res.pacientes||20} onChange={e=>setRes(p=>({...p,pacientes:+e.target.value}))} style={{marginBottom:6}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"rgba(255,255,255,.2)",marginBottom:24}}><span>{etapa.min}</span><span>{etapa.max}</span></div>
                {(res.pacientes||20)>=15&&<div style={{background:"rgba(239,68,68,.05)",border:"1px solid rgba(239,68,68,.12)",borderRadius:10,padding:"11px 14px",marginBottom:20,fontSize:12,color:"rgba(239,68,68,.6)"}}>
                  Estimativa: <strong style={{color:"#ef4444"}}>R$ {calcPerda(res.pacientes||20,res.ticket||500).toLocaleString("pt-BR")}/mês</strong> em retornos que não acontecem
                </div>}
                <button className="cta" style={{width:"100%"}} onClick={()=>goNext(res.pacientes||20,"pacientes")}>Continuar →</button>
              </div>}

              {etapa.tipo==="cards"&&<div>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:4}}>
                  {etapa.ops.map((op,i)=>(
                    <button key={i} className={`opt ${res[etapa.id]===(op.v||op.l)?"sel":""}`} onClick={()=>{setRes(p=>({...p,[etapa.id]:op.v||op.l}));setTimeout(()=>goNext(op.v||op.l,etapa.id),180);}}>
                      <span style={{fontSize:20,flexShrink:0}}>{op.ic}</span>
                      <span style={{fontSize:14,color:"#f0d9cc",fontWeight:res[etapa.id]===(op.v||op.l)?700:400}}>{op.l}</span>
                      {res[etapa.id]===(op.v||op.l)&&<Ic n="check_circle" size={16} col="#c9956c" style={{marginLeft:"auto"}}/>}
                    </button>
                  ))}
                </div>
              </div>}

              {etapa.tipo==="form"&&<div>
                {[["nome","Seu nome completo","text","person"],["clinica","Nome da clínica (opcional)","text","apartment"],["whatsapp","WhatsApp com DDD","tel","phone"]].map(([f,ph,t,ic])=>(
                  <div key={f} style={{marginBottom:14,position:"relative"}}>
                    <div style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",zIndex:1}}>
                      <Ic n={ic} size={17} col="rgba(255,255,255,.25)"/>
                    </div>
                    <input className="inp" type={t} value={form[f]} onChange={e=>setForm(p=>({...p,[f]:e.target.value}))} placeholder={ph} onKeyDown={e=>e.key==="Enter"&&f==="whatsapp"&&submit()}/>
                  </div>
                ))}
                <button className="cta" style={{width:"100%",padding:"15px",fontSize:15}} disabled={loading||!form.nome.trim()||form.whatsapp.replace(/\D/g,"").length<10} onClick={submit}>
                  {loading?"Calculando...":"Ver diagnóstico e agendar demo →"}
                </button>
                <p style={{fontSize:10,color:"rgba(240,217,204,.15)",textAlign:"center",marginTop:10}}>Zero spam. Só o diagnóstico e a demo.</p>
              </div>}

              {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{background:"none",border:"none",color:"rgba(255,255,255,.2)",cursor:"pointer",fontSize:12,marginTop:16,display:"block",fontFamily:"'Plus Jakarta Sans',sans-serif",transition:"color .2s"}} onMouseEnter={e=>e.target.style.color="rgba(255,255,255,.5)"} onMouseLeave={e=>e.target.style.color="rgba(255,255,255,.2)"}>← Voltar</button>}
            </div>
            <div style={{textAlign:"center",marginTop:18,fontFamily:"'Cormorant Garamond',serif",fontSize:13,color:"rgba(240,217,204,.1)",fontStyle:"italic"}}>ritual · by Wylvex</div>
          </div>
        </div>
      )}

      {/* ═══ RESULTADO ═══ */}
      {fase==="resultado"&&savedLead&&(
        <div style={{minHeight:"100vh",padding:`80px ${pad} 60px`,background:"#080407",position:"relative"}}>
          <Particles/>
          <div style={{maxWidth:1060,margin:"0 auto",position:"relative",zIndex:1}}>

            {/* Header resultado */}
            <div style={{textAlign:"center",marginBottom:44,animation:"fadeUp .6s ease"}}>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(16,185,129,.07)",border:"1px solid rgba(16,185,129,.18)",borderRadius:40,padding:"6px 18px",marginBottom:18}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#10b981",animation:"pulse_d 2s infinite"}}/>
                <span style={{fontSize:10,color:"#10b981",fontWeight:700,letterSpacing:2,textTransform:"uppercase"}}>Diagnóstico concluído</span>
              </div>
              <h1 style={{fontFamily:"'Unbounded',sans-serif",fontSize:isMobile?22:36,fontWeight:900,color:"#f0d9cc",marginBottom:10,lineHeight:1.1}}>
                {savedLead.nome?.split(" ")[0]||"Olá"}, diagnóstico pronto.
              </h1>
              <p style={{fontSize:14,color:"rgba(240,217,204,.35)"}}>
                A equipe Wylvex entra em contato em até <span style={{color:"#c9956c",fontWeight:700}}>2 horas</span>.
              </p>
            </div>

            {/* Grid 2 colunas */}
            <div style={{display:"grid",gridTemplateColumns:isMobile||isTablet?"1fr":"1fr 1fr",gap:20}}>

              {/* Esquerda */}
              <div style={{display:"flex",flexDirection:"column",gap:14}}>

                {/* Perda */}
                <div style={{background:"rgba(239,68,68,.04)",border:"1px solid rgba(239,68,68,.12)",borderRadius:18,padding:"24px 22px",animation:"fadeUp .6s ease .1s both",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#ef4444,transparent)"}}/>
                  <div style={{fontSize:9,color:"rgba(239,68,68,.5)",letterSpacing:2,textTransform:"uppercase",marginBottom:10,fontWeight:700}}>Perda estimada por mês</div>
                  <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:isMobile?36:52,fontWeight:900,color:"#ef4444",lineHeight:.9,marginBottom:10}}>
                    <Counter target={savedLead.perda||0} prefix="R$ " suffix=""/>
                  </div>
                  <div style={{fontSize:11,color:"rgba(239,68,68,.45)",lineHeight:1.6,marginBottom:14}}>Com retorno automático ativo, o Ritual recupera em média 65% em 30 dias.</div>
                  <div style={{background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.14)",borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontSize:10,color:"rgba(16,185,129,.55)",marginBottom:4,fontWeight:700}}>Recuperação estimada no 1º mês</div>
                    <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:24,fontWeight:700,color:"#10b981"}}>R$ {Math.round((savedLead.perda||0)*.65).toLocaleString("pt-BR")}</div>
                  </div>
                </div>

                {/* Dor */}
                {savedLead.dor&&(
                  <div style={{background:"rgba(201,149,108,.04)",border:"1px solid rgba(201,149,108,.12)",borderRadius:16,padding:"18px 20px",animation:"fadeUp .6s ease .2s both"}}>
                    <div style={{fontSize:9,color:"rgba(201,149,108,.45)",letterSpacing:2,textTransform:"uppercase",marginBottom:10,fontWeight:700}}>O Ritual resolve primeiro</div>
                    <div style={{display:"flex",alignItems:"center",gap:11,fontSize:14,color:"rgba(240,217,204,.7)"}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:"#c9956c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"white",flexShrink:0,fontFamily:"'Unbounded',sans-serif"}}>1</div>
                      {savedLead.dor}
                    </div>
                  </div>
                )}

                {/* Mini demo */}
                <div style={{animation:"fadeUp .6s ease .3s both"}}>
                  <div style={{fontSize:9,color:"#c9956c",letterSpacing:2,textTransform:"uppercase",marginBottom:10,display:"flex",alignItems:"center",gap:7,fontWeight:700}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:"#c9956c",animation:"pulse_d 2s infinite"}}/>Pré-demo · sua clínica no Ritual
                  </div>
                  <MiniDemo perda={savedLead.perda||4200} pacientes={savedLead.pacientes||20} nome={savedLead.nome}/>
                  <div style={{fontSize:10,color:"rgba(240,217,204,.2)",textAlign:"center",marginTop:8}}>Na call, você vê a versão completa com seus dados reais.</div>
                </div>
              </div>

              {/* Direita — agendar */}
              <div style={{animation:"fadeUp .6s ease .2s both"}}>
                <div className="glass" style={{padding:"24px 22px",marginBottom:14}}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#c9956c,transparent)"}}/>
                  <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:16,fontWeight:700,color:"#f0d9cc",marginBottom:4}}>Agende sua demonstração</div>
                  <p style={{fontSize:12,color:"rgba(255,255,255,.28)",marginBottom:20,lineHeight:1.6}}>Gratuita · 30 minutos · Ao vivo com os seus dados.</p>
                  <Agendador leadData={savedLead}/>
                </div>

                {/* O que acontece na demo */}
                <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:14,padding:"18px 20px"}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.28)",letterSpacing:2,textTransform:"uppercase",fontWeight:700,marginBottom:14}}>Na demonstração você vai ver</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {[["neurology","Sistema com nome e logo da sua clínica"],["timeline","Jornada das pacientes com seus protocolos"],["auto_awesome","IA agindo automaticamente em retornos"],["payments","Cálculo real do faturamento recuperável"]].map(([ic,t])=>(
                      <div key={ic} style={{display:"flex",alignItems:"center",gap:10,fontSize:13,color:"rgba(240,217,204,.55)"}}>
                        <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(201,149,108,.08)",border:"1px solid rgba(201,149,108,.16)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <Ic n={ic} size={14} col="#c9956c"/>
                        </div>
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{textAlign:"center",marginTop:40,fontFamily:"'Cormorant Garamond',serif",fontSize:13,color:"rgba(240,217,204,.1)",fontStyle:"italic"}}>ritual · o sistema que aprende o protocolo de cada paciente</div>
          </div>
        </div>
      )}
    </div>
  );
}