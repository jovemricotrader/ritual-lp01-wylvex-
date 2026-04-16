import { useState, useEffect, useRef, useCallback } from "react";

// Supabase acessado apenas via backend (Hub) — nunca expor chaves no frontend
const HUB_URL = window.location.origin.includes("clinica.wylvex.com")
  ? "https://wylvex-backend-production.up.railway.app"
  : window.location.origin; // dev: mesmo servidor
const HUB     = "https://wylvex-backend-production.up.railway.app";

// ── Config da LP ──
const RC = {
  nome_clinica: "Ritual",
  vertical:     "harmonizacao",
};

// Textos adaptados por vertical
const V_TEXTO = {
  harmonizacao: {
    h1_linha1: "SUAS PACIENTES",
    h1_linha2: "ESTÃO SUMINDO.",
    h1_linha3: "O RITUAL TRAZ DE VOLTA.",
    sub: "Enquanto você atende, o Ritual monitora cada paciente em silêncio e envia mensagens no momento certo — automaticamente.",
    proc_demo: "Toxina botulínica · Harmonização",
    msg_demo: "Oi Mariana! 😊 Vi que faz um tempinho desde a sua última toxina — seu ciclo de manutenção seria agora. Tá sentindo alguma diferença no resultado?",
    dias_demo: "42 dias sem retorno",
    ciclo_alert: "42d inativa · ciclo de toxina vencido",
    mensalidade_tag: "Uma toxina paga o sistema.",
  },
  odontologia: {
    h1_linha1: "SEUS PACIENTES",
    h1_linha2: "NÃO VOLTAM.",
    h1_linha3: "O RITUAL RECUPERA.",
    sub: "Enquanto você trabalha, o Ritual acompanha cada paciente e agenda retornos automaticamente — sem você tocar no celular.",
    proc_demo: "Clareamento · Odontologia",
    msg_demo: "Oi Mariana! 😊 Passando para lembrar que sua revisão semestral já está no prazo. Quer agendar essa semana?",
    dias_demo: "180 dias sem retorno",
    ciclo_alert: "180d inativa · revisão semestral vencida",
    mensalidade_tag: "Uma consulta paga o sistema.",
  },
  psicologia: {
    h1_linha1: "SEUS PACIENTES",
    h1_linha2: "ABANDONAM O PROCESSO.",
    h1_linha3: "O RITUAL MANTÉM O VÍNCULO.",
    sub: "O Ritual acompanha o engajamento dos seus pacientes e envia lembretes humanizados — preservando o vínculo terapêutico.",
    proc_demo: "Psicoterapia · Sessão mensal",
    msg_demo: "Oi Mariana! 😊 Faz um tempo que não conversamos. Como você está? Quando quiser retomar, estou aqui.",
    dias_demo: "60 dias sem sessão",
    ciclo_alert: "60d inativa · sessão mensal vencida",
    mensalidade_tag: "Uma sessão paga o sistema.",
  },
  estetica: {
    h1_linha1: "SUAS CLIENTES",
    h1_linha2: "SOMEM APÓS O PROCEDIMENTO.",
    h1_linha3: "O RITUAL FIDELIZA.",
    sub: "O Ritual monitora o ciclo de retorno de cada cliente e dispara mensagens personalizadas no momento certo — automático.",
    proc_demo: "Limpeza de pele · Estética corporal",
    msg_demo: "Oi Mariana! 😊 Seu ciclo de manutenção está chegando. Que tal agendar sua próxima sessão essa semana?",
    dias_demo: "45 dias sem retorno",
    ciclo_alert: "45d inativa · ciclo de manutenção vencido",
    mensalidade_tag: "Uma cliente de retorno paga o sistema.",
  },
};
const VT = V_TEXTO[RC.vertical] || V_TEXTO.harmonizacao;

// Token de autenticação para o Hub — definido em VITE_LP_SECRET no Railway
const LP_SECRET = import.meta.env.VITE_LP_SECRET || "";

async function sbInsert(table, body) {
  // Proxy via Hub backend — nunca acessa Supabase diretamente do frontend
  try {
    const r = await fetch(`${HUB_URL}/api/lp/insert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lp-secret": LP_SECRET
      },
      body: JSON.stringify({ table, data: body })
    });
    return await r.json();
  } catch { return null; }
}

function fbTrack(evt, data) {
  try { window.fbq && window.fbq("track", evt, data); } catch {}
}

async function salvarLead(dados) {
  const perda = calcPerda(dados.pacientes, dados.ticket);
  const row = {
    clinica_id: "wylvex",
    nome: dados.nome, clinica: dados.clinica||"",
    whatsapp: (dados.whatsapp||"").replace(/\D/g,""),
    tel: (dados.whatsapp||"").replace(/\D/g,""),
    email: (dados.email||"").replace(/[<>"'`]/g,"").slice(0,200),
    pacientes: parseInt(dados.pacientes)||20,
    dor: dados.dor||"",
    perda: perda,
    status: "novo", origem: "lp-ritual"
  };
  const [lead] = await sbInsert("leads", row)||[null];
  fbTrack("Lead", { content_name: "Diagnóstico Ritual", currency: "BRL", value: Math.round(perda/12) });
  // confirm-lead só dispara no agendamento (evita dupla mensagem)
  return lead;
}

async function salvarReuniao(dados){
  const nova={
    nome:dados.nome, clinica:dados.clinica||"", tel:dados.tel||"",
    whatsapp:dados.tel||"", email:dados.email||"",
    data:dados.data, hora:dados.hora, dia:dados.dia,
    score:0, perda:dados.perda||0, // score calculado pelo Hub, nunca pelo usuário
    status:"agendada", origem:"lp-ritual", clinica_id:"wylvex",
    meet_link:"https://meet.google.com/wylvex-ritual"
  };
  await sbInsert("reunioes", nova);
  fbTrack("Schedule",{content_name:"Call Ritual",currency:"BRL",value:nova.perda||0});
  // Whitelist explícito — nunca spread direto pro confirm-lead
  const payload={
    phone:dados.tel||dados.whatsapp||"",nome:dados.nome||"",
    clinica:dados.clinica||"",email:dados.email||"",
    perda:dados.perda||0,data:dados.data,hora:dados.hora
  };
  try{await fetch(`${HUB}/api/confirm-lead`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});}catch{}
}

const DIAS=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const MESES=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function calcPerda(p,t){return Math.round((p||20)*(t||500)*0.18);}
function sanitize(s){
  if(typeof s !== "string") return s;
  return s
    .trim()
    .replace(/[<>"'`]/g,"")      // remove HTML/JS injection chars
    .replace(/\0/g,"")           // remove null bytes
    .replace(/[\u200B-\u200D\uFEFF]/g,"")  // remove zero-width unicode tricks
    .slice(0,200);
}

function gerarSlots(){
  const slots=[];
  const now=new Date();
  const localDateStr=(d)=>{
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,"0");
    const day=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  };
  const nowMin=now.getHours()*60+now.getMinutes();
  const HORAS=["09:00","10:00","11:00","13:00","14:00","15:00","16:00"];
  for(let d=0;d<=21;d++){
    const dt=new Date(now.getFullYear(),now.getMonth(),now.getDate()+d);
    if(dt.getDay()===0||dt.getDay()===6)continue;
    const dateStr=localDateStr(dt);
    HORAS.forEach(h=>{
      const [hh,mm]=h.split(":").map(Number);
      const slotMin=hh*60+mm;
      if(d===0&&slotMin<=nowMin+90)return;
      slots.push({dt,h,key:`${dateStr}:${h}`,
        label:`${DIAS[dt.getDay()]}, ${dt.getDate()} de ${MESES[dt.getMonth()]}`,
        dateStr});
    });
  }
  return slots;
}

/* ══════════════════════════════════════════
   RITUAL DEMO ANIMATION
   Mostra o ciclo completo em tempo real:
   Paciente some → IA detecta → manda msg → ela volta
══════════════════════════════════════════ */
function RitualDemoAnimation() {
  const [step, setStep] = useState(0);
  const [msgVisible, setMsgVisible] = useState(false);
  const [replyVisible, setReplyVisible] = useState(false);
  const [agendaVisible, setAgendaVisible] = useState(false);
  const [cycling, setCycling] = useState(false);

  const steps = [
    { id: "idle",    label: "Paciente sumiu",         sub: "42 dias sem retorno",           cor: "#ef4444" },
    { id: "detect",  label: "IA detectou o risco",    sub: "Padrão de abandono identificado", cor: "#f59e0b" },
    { id: "msg",     label: "Mensagem enviada",        sub: "Tom personalizado pela IA",      cor: "#FF5C1A" },
    { id: "reply",   label: "Ela respondeu ✓",         sub: "1h 23min depois",                cor: "#10b981" },
    { id: "booked",  label: "Consulta agendada",       sub: "R$ 1.800 recuperados",           cor: "#D4AF37" },
  ];

  useEffect(() => {
    const timers = [];
    const runCycle = () => {
      setStep(0); setMsgVisible(false); setReplyVisible(false); setAgendaVisible(false);
      timers.push(setTimeout(() => setStep(1), 1200));
      timers.push(setTimeout(() => setStep(2), 2800));
      timers.push(setTimeout(() => setMsgVisible(true), 3200));
      timers.push(setTimeout(() => setStep(3), 5200));
      timers.push(setTimeout(() => setReplyVisible(true), 5600));
      timers.push(setTimeout(() => setStep(4), 7800));
      timers.push(setTimeout(() => setAgendaVisible(true), 8200));
      timers.push(setTimeout(() => runCycle(), 13000));
    };
    runCycle();
    return () => timers.forEach(clearTimeout);
  }, []);

  const cur = steps[step];

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      {/* Status pill */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", marginBottom:28 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:`${cur.cor}12`, border:`1.5px solid ${cur.cor}40`, borderRadius:40, padding:"8px 20px", transition:"all .5s" }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:cur.cor, boxShadow:`0 0 10px ${cur.cor}`, animation:"pulse_d 1.5s infinite" }}/>
          <span style={{ fontSize:13, fontWeight:700, color:cur.cor, letterSpacing:.3 }}>{cur.label}</span>
          <span style={{ fontSize:11, color:"rgba(255,255,255,.3)", marginLeft:4 }}>{cur.sub}</span>
        </div>
      </div>

      {/* Demo screen */}
      <div style={{ background:"#0d0d0e", border:"1px solid rgba(255,255,255,.07)", borderRadius:20, overflow:"hidden", maxWidth:420, margin:"0 auto", boxShadow:"0 24px 80px rgba(0,0,0,.7)", width:"100%" }}>
        {/* Topbar */}
        <div style={{ background:"#131314", padding:"12px 18px", display:"flex", alignItems:"center", gap:10, borderBottom:"1px solid rgba(255,255,255,.05)" }}>
          <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#FF5C1A,#D4AF37)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:"white" }}>R</div>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:"#f0d9cc" }}>Ritual Intelligence</div>
            <div style={{ fontSize:9, color:"rgba(16,185,129,.8)", display:"flex", alignItems:"center", gap:4 }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:"#10b981", animation:"pulse_d 2s infinite" }}/>
              Monitorando {step >= 1 ? "·  alerta ativo" : "· 24 pacientes"}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding:"18px", minHeight:200 }}>
          {/* Patient card */}
          <div style={{ background:"rgba(255,255,255,.025)", border:`1px solid ${step >= 1 ? "#ef444430" : "rgba(255,255,255,.06)"}`, borderRadius:12, padding:"12px 14px", marginBottom:12, transition:"border-color .5s" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(201,149,108,.15)", border:"1.5px solid rgba(201,149,108,.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:"#c9956c", flexShrink:0 }}>M</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#f0d9cc" }}>Mariana C.</div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,.3)" }}>{VT.proc_demo}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:9, color: step === 0 ? "#ef4444" : step >= 4 ? "#10b981" : "#f59e0b", fontWeight:700, transition:"color .5s" }}>
                  {step === 0 ? "42d sem retorno" : step >= 4 ? "✓ agendada" : "em análise..."}
                </div>
                <div style={{ fontSize:8, color:"rgba(255,255,255,.2)" }}>R$ 1.800/proc</div>
              </div>
            </div>

            {/* AI detection bar */}
            {step >= 1 && (
              <div style={{ marginTop:10, padding:"8px 10px", background:"rgba(239,68,68,.06)", border:"1px solid rgba(239,68,68,.15)", borderRadius:8, animation:"fadeIn .4s ease" }}>
                <div style={{ fontSize:9, color:"#ef4444", fontWeight:700, marginBottom:3 }}>⚠ SINAL DE ABANDONO DETECTADO</div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,.4)" }}>Respostas diminuindo · 42 dias inatva · ciclo de toxina vencido</div>
              </div>
            )}
          </div>

          {/* Message sent */}
          {msgVisible && (
            <div style={{ marginBottom:10, animation:"slideUp .4s ease" }}>
              <div style={{ fontSize:8, color:"rgba(255,92,26,.5)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:6, fontWeight:700 }}>✨ IA enviou automaticamente</div>
              <div style={{ background:"rgba(255,92,26,.08)", border:"1px solid rgba(255,92,26,.15)", borderRadius:12, padding:"10px 12px", borderBottomRightRadius:3 }}>
                <div style={{ fontSize:11, color:"rgba(240,217,204,.9)", lineHeight:1.65 }}>
                  Oi Mariana! 😊 Vi que faz um tempinho desde a sua última toxina — seu ciclo de manutenção seria agora. Tá sentindo alguma diferença no resultado?
                </div>
                <div style={{ fontSize:8, color:"rgba(255,255,255,.2)", textAlign:"right", marginTop:4 }}>✓✓ enviado · 14:23</div>
              </div>
            </div>
          )}

          {/* Reply */}
          {replyVisible && (
            <div style={{ marginBottom:10, display:"flex", justifyContent:"flex-start", animation:"slideUp .4s ease" }}>
              <div style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.1)", borderRadius:12, borderBottomLeftRadius:3, padding:"10px 12px", maxWidth:"80%" }}>
                <div style={{ fontSize:11, color:"rgba(240,217,204,.8)", lineHeight:1.65 }}>Oi! Sim, tô percebendo mesmo 😅 que bom me lembrar! Quando tem horário?</div>
                <div style={{ fontSize:8, color:"rgba(255,255,255,.2)", textAlign:"right", marginTop:4 }}>15:46</div>
              </div>
            </div>
          )}

          {/* Booked */}
          {agendaVisible && (
            <div style={{ animation:"slideUp .4s ease" }}>
              <div style={{ background:"rgba(16,185,129,.07)", border:"1px solid rgba(16,185,129,.2)", borderRadius:12, padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(16,185,129,.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>✅</div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#10b981" }}>Consulta agendada!</div>
                  <div style={{ fontSize:9, color:"rgba(255,255,255,.4)" }}>R$ 1.800 recuperados · 0 esforço manual</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Step dots */}
        <div style={{ padding:"12px 18px", borderTop:"1px solid rgba(255,255,255,.05)", display:"flex", gap:6, justifyContent:"center" }}>
          {steps.map((s,i)=>(
            <div key={i} style={{ width: i===step ? 20:6, height:6, borderRadius:3, background: i<=step ? s.cor : "rgba(255,255,255,.1)", transition:"all .4s" }}/>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   COUNTER ANIMADO
══════════════════════════════════════════ */
function Counter({ target, prefix="R$ ", suffix="/mês", duration=1800 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if(!e.isIntersecting) return;
      obs.disconnect();
      let start = null;
      const tick = (ts) => {
        if(!start) start = ts;
        const p = Math.min((ts-start)/duration, 1);
        setVal(Math.round(target * (1 - Math.pow(1-p, 3))));
        if(p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    if(ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration]);
  return (
    <span ref={ref}>{prefix}{val.toLocaleString("pt-BR")}{suffix}</span>
  );
}

/* ══════════════════════════════════════════
   REVEAL ANIMATION
══════════════════════════════════════════ */
function Reveal({ children, delay=0, direction="up" }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if(e.isIntersecting) { setVis(true); obs.disconnect(); }
    }, { threshold: 0.15 });
    if(ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  const trans = { up:"translateY(32px)", down:"translateY(-32px)", left:"translateX(-32px)", right:"translateX(32px)" };
  return (
    <div ref={ref} style={{ opacity: vis?1:0, transform: vis?"none":trans[direction]||"none", transition:`opacity .7s ${delay}s ease, transform .7s ${delay}s ease` }}>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════
   AGENDADOR (preserved + enhanced)
══════════════════════════════════════════ */
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
      const r=await fetch(`${HUB_URL}/api/lp/agenda-slots`);
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
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:5,marginBottom:16}}>
        {diasUniq.slice(0,10).map((d,i)=>{
          const sel=selDia?.dateStr===d.dateStr;
          const temVaga=slots.some(s=>s.dateStr===d.dateStr&&!blocked[s.key]);
          return(<button key={i} disabled={!temVaga||loadingSlots} onClick={()=>{setSelDia(d);setSelHora(null);}}
            style={{background:sel?"rgba(255,92,26,.15)":temVaga?"rgba(255,255,255,.04)":"rgba(255,255,255,.01)",border:`1.5px solid ${sel?"#FF5C1A":temVaga?"rgba(255,255,255,.08)":"rgba(255,255,255,.03)"}`,borderRadius:10,padding:"12px 4px",minHeight:"52px",cursor:temVaga&&!loadingSlots?"pointer":"not-allowed",opacity:temVaga?1:.35,transition:"all .2s"}}>
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
         <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:5,marginBottom:14}}>
          {horasParaDia.map(h=>{
            const sel=selHora===h;
            return(<button key={h} onClick={()=>setSelHora(sel?null:h)}
              style={{background:sel?"linear-gradient(135deg,#FF5C1A,#da4600)":"rgba(255,255,255,.04)",border:`1px solid ${sel?"#FF5C1A":"rgba(255,255,255,.08)"}`,borderRadius:8,padding:"12px 4px",minHeight:"52px",cursor:"pointer",transition:"all .2s"}}>
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



/* ══════════════════════════════════════════
   APP PRINCIPAL
══════════════════════════════════════════ */
export default function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth < 1024 && window.innerWidth >= 768);
  useEffect(()=>{ fbTrack("PageView",{}); },[]);
  const [step, setStep] = useState(0);       // 0=hero 1-4=funil 5=agendador 6=confirmado
  const [res, setRes] = useState({});
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [savedLead, setSavedLead] = useState(null);
  const [vagas, setVagas] = useState(3);
  const topRef = useRef(null);

  useEffect(() => {
    const ck = () => { setIsMobile(window.innerWidth < 768); setIsTablet(window.innerWidth < 1024 && window.innerWidth >= 768); };
    window.addEventListener("resize", ck);
    // Simula contagem de vagas decrescendo
    const t = setTimeout(() => setVagas(2), 45000);
    return () => { window.removeEventListener("resize", ck); clearTimeout(t); };
  }, []);

  const perda = calcPerda(res.pacientes, res.ticket);

  const ETAPAS = [
    { id:"pacientes", tipo:"slider", titulo:"Quantas pacientes novas entram na sua clínica por mês?", sub:"Considere consultas pagas, não seguidoras." },
    { id:"ticket",    tipo:"cards",  titulo:"Qual seu ticket médio por procedimento?", sub:"Aproximadamente.",
      ops:[{ic:"💉",l:"R$ 300 – R$ 600",v:450},{ic:"✨",l:"R$ 600 – R$ 1.500",v:900},{ic:"💎",l:"Acima de R$ 1.500",v:1800}] },
    { id:"dor",       tipo:"cards",  titulo:"O que mais trava sua clínica hoje?", sub:"Uma resposta. A que mais dói.",
      ops:[{ic:"👻",l:"Paciente some antes do retorno",v:"sumiu"},{ic:"💸",l:"Agenda vazia entre procedimentos",v:"agenda"},{ic:"🔁",l:"Não consigo fidelizar as pacientes",v:"fidelizar"},{ic:"😰",l:"Tudo manual — sem tempo pra gestão",v:"manual"}] },
    { id:"contato",   tipo:"form",   titulo:"Última etapa.", sub:"Para onde enviamos o diagnóstico?" },
  ];
  const etapaAtual = ETAPAS[step - 1];

  const avancar = (val) => {
    setRes(p => ({ ...p, [ETAPAS[step-1].id]: val }));
    fbTrack("ViewContent",{content_name:"funil_step_"+step,content_type:ETAPAS[step-1]?.id||""});
    if(step < ETAPAS.length) { setStep(s => s+1); topRef.current?.scrollIntoView({behavior:"smooth"}); }
  };

  const _lastSubmit = useRef(0);
  const enviar = async () => {
    if(!form.nome?.trim()||!form.whatsapp?.trim()) return;
    // Throttle: max 1 submit por 10s (anti-spam / slow connection)
    if(Date.now() - _lastSubmit.current < 10000) return;
    _lastSubmit.current = Date.now();
    fbTrack("InitiateCheckout",{content_name:"diagnostico_ritual",currency:"BRL",value:Math.round(perda||0)});
    setLoading(true);
    const dados = { ...res, ...form, perda };
    const lead = await salvarLead(dados);
    setSavedLead({ ...dados, id: lead?.id });
    setLoading(false);
    setStep(5);
    topRef.current?.scrollIntoView({behavior:"smooth"});
  };

  const F = (k,v) => setForm(p => ({...p,[k]:v}));

  // ─── Styles ───
  const S = {
    inp: {
      width:"100%", background:"rgba(255,255,255,.04)", border:"1.5px solid rgba(255,255,255,.08)",
      color:"#f0d9cc", padding:"14px 16px", borderRadius:12, fontSize:14, outline:"none",
      fontFamily:"'Plus Jakarta Sans',sans-serif", transition:"border-color .2s"
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#0A0A0B;color:#F8F9FA;font-family:'Plus Jakarta Sans',sans-serif;-webkit-font-smoothing:antialiased;}
        @keyframes pulse_d{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer_g{0%{background-position:200%}100%{background-position:-200%}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes orbit{from{transform:rotate(0deg) translateX(80px) rotate(0deg)}to{transform:rotate(360deg) translateX(80px) rotate(-360deg)}}
        @keyframes scan{0%{transform:translateY(-100%)}100%{transform:translateY(400%)}}
        @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .gold-shimmer{background:linear-gradient(90deg,#c9956c 0%,#D4AF37 20%,#FFE088 50%,#D4AF37 80%,#c9956c 100%);background-size:300% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer_g 4s linear infinite;}
        @media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important;}}
        .oracle-border{border:1px solid transparent;background:linear-gradient(#131314,#131314) padding-box,linear-gradient(135deg,#FF5C1A,#D4AF37,#FF5C1A) border-box;}
      `}</style>

      <div style={{ minHeight:"100vh", background:"#0A0A0B", overflowX:"hidden", paddingBottom: step===0?"0":"64px" }}>

        {/* ── NAVBAR ── */}
        <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, padding:isMobile?"12px 16px":"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(10,10,11,.85)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,.04)" }}>
          <div style={{ fontFamily:"'Unbounded',sans-serif", fontSize:15, fontWeight:900, color:"#F8F9FA", letterSpacing:"-0.5px" }}>
            RITUAL<span style={{ color:"#FF5C1A", marginLeft:3 }}>·</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:isMobile?8:16 }}>
            <div style={{ fontSize:10, color:vagas<=2?"#ef4444":"#f59e0b", fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:vagas<=2?"#ef4444":"#f59e0b", animation:"pulse_d 2s infinite" }}/>
              {vagas} {isMobile?"vagas":"vagas esta semana"}
            </div>
            <button onClick={()=>{ setStep(1); topRef.current?.scrollIntoView({behavior:"smooth"}); }}
              style={{ background:"linear-gradient(135deg,#FF5C1A,#da4600)", border:"none", borderRadius:20, padding:isMobile?"7px 14px":"8px 20px", cursor:"pointer", color:"white", fontSize:11, fontWeight:800, fontFamily:"'Plus Jakarta Sans',sans-serif", whiteSpace:"nowrap" }}>
              Ver minha perda
            </button>
          </div>
        </nav>

        {/* ── STICKY BOTTOM BAR — aparece após 300px scroll ── */}
        {scrollY > 300 && step === 0 && (
          <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:200, paddingBottom:"env(safe-area-inset-bottom,0px)", background:"rgba(10,10,11,.95)", backdropFilter:"blur(20px)", borderTop:"1px solid rgba(255,92,26,.2)", padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, animation:"slideUp .3s ease" }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#f0d9cc", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                Sua clínica perde em média <span style={{ color:"#ef4444" }}>R$ 900/mês</span> com pacientes sumidas.
              </div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,.3)", marginTop:1 }}>Calculamos o seu em 2 minutos — grátis</div>
            </div>
            <button onClick={()=>{ setStep(1); topRef.current?.scrollIntoView({behavior:"smooth"}); fbTrack("ViewContent",{content_name:"sticky_bar_cta"}); }}
              style={{ background:"linear-gradient(135deg,#FF5C1A,#da4600)", border:"none", borderRadius:9, padding:"10px 20px", cursor:"pointer", color:"white", fontSize:12, fontWeight:800, fontFamily:"'Plus Jakarta Sans',sans-serif", whiteSpace:"nowrap", flexShrink:0, boxShadow:"0 4px 20px rgba(255,92,26,.35)" }}>
              Calcular →
            </button>
          </div>
        )}

        {/* ════════════════════════════
            S1 — HERO
        ════════════════════════════ */}
        <section style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:`clamp(100px,14vh,140px) ${isMobile?"20px":"clamp(24px,8vw,100px)"} 80px`, textAlign:"center", position:"relative", overflow:"hidden" }}>
          {/* BG radials */}
          <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
            <div style={{ position:"absolute", top:"15%", left:"50%", transform:"translateX(-50%)", width:600, height:600, background:"radial-gradient(circle,rgba(255,92,26,.06) 0%,transparent 70%)" }}/>
            <div style={{ position:"absolute", bottom:"10%", right:"10%", width:300, height:300, background:"radial-gradient(circle,rgba(212,175,55,.04) 0%,transparent 70%)" }}/>
            {/* Grid */}
            <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:.04 }} xmlns="http://www.w3.org/2000/svg">
              <defs><pattern id="g" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="#c9956c" strokeWidth=".5"/></pattern></defs>
              <rect width="100%" height="100%" fill="url(#g)"/>
            </svg>
          </div>

          <div style={{ position:"relative", zIndex:1, maxWidth:780 }}>
            {/* Badge */}
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,92,26,.07)", border:"1px solid rgba(255,92,26,.2)", borderRadius:40, padding:"6px 18px", marginBottom:28, animation:"fadeIn .8s ease" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#FF5C1A", animation:"pulse_d 2s infinite" }}/>
              <span style={{ fontSize:10, color:"#FF5C1A", fontWeight:700, letterSpacing:2, textTransform:"uppercase" }}>Sistema de Retenção Inteligente</span>
            </div>

            {/* Headline */}
            <h1 style={{ fontFamily:"'Unbounded',sans-serif", fontSize:isMobile?"clamp(26px,8vw,38px)":isTablet?"clamp(30px,5vw,50px)":"clamp(32px,5vw,64px)", fontWeight:900, lineHeight:.95, letterSpacing:"-2px", marginBottom:16, animation:"fadeIn .8s .2s ease both" }}>
              <span style={{ display:"block", color:"#F8F9FA" }}>{VT.h1_linha1}</span>
              <span style={{ display:"block", color:"#F8F9FA" }}>{VT.h1_linha2}</span>
              <span className="gold-shimmer" style={{ display:"block", fontSize:`clamp(24px,4vw,54px)` }}>{VT.h1_linha3}</span>
            </h1>
            {/* Sub-headline cirúrgica com número */}
            <div style={{ fontFamily:"'Unbounded',sans-serif", fontSize:isMobile?12:15, fontWeight:700, color:"rgba(239,68,68,.85)", marginBottom:20, animation:"fadeIn .8s .3s ease both", letterSpacing:"-0.3px" }}>
              Você perde em média <span style={{color:"#ef4444"}}>R$ 2.800/mês</span> — calculamos o seu em 2 min.
            </div>

            <p style={{ fontSize:isMobile?14:18, color:"rgba(240,217,204,.5)", lineHeight:1.75, maxWidth:520, margin:"0 auto 36px", animation:"fadeIn .8s .4s ease both" }}>
              {VT.sub}
            </p>

            {/* Hero CTAs */}
            <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap", animation:"fadeIn .8s .6s ease both" }}>
              <button onClick={()=>{ setStep(1); setTimeout(()=>topRef.current?.scrollIntoView({behavior:"smooth"}),50); }}
                style={{ background:"linear-gradient(135deg,#FF5C1A,#da4600)", border:"none", borderRadius:12, padding:"16px 32px", cursor:"pointer", color:"white", fontSize:15, fontWeight:800, fontFamily:"'Plus Jakarta Sans',sans-serif", boxShadow:"0 8px 40px rgba(255,92,26,.35)", transition:"transform .2s, box-shadow .2s" }}
                onMouseOver={e=>{e.target.style.transform="translateY(-2px)";e.target.style.boxShadow="0 12px 50px rgba(255,92,26,.5)"}}
                onMouseOut={e=>{e.target.style.transform="";e.target.style.boxShadow="0 8px 40px rgba(255,92,26,.35)"}}>
                Calcular minha perda →
              </button>
              <a href="#demo" style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.1)", borderRadius:12, padding:"16px 24px", color:"rgba(240,217,204,.7)", fontSize:14, fontWeight:600, textDecoration:"none", transition:"border-color .2s" }}
                onMouseOver={e=>e.target.style.borderColor="rgba(201,149,108,.3)"}
                onMouseOut={e=>e.target.style.borderColor="rgba(255,255,255,.1)"}>
                Ver como funciona ↓
              </a>
            </div>

            {/* Social proof strip */}
            <div style={{ display:"flex", gap:isMobile?16:32, justifyContent:"center", flexWrap:"wrap", marginTop:48, animation:"fadeIn .8s .8s ease both" }}>
              {[["65%","de retorno médio"],["48h","para resultado",""],["0","esforço manual"]].map(([n,l]) => (
                <div key={n} style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"'Unbounded',sans-serif", fontSize:isMobile?22:28, fontWeight:900, color:"#FF5C1A" }}>{n}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,.3)", marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════
            S2 — DEMO ANIMATION
        ════════════════════════════ */}
        <section id="demo" style={{ background:"#0e0a12", padding:`clamp(60px,8vh,120px) ${isMobile?"16px":isTablet?"32px":"clamp(24px,6vw,80px)"}` }}>
          <div style={{ maxWidth:900, margin:"0 auto" }}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile||isTablet?"1fr":"1fr 1fr", gap:isMobile?40:isTablet?32:60, alignItems:"center" }}>
              <Reveal>
                <div style={{ fontSize:9, color:"rgba(255,92,26,.6)", letterSpacing:3, textTransform:"uppercase", marginBottom:14, fontWeight:700 }}>● Como funciona</div>
                <h2 style={{ fontFamily:"'Unbounded',sans-serif", fontSize:isMobile?24:34, fontWeight:900, lineHeight:1.05, letterSpacing:"-1px", marginBottom:20 }}>
                  Você atende.<br/><span style={{ color:"#FF5C1A" }}>O Ritual retém.</span>
                </h2>
                <p style={{ fontSize:14, color:"rgba(240,217,204,.5)", lineHeight:1.8, marginBottom:28 }}>
                  Em vez de paciente sumida, você tem uma IA que detecta o risco antes de acontecer — e age automaticamente no momento certo.
                </p>

                {/* Steps */}
                {[
                  ["01","IA monitora cada paciente","Analisa padrão de respostas, ciclo do procedimento e sinais de abandono em silêncio."],
                  ["02","Detecta o momento exato","Quando o risco aparece, o sistema age — não no dia seguinte. Agora."],
                  ["03","Mensagem personalizada","Tom adaptado ao perfil da paciente. Não parece robô. Parece você."],
                  ["04","Paciente retorna + agenda","Resultado medido. ROI visível no dashboard."],
                ].map(([n,t,d]) => (
                  <div key={n} style={{ display:"flex", gap:14, marginBottom:18 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:"rgba(255,92,26,.1)", border:"1px solid rgba(255,92,26,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:900, color:"#FF5C1A", flexShrink:0 }}>{n}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:"#f0d9cc", marginBottom:3 }}>{t}</div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.35)", lineHeight:1.6 }}>{d}</div>
                    </div>
                  </div>
                ))}
              </Reveal>

              <Reveal delay={0.2}>
                <RitualDemoAnimation/>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ════════════════════════════
            S3 — PERDA ESTIMADA + FUNIL
        ════════════════════════════ */}
        <section ref={topRef} style={{ background:"#0A0A0B", padding:`clamp(60px,8vh,120px) ${isMobile?"16px":isTablet?"32px":"clamp(24px,6vw,80px)"}` }}>
          <div style={{ maxWidth:640, margin:"0 auto" }}>

            {/* Funil steps 1-4 */}
            {step >= 1 && step <= 4 && (
              <div>
                {/* Progress */}
                <div style={{ display:"flex", gap:4, marginBottom:32 }}>
                  {ETAPAS.map((_,i) => (
                    <div key={i} style={{ flex:1, height:3, borderRadius:2, background: i<step ? "#FF5C1A" : "rgba(255,255,255,.08)", transition:"background .4s" }}/>
                  ))}
                </div>

                {perda > 0 && (
                  <div style={{ background:"rgba(239,68,68,.06)", border:"1px solid rgba(239,68,68,.15)", borderRadius:12, padding:"12px 16px", marginBottom:24, display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:"#ef4444", animation:"pulse_d 1.5s infinite", flexShrink:0 }}/>
                    <div>
                      <span style={{ fontSize:11, color:"rgba(239,68,68,.7)" }}>Perda estimada: </span>
                      <span style={{ fontFamily:"'Unbounded',sans-serif", fontSize:16, fontWeight:900, color:"#ef4444" }}>R$ {perda.toLocaleString("pt-BR")}/mês</span>
                    </div>
                  </div>
                )}

                {/* Etapa Slider — pacientes */}
                {etapaAtual?.tipo === "slider" && (
                  <div style={{ animation:"fadeIn .4s ease" }}>
                    <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:isMobile?22:30, fontWeight:700, color:"#f0d9cc", marginBottom:8, lineHeight:1.2 }}>{etapaAtual.titulo}</h2>
                    <p style={{ fontSize:12, color:"rgba(240,217,204,.35)", marginBottom:32 }}>{etapaAtual.sub}</p>
                    <div style={{ textAlign:"center", marginBottom:20 }}>
                      <span style={{ fontFamily:"'Unbounded',sans-serif", fontSize:60, fontWeight:900, color:"#FF5C1A" }}>{res.pacientes||20}</span>
                      <span style={{ fontSize:16, color:"rgba(255,255,255,.4)", marginLeft:8 }}>pacientes/mês</span>
                    </div>
                    <input type="range" min="5" max="150" step="5" value={res.pacientes||20}
                      onChange={e=>setRes(p=>({...p,pacientes:parseInt(e.target.value)}))}
                      style={{ width:"100%", marginBottom:28, accentColor:"#FF5C1A" }}/>
                    <button onClick={()=>avancar(res.pacientes||20)}
                      style={{ width:"100%", background:"linear-gradient(135deg,#FF5C1A,#da4600)", border:"none", borderRadius:12, padding:"16px", cursor:"pointer", color:"white", fontSize:15, fontWeight:800, fontFamily:"'Plus Jakarta Sans',sans-serif", boxShadow:"0 8px 30px rgba(255,92,26,.25)" }}>
                      Continuar →
                    </button>
                  </div>
                )}

                {/* Etapa Cards */}
                {etapaAtual?.tipo === "cards" && (
                  <div style={{ animation:"fadeIn .4s ease" }}>
                    <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:isMobile?22:30, fontWeight:700, color:"#f0d9cc", marginBottom:8, lineHeight:1.2 }}>{etapaAtual.titulo}</h2>
                    <p style={{ fontSize:12, color:"rgba(240,217,204,.35)", marginBottom:28 }}>{etapaAtual.sub}</p>
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      {etapaAtual.ops.map(op => (
                        <button key={op.v} onClick={()=>avancar(op.v)}
                          style={{ background:"rgba(255,255,255,.025)", border:"1.5px solid rgba(255,255,255,.07)", borderRadius:14, padding:"16px 20px", cursor:"pointer", display:"flex", alignItems:"center", gap:16, textAlign:"left", transition:"all .2s" }}
                          onMouseOver={e=>{ e.currentTarget.style.borderColor="rgba(255,92,26,.4)"; e.currentTarget.style.background="rgba(255,92,26,.05)"; }}
                          onMouseOut={e=>{ e.currentTarget.style.borderColor="rgba(255,255,255,.07)"; e.currentTarget.style.background="rgba(255,255,255,.025)"; }}>
                          <span style={{ fontSize:24, flexShrink:0 }}>{op.ic}</span>
                          <span style={{ fontSize:14, fontWeight:600, color:"#f0d9cc" }}>{op.l}</span>
                          <span style={{ marginLeft:"auto", color:"rgba(255,255,255,.2)", fontSize:18 }}>›</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Etapa Form — contato */}
                {etapaAtual?.tipo === "form" && (
                  <div style={{ animation:"fadeIn .4s ease" }}>

                    {/* ── PERDA HEADER ── */}
                    {perda > 0 && (
                      <div style={{ background:"linear-gradient(135deg,rgba(239,68,68,.08),rgba(239,68,68,.04))", border:"1.5px solid rgba(239,68,68,.2)", borderRadius:16, padding:"18px 20px", marginBottom:24, position:"relative", overflow:"hidden" }}>
                        <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,transparent,#ef4444,transparent)" }}/>
                        <div style={{ fontSize:8, color:"rgba(239,68,68,.6)", letterSpacing:2.5, textTransform:"uppercase", marginBottom:4, fontWeight:700 }}>⚠ Perda estimada da sua clínica</div>
                        <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
                          <span style={{ fontFamily:"'Unbounded',sans-serif", fontSize:isMobile?32:44, fontWeight:900, color:"#ef4444", letterSpacing:"-2px", lineHeight:1 }}>
                            R$ {perda.toLocaleString("pt-BR")}
                          </span>
                          <span style={{ fontSize:14, color:"rgba(255,255,255,.3)" }}>/mês</span>
                        </div>
                        <div style={{ fontSize:10, color:"rgba(201,149,108,.6)", lineHeight:1.6 }}>
                          Com retorno automático, o Ritual recupera <strong style={{ color:"#D4AF37" }}>65% disso em 30 dias.</strong>
                        </div>
                      </div>
                    )}

                    {/* ── HEADER ── */}
                    <div style={{ marginBottom:24 }}>
                      <div style={{ fontSize:8, color:"rgba(255,92,26,.5)", letterSpacing:2.5, textTransform:"uppercase", marginBottom:8, fontWeight:700 }}>Última etapa</div>
                      <h2 style={{ fontFamily:"'Unbounded',sans-serif", fontSize:isMobile?18:22, fontWeight:900, color:"#F8F9FA", lineHeight:1.1, letterSpacing:"-0.5px", marginBottom:6 }}>
                        Para onde mandamos<br/><span style={{ color:"#FF5C1A" }}>seu diagnóstico?</span>
                      </h2>
                      <p style={{ fontSize:12, color:"rgba(255,255,255,.35)", lineHeight:1.7 }}>
                        Menos de 30 segundos. A Equipe Ritual entra em contato em até 2 horas.
                      </p>
                    </div>

                    {/* ── CAMPOS ── */}
                    <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>

                      {/* Nome */}
                      <div style={{ position:"relative" }}>
                        <div style={{ fontSize:9, color: form.nome?.trim() ? "rgba(16,185,129,.7)" : "rgba(255,255,255,.3)", letterSpacing:1, textTransform:"uppercase", marginBottom:5, fontWeight:700, transition:"color .3s", display:"flex", alignItems:"center", gap:6 }}>
                          {form.nome?.trim() && <span style={{ fontSize:10 }}>✓</span>}
                          Seu nome
                        </div>
                        <input type="text" placeholder="Dra. Maria Silva" value={form.nome||""} onChange={e=>F("nome",sanitize(e.target.value))}
                          style={{ ...S.inp, borderColor: form.nome?.trim() ? "rgba(16,185,129,.4)" : "rgba(255,255,255,.08)", boxShadow: form.nome?.trim() ? "0 0 0 3px rgba(16,185,129,.06)" : "none", transition:"all .3s" }}
                          onFocus={e=>{e.target.style.borderColor="rgba(255,92,26,.5)";e.target.style.boxShadow="0 0 0 3px rgba(255,92,26,.08)";}}
                          onBlur={e=>{e.target.style.borderColor=form.nome?.trim()?"rgba(16,185,129,.4)":"rgba(255,255,255,.08)";e.target.style.boxShadow=form.nome?.trim()?"0 0 0 3px rgba(16,185,129,.06)":"none";}}/>
                      </div>

                      {/* Clínica */}
                      <div style={{ position:"relative" }}>
                        <div style={{ fontSize:9, color: form.clinica?.trim() ? "rgba(16,185,129,.7)" : "rgba(255,255,255,.3)", letterSpacing:1, textTransform:"uppercase", marginBottom:5, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
                          {form.clinica?.trim() && <span style={{ fontSize:10 }}>✓</span>}
                          Nome da clínica
                        </div>
                        <input type="text" placeholder="Clínica Estética Silva" value={form.clinica||""} onChange={e=>F("clinica",sanitize(e.target.value))}
                          style={{ ...S.inp, borderColor: form.clinica?.trim() ? "rgba(16,185,129,.4)" : "rgba(255,255,255,.08)", boxShadow: form.clinica?.trim() ? "0 0 0 3px rgba(16,185,129,.06)" : "none", transition:"all .3s" }}
                          onFocus={e=>{e.target.style.borderColor="rgba(255,92,26,.5)";e.target.style.boxShadow="0 0 0 3px rgba(255,92,26,.08)";}}
                          onBlur={e=>{e.target.style.borderColor=form.clinica?.trim()?"rgba(16,185,129,.4)":"rgba(255,255,255,.08)";e.target.style.boxShadow=form.clinica?.trim()?"0 0 0 3px rgba(16,185,129,.06)":"none";}}/>
                      </div>

                      {/* WhatsApp */}
                      <div style={{ position:"relative" }}>
                        <div style={{ fontSize:9, color: form.whatsapp?.replace(/\D/g,"").length>=10 ? "rgba(16,185,129,.7)" : "rgba(255,255,255,.3)", letterSpacing:1, textTransform:"uppercase", marginBottom:5, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
                          {form.whatsapp?.replace(/\D/g,"").length>=10 && <span style={{ fontSize:10 }}>✓</span>}
                          WhatsApp <span style={{ color:"rgba(255,92,26,.6)", fontWeight:900, fontSize:9 }}>*</span>
                        </div>
                        <input type="tel" placeholder="(47) 99999-9999" value={form.whatsapp||""} onKeyDown={e=>{ if(e.key==="Enter" && form.nome?.trim() && form.whatsapp?.replace(/\D/g,"").length>=10) enviar(); }} onChange={e=>{
                          const raw=e.target.value.replace(/\D/g,"").slice(0,11);
                          const fmt=raw.length<=2?raw:raw.length<=7?"("+raw.slice(0,2)+") "+raw.slice(2):"("+raw.slice(0,2)+") "+raw.slice(2,7)+"-"+raw.slice(7);
                          F("whatsapp",fmt);
                        }}
                          style={{ ...S.inp, borderColor: form.whatsapp?.replace(/\D/g,"").length>=10 ? "rgba(16,185,129,.4)" : "rgba(255,255,255,.08)", boxShadow: form.whatsapp?.replace(/\D/g,"").length>=10 ? "0 0 0 3px rgba(16,185,129,.06)" : "none", transition:"all .3s", letterSpacing:".5px" }}
                          onFocus={e=>{e.target.style.borderColor="rgba(255,92,26,.5)";e.target.style.boxShadow="0 0 0 3px rgba(255,92,26,.08)";}}
                          onBlur={e=>{const ok=form.whatsapp?.replace(/\D/g,"").length>=10;e.target.style.borderColor=ok?"rgba(16,185,129,.4)":"rgba(255,255,255,.08)";e.target.style.boxShadow=ok?"0 0 0 3px rgba(16,185,129,.06)":"none";}}/>
                      </div>

                      {/* Email — opcional */}
                      <div style={{ position:"relative" }}>
                        <div style={{ fontSize:9, color: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email||"") ? "rgba(16,185,129,.7)" : "rgba(255,255,255,.2)", letterSpacing:1, textTransform:"uppercase", marginBottom:5, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email||"") && <span style={{ fontSize:10 }}>✓</span>}
                            E-mail
                          </div>
                          <span style={{ fontSize:8, color:"rgba(255,255,255,.2)", fontWeight:400, letterSpacing:0, textTransform:"none" }}>opcional — receba o diagnóstico também por e-mail</span>
                        </div>
                        <input type="email" placeholder="dra.maria@clinica.com.br" value={form.email||""} onChange={e=>F("email",sanitize(e.target.value))}
                          style={{ ...S.inp, borderColor: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email||"") ? "rgba(16,185,129,.4)" : "rgba(255,255,255,.05)", opacity:.75, boxShadow: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email||"") ? "0 0 0 3px rgba(16,185,129,.06)" : "none", transition:"all .3s", fontSize:13 }}
                          onFocus={e=>{e.target.style.borderColor="rgba(255,92,26,.5)";e.target.style.opacity="1";e.target.style.boxShadow="0 0 0 3px rgba(255,92,26,.08)";}}
                          onBlur={e=>{const ok=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email||"");e.target.style.borderColor=ok?"rgba(16,185,129,.4)":"rgba(255,255,255,.05)";e.target.style.opacity=ok?"1":".75";e.target.style.boxShadow=ok?"0 0 0 3px rgba(16,185,129,.06)":"none";}}/>
                      </div>
                    </div>

                    {/* ── TRUST BAR ── */}
                    <div style={{ display:"flex", gap:14, marginBottom:16, padding:"10px 12px", background:"rgba(255,255,255,.02)", borderRadius:10, border:"1px solid rgba(255,255,255,.04)" }}>
                      {[["🔒","Sem spam"],["⚡","Resposta em 2h"],["🎯","Demo ao vivo"]].map(([ic,txt])=>(
                        <div key={txt} style={{ display:"flex", alignItems:"center", gap:5, flex:1 }}>
                          <span style={{ fontSize:13 }}>{ic}</span>
                          <span style={{ fontSize:9, color:"rgba(255,255,255,.35)", fontWeight:600 }}>{txt}</span>
                        </div>
                      ))}
                    </div>

                    {/* ── CTA BUTTON — inteligente ── */}
                    {(()=>{
                      const nomeOk = form.nome?.trim();
                      const waOk   = form.whatsapp?.replace(/\D/g,"").length >= 10;
                      const tudo   = nomeOk && waOk;
                      const label  = loading ? "Processando..." : !nomeOk ? "Preencha seu nome →" : !waOk ? "Informe o WhatsApp →" : "Receber diagnóstico grátis →";
                      return(
                        <button onClick={enviar} disabled={loading||!tudo}
                          style={{ width:"100%", background: tudo && !loading ? "linear-gradient(135deg,#FF5C1A,#da4600)" : "rgba(255,255,255,.04)", border: tudo?"none":"1px solid rgba(255,255,255,.07)", borderRadius:14, padding:"17px 20px", cursor: tudo&&!loading ? "pointer":"not-allowed", color: tudo&&!loading ? "white":"rgba(255,255,255,.25)", fontSize:15, fontWeight:900, fontFamily:"'Unbounded',sans-serif", letterSpacing:"-0.3px", transition:"all .3s", boxShadow: tudo&&!loading ? "0 10px 40px rgba(255,92,26,.3)":"none", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                          {loading && <div style={{ width:16, height:16, border:"2px solid rgba(255,255,255,.3)", borderTopColor:"white", borderRadius:"50%", animation:"spin .8s linear infinite" }}/>}
                          {label}
                        </button>
                      );
                    })()}

                    {/* Micro social proof */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginTop:12 }}>
                      <div style={{ display:"flex" }}>
                        {["#FF5C1A","#D4AF37","#8b5cf6","#10b981","#06b6d4"].map((cor,i)=>(
                          <div key={i} style={{ width:20, height:20, borderRadius:"50%", background:cor, border:"2px solid #0A0A0B", marginLeft:i>0?-8:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:900, color:"white" }}>{["C","M","J","A","R"][i]}</div>
                        ))}
                      </div>
                      <span style={{ fontSize:10, color:"rgba(255,255,255,.25)" }}>+{vagas === 3 ? "12" : "10"} médicas receberam o diagnóstico hoje</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 0 — CTA para iniciar */}
            {step === 0 && (
              <Reveal>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:9, color:"rgba(255,92,26,.6)", letterSpacing:3, textTransform:"uppercase", marginBottom:16, fontWeight:700 }}>● Diagnóstico gratuito</div>
                  <h2 style={{ fontFamily:"'Unbounded',sans-serif", fontSize:isMobile?24:36, fontWeight:900, lineHeight:1.05, letterSpacing:"-1px", marginBottom:16 }}>
                    Quanto você está<br/><span style={{ color:"#FF5C1A" }}>perdendo por mês?</span>
                  </h2>
                  <p style={{ fontSize:14, color:"rgba(240,217,204,.4)", marginBottom:32, lineHeight:1.8 }}>
                    2 minutos. Descobra exatamente quanto a sua clínica perde com pacientes que não retornam — e como recuperar.
                  </p>
                  <button onClick={()=>{ setStep(1); }}
                    style={{ background:"linear-gradient(135deg,#FF5C1A,#da4600)", border:"none", borderRadius:12, padding:"18px 40px", cursor:"pointer", color:"white", fontSize:16, fontWeight:800, fontFamily:"'Plus Jakarta Sans',sans-serif", boxShadow:"0 8px 40px rgba(255,92,26,.35)" }}>
                    Calcular minha perda →
                  </button>
                </div>
              </Reveal>
            )}

            {/* Step 5 — Agendador */}
            {step === 5 && savedLead && (
              <div style={{ animation:"fadeIn .6s ease" }}>
                <div style={{ textAlign:"center", marginBottom:28 }}>
                  <div style={{ fontFamily:"'Unbounded',sans-serif", fontSize:18, fontWeight:900, color:"#F8F9FA", marginBottom:6 }}>
                    {savedLead.nome?.split(" ")[0]}, diagnóstico concluído.
                  </div>
                  <div style={{ fontSize:13, color:"rgba(240,217,204,.4)" }}>
                    Equipe Ritual entra em contato em até <strong style={{ color:"#D4AF37" }}>2 horas</strong>
                  </div>
                </div>

                {/* Perda card */}
                <div style={{ background:"rgba(239,68,68,.05)", border:"1px solid rgba(239,68,68,.15)", borderRadius:14, padding:"18px 20px", marginBottom:24 }}>
                  <div style={{ fontSize:9, color:"rgba(239,68,68,.5)", letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Perda estimada por mês</div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:44, fontWeight:700, color:"#ef4444" }}>
                    <Counter target={savedLead.perda||0} prefix="R$ " suffix=""/>
                  </div>
                  <div style={{ fontSize:11, color:"rgba(201,149,108,.5)", marginTop:4 }}>Com retorno automático ativo, o Ritual recupera em média 65% em 30 dias.</div>
                </div>

                {/* Mini demo */}
                <div className="oracle-border" style={{ borderRadius:16, padding:"20px", marginBottom:24 }}>
                  <Agendador leadData={{ nome:savedLead.nome, clinica:savedLead.clinica, tel:(savedLead.whatsapp||"").replace(/\D/g,""), email:savedLead.email, score:savedLead.score, perda:savedLead.perda }}/>
                </div>

                <div style={{ fontSize:11, color:"rgba(255,255,255,.2)", textAlign:"center" }}>
                  Na call, você vê o sistema completo com os dados da sua clínica.
                </div>
                <div style={{textAlign:"center",marginTop:16,paddingTop:16,borderTop:"1px solid rgba(255,255,255,.05)"}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.25)",marginBottom:8}}>Prefere falar antes?</div>
                  <a href="https://wa.me/554799138922?text=Oi!%20Vim%20pelo%20diagnóstico%20Ritual%20e%20quero%20saber%20mais." target="_blank" rel="noopener noreferrer"
                    style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(37,211,102,.08)",border:"1px solid rgba(37,211,102,.2)",borderRadius:10,padding:"10px 18px",textDecoration:"none",color:"#25d166",fontSize:12,fontWeight:700}}>
                    <span style={{fontSize:16}}>💬</span> Chamar no WhatsApp
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ════════════════════════════
            S4 — PROVA SOCIAL / NÚMEROS
        ════════════════════════════ */}
        <section style={{ background:"linear-gradient(135deg,rgba(255,92,26,.06),rgba(212,175,55,.03))", borderTop:"1px solid rgba(255,255,255,.04)", borderBottom:"1px solid rgba(255,255,255,.04)", padding:"60px 24px" }}>
          <div style={{ maxWidth:900, margin:"0 auto" }}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":isTablet?"repeat(2,1fr)":"repeat(4,1fr)", gap:24 }}>
              {[
                ["+65%","Taxa de retorno médio", "#FF5C1A"],
                ["<48h","Primeira resposta automatizada","#D4AF37"],
                ["R$490",`Mensalidade. ${VT.mensalidade_tag}`,"#10b981"],
                ["30 dias","Garantia. Resultado ou reembolso.","rgba(139,92,246,1)"],
              ].map(([n,l,cor]) => (
                <Reveal key={n}>
                  <div style={{ textAlign:"center", padding:"20px 10px" }}>
                    <div style={{ fontFamily:"'Unbounded',sans-serif", fontSize:isMobile?24:32, fontWeight:900, color:cor, marginBottom:8 }}>{n}</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,.35)", lineHeight:1.6 }}>{l}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════
            S5 — O QUE ESTÁ INCLUSO
        ════════════════════════════ */}
        <section style={{ background:"#0A0A0B", padding:`clamp(60px,8vh,120px) ${isMobile?"16px":isTablet?"32px":"clamp(24px,6vw,80px)"}` }}>
          <div style={{ maxWidth:900, margin:"0 auto" }}>
            <Reveal>
              <div style={{ textAlign:"center", marginBottom:48 }}>
                <div style={{ fontSize:9, color:"rgba(255,92,26,.6)", letterSpacing:3, textTransform:"uppercase", marginBottom:14, fontWeight:700 }}>● O produto</div>
                <h2 style={{ fontFamily:"'Unbounded',sans-serif", fontSize:isMobile?24:36, fontWeight:900, lineHeight:1.05, letterSpacing:"-1px", marginBottom:16 }}>
                  Não é um CRM.<br/><span style={{ color:"#FF5C1A" }}>É um sistema vivo.</span>
                </h2>
                <p style={{ fontSize:14, color:"rgba(240,217,204,.4)", maxWidth:480, margin:"0 auto", lineHeight:1.8 }}>
                  Enquanto você atende, o Ritual trabalha 24h — detectando, comunicando e recuperando.
                </p>
              </div>
            </Reveal>

            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":isTablet?"1fr 1fr":"repeat(3,1fr)", gap:16 }}>
              {[
                ["🤖","Retorno automático","Identifica quem está no ciclo de retorno e manda mensagem personalizada — sem você tocar no celular.","#FF5C1A"],
                ["🧠","Ritual Intelligence","IA monitora padrão de respostas e detecta abandono antes de acontecer.","#8b5cf6"],
                ["📊","Dashboard de resultados","ROI, taxa de retorno, perda estimada, pacientes recuperadas — tudo em tempo real.","#D4AF37"],
                ["📅","Agenda inteligente","Controla ciclos por procedimento. Lembra você e a paciente no momento certo.","#10b981"],
                ["💬","Multi-canal","WhatsApp + e-mail integrados. A paciente responde onde ela quiser.","#06b6d4"],
                ["🔒","Isolamento de dados","Cada clínica tem ambiente isolado. Seus dados são seus.","rgba(255,255,255,.5)"],
              ].map(([ic,t,d,cor]) => (
                <Reveal key={t} delay={0.1}>
                  <div style={{ background:"#131314", border:"1px solid rgba(255,255,255,.06)", borderRadius:16, padding:"20px", height:"100%", transition:"border-color .2s" }}
                    onMouseOver={e=>e.currentTarget.style.borderColor=`${cor}40`}
                    onMouseOut={e=>e.currentTarget.style.borderColor="rgba(255,255,255,.06)"}>
                    <div style={{ fontSize:28, marginBottom:12 }}>{ic}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#f0d9cc", marginBottom:8 }}>{t}</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,.35)", lineHeight:1.7 }}>{d}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════
            S6 — CTA FINAL + URGÊNCIA
        ════════════════════════════ */}
        <section style={{ background:"#0e0a12", padding:`clamp(60px,8vh,120px) ${isMobile?"16px":isTablet?"32px":"clamp(24px,6vw,80px)"}` }}>
          <div style={{ maxWidth:560, margin:"0 auto", textAlign:"center" }}>
            <Reveal>
              <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(239,68,68,.06)", border:"1px solid rgba(239,68,68,.2)", borderRadius:40, padding:"6px 18px", marginBottom:24 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#ef4444", animation:"pulse_d 1.5s infinite" }}/>
                <span style={{ fontSize:10, color:"#ef4444", fontWeight:700 }}>Apenas {vagas} demonstrações disponíveis esta semana</span>
              </div>

              <h2 style={{ fontFamily:"'Unbounded',sans-serif", fontSize:isMobile?26:40, fontWeight:900, lineHeight:1.0, letterSpacing:"-1.5px", marginBottom:20 }}>
                Cada mês sem o Ritual<br/><span style={{ color:"#ef4444" }}>é dinheiro que não volta.</span>
              </h2>

              <p style={{ fontSize:14, color:"rgba(240,217,204,.45)", lineHeight:1.8, marginBottom:36 }}>
                Setup único de R$4.800. Mensalidade R$490/mês. Uma paciente de retorno paga o sistema.
              </p>

              <button onClick={()=>{ setStep(step===0?1:step); topRef.current?.scrollIntoView({behavior:"smooth"}); }}
                style={{ background:"linear-gradient(135deg,#FF5C1A,#da4600)", border:"none", borderRadius:14, padding:"18px 48px", cursor:"pointer", color:"white", fontSize:16, fontWeight:900, fontFamily:"'Unbounded',sans-serif", letterSpacing:"-0.5px", boxShadow:"0 12px 50px rgba(255,92,26,.4)", marginBottom:16 }}>
                Quero minha demonstração →
              </button>

              <div style={{ fontSize:11, color:"rgba(255,255,255,.25)" }}>
                30 minutos ao vivo · Sem compromisso · Garantia 30 dias
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── SOCIAL PROOF STRIP ── */}
        <div style={{ background:"rgba(16,185,129,.04)", borderTop:"1px solid rgba(16,185,129,.1)", borderBottom:"1px solid rgba(16,185,129,.1)", padding:"14px 24px", overflow:"hidden" }}>
          <div style={{ display:"flex", gap:32, animation:"ticker 18s linear infinite", whiteSpace:"nowrap" }}>
            {[...Array(3)].map((_,gi)=>(
              <div key={gi} style={{ display:"flex", gap:32, flexShrink:0 }}>
                {["Dra. Camila — Floripa","Dra. Rafaela — SP","Dra. Letícia — BH","Dra. Marina — Curitiba","Dra. Ana — Joinville","Dra. Juliana — Porto Alegre"].map((n,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:"#10b981" }}/>
                    <span style={{ fontSize:11, color:"rgba(255,255,255,.35)" }}>{n} <span style={{ color:"#10b981", fontWeight:700 }}>agendou agora</span></span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer style={{ background:"#0A0A0B", borderTop:"1px solid rgba(255,255,255,.04)", padding:"28px 24px", textAlign:"center" }}>
          <div style={{ fontFamily:"'Unbounded',sans-serif", fontSize:12, fontWeight:900, color:"rgba(255,255,255,.2)", marginBottom:6 }}>RITUAL<span style={{ color:"#FF5C1A33" }}>·</span></div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,.15)" }}>{RC.nome_clinica} · Wylvex · Sistema Inteligente de Gestão para Clínicas</div>
        </footer>

      </div>

      {/* ── WhatsApp Float Button ─────────────────────────── */}
      {step < 5 && (
        <a href="https://wa.me/554799138922?text=Oi!%20Vi%20o%20Ritual%20e%20quero%20saber%20mais." target="_blank" rel="noopener noreferrer"
          style={{
            position: 'fixed', bottom: 24, right: 20, zIndex: 300,
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg,#25d166,#128C7E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(37,211,102,.45)',
            animation: 'float 3s ease-in-out infinite',
            textDecoration: 'none',
          }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}

    </>
  );
}