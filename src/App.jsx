import { useState, useEffect, useRef } from 'react';

const SB_URL = "https://ncqsuxqxujyfekjbgzch.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcXN1eHF4dWp5ZmVramJnemNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM3MDczMjYsImV4cCI6MjA1OTI4MzMyNn0.xgwXSHE8dijOa7dtnzZ-CEG1_sP6L3yFvp3JYJ7LE3w";
const HUB = "https://wylvex-backend-production.up.railway.app";

async function sbInsert(table, data) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method:"POST",
      headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, "Content-Type":"application/json", Prefer:"return=representation" },
      body: JSON.stringify(data),
    });
    if(!r.ok){ console.error("[sbInsert]", r.status); return false; }
    return true;
  } catch(e){ console.error("[sbInsert]", e.message); return false; }
}

async function sbQuery(table, query) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}${query}`, {
      headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}` }
    });
    if(!r.ok) return [];
    return await r.json();
  } catch { return []; }
}

function san(s){ return (s||"").replace(/<[^>]*>/g,"").trim().slice(0,200); }
function fbTrack(e,d){try{window.fbq&&window.fbq("track",e,d||{});}catch{}}

function gerarSlots(){
  const slots=[];const now=new Date();
  const HORAS=["09:00","10:00","11:00","13:00","14:00","15:00"];
  const MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const DIAS=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  for(let d=1;d<=7;d++){
    const date=new Date(now);date.setDate(now.getDate()+d);
    const dow=date.getDay();if(dow===0)continue;
    for(const h of HORAS){
      slots.push({dateStr:date.toISOString().slice(0,10),hora:h,dia:DIAS[dow],diaNum:date.getDate(),mes:MESES[date.getMonth()]});
    }
  }
  return slots;
}

function Agendador({leadData}){
  const todos=gerarSlots();
  const [diasUniq]=useState(()=>{const s=new Set();return todos.filter(t=>{if(s.has(t.dateStr))return false;s.add(t.dateStr);return true;});});
  const [diaSel,setDiaSel]=useState(diasUniq[0]?.dateStr||"");
  const [horaSel,setHoraSel]=useState("");
  const [bloq,setBloq]=useState({});
  const [status,setStatus]=useState("idle");

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
    const slot=todos.find(s=>s.dateStr===diaSel&&s.hora===horaSel);
    const diaLabel=`${slot?.dia}, ${slot?.diaNum} de ${slot?.mes}`;
    await sbInsert("reunioes",{
      clinica_id:"wylvex",nome:leadData?.nome||"",clinica:leadData?.clinica||"",
      whatsapp:leadData?.whatsapp||"",data:diaSel,hora:horaSel,dia:diaLabel,
      score:leadData?.score||0,perda:leadData?.perda||0,status:"agendada",origem:"lp",
    });
    fetch(`${HUB}/api/confirm-lead`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({phone:"55"+((leadData?.whatsapp||"").replace(/\D/g,"")),
        nome:leadData?.nome,clinica:leadData?.clinica,perda:leadData?.perda,data:diaLabel,hora:horaSel}),
    }).catch(()=>{});
    fbTrack("Schedule",{content_name:"Demo Ritual"});
    setStatus("done");
  };

  const diaObj=diasUniq.find(d=>d.dateStr===diaSel);
  const horasDoDia=diaSel?todos.filter(s=>s.dateStr===diaSel&&!bloq[s.hora]):[];

  if(status==="done")return(
    <div style={{background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.2)",borderRadius:16,padding:"28px 22px",textAlign:"center"}}>
      <div style={{fontSize:40,marginBottom:12}}>✅</div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#f0d9cc",marginBottom:8}}>Demonstração confirmada!</div>
      <div style={{fontSize:15,color:"#10b981",fontWeight:600,marginBottom:8}}>{diaObj?.dia}, {diaObj?.diaNum} de {diaObj?.mes} · {horaSel}</div>
      <div style={{fontSize:12,color:"rgba(255,255,255,.35)",lineHeight:1.7}}>Você vai receber uma confirmação pelo WhatsApp.</div>
    </div>
  );

  return(
    <div>
      <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:6,marginBottom:12,scrollbarWidth:"none"}}>
        {diasUniq.map(d=>{
          const sel=diaSel===d.dateStr;
          return(
            <button key={d.dateStr} onClick={()=>{setDiaSel(d.dateStr);setHoraSel("");}}
              style={{flexShrink:0,background:sel?"rgba(201,149,108,.12)":"rgba(255,255,255,.03)",border:`1.5px solid ${sel?"rgba(201,149,108,.4)":"rgba(255,255,255,.07)"}`,borderRadius:10,padding:"9px 14px",cursor:"pointer",textAlign:"center",minWidth:58,WebkitTapHighlightColor:"transparent"}}>
              <div style={{fontSize:9,color:sel?"#c9956c":"rgba(255,255,255,.4)",letterSpacing:1}}>{d.dia}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:sel?"#c9956c":"rgba(255,255,255,.7)"}}>{d.diaNum}</div>
            </button>
          );
        })}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:14}}>
        {horasDoDia.map(s=>{
          const sel=horaSel===s.hora;
          return(
            <button key={s.hora} onClick={()=>setHoraSel(s.hora)}
              style={{background:sel?"rgba(201,149,108,.12)":"rgba(255,255,255,.03)",border:`1.5px solid ${sel?"rgba(201,149,108,.4)":"rgba(255,255,255,.07)"}`,borderRadius:9,padding:"11px 6px",cursor:"pointer",fontSize:13,fontWeight:sel?700:400,color:sel?"#c9956c":"rgba(255,255,255,.55)",WebkitTapHighlightColor:"transparent"}}>
              {s.hora}
            </button>
          );
        })}
      </div>
      <button onClick={confirmar} disabled={!horaSel||status==="loading"}
        style={{width:"100%",background:horaSel?"linear-gradient(135deg,#c9956c,#b8845b)":"rgba(255,255,255,.04)",border:`1px solid ${horaSel?"transparent":"rgba(255,255,255,.08)"}`,color:horaSel?"white":"rgba(255,255,255,.3)",borderRadius:10,padding:"15px",cursor:horaSel?"pointer":"not-allowed",fontSize:14,fontWeight:700,transition:"all .2s",WebkitTapHighlightColor:"transparent"}}>
        {status==="loading"?"Confirmando...":horaSel?`Confirmar · ${horaSel} →`:"Selecione um horário"}
      </button>
    </div>
  );
}

const G = `
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{overflow-x:hidden;-webkit-overflow-scrolling:touch;background:#080407}
  button,input,textarea{-webkit-appearance:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
  input,textarea,select{font-size:max(16px,1em)!important}
  input::placeholder{color:rgba(240,217,204,.2)!important}
  input:focus{outline:none;border-color:rgba(201,149,108,.5)!important;background:rgba(201,149,108,.04)!important}
  ::-webkit-scrollbar{width:2px}::-webkit-scrollbar-thumb{background:rgba(201,149,108,.2)}
  @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes pulse{0%,100%{opacity:.3;transform:scale(.95)}50%{opacity:.7;transform:scale(1.05)}}
  @keyframes countUp{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
  @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
  .shim{background:linear-gradient(90deg,#c9956c 0%,#f0d9cc 30%,#fff8f0 50%,#f0d9cc 70%,#c9956c 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 3s linear infinite}
  @media(min-width:540px){.lp-wrap{max-width:520px!important;padding:0 28px!important}}
  @media(min-width:900px){.lp-wrap{max-width:640px!important}.hero-hl{font-size:58px!important}.section-pad{padding:72px 0!important}}
`;

export default function App(){
  const [fase,setFase]=useState("hero");
  const [step,setStep]=useState(0);
  const [res,setRes]=useState({});
  const [form,setForm]=useState({nome:"",clinica:"",whatsapp:"",email:""});
  const [loading,setLoading]=useState(false);
  const [savedLead,setSavedLead]=useState(null);
  const [count,setCount]=useState(0);
  const topo=useRef(null);

  useEffect(()=>{
    fbTrack("ViewContent",{content_name:"LP Ritual"});
    // Animates the counter stat
    let v=0;const target=18;const iv=setInterval(()=>{v+=1;setCount(v);if(v>=target)clearInterval(iv);},60);
    return()=>clearInterval(iv);
  },[]);

  const perda=Math.round((res.pacientes||20)*(
    res.ticket==="Até R$500"?400:res.ticket==="R$500–1.000"?750:res.ticket==="R$1.000–2.000"?1500:2500
  )*0.18);

  const ETAPAS=[
    {id:"pacientes",tipo:"slider",titulo:"Quantas pacientes você atende por mês?",sub:"Calculamos exatamente quanto você está perdendo."},
    {id:"ticket",tipo:"cards",titulo:"Qual o ticket médio por procedimento?",sub:"Toxina, preenchimento, bioestimulador...",
      ops:[{ic:"💉",l:"Até R$500"},{ic:"💎",l:"R$500–1.000"},{ic:"✨",l:"R$1.000–2.000"},{ic:"👑",l:"Acima de R$2.000"}]},
    {id:"dor",tipo:"cards",titulo:"O que mais trava hoje?",sub:"A resposta que mais dói.",
      ops:[{ic:"👻",l:"Pacientes somem sem retornar"},{ic:"📱",l:"Dependente de indicação"},{ic:"⏰",l:"Sem tempo para follow-up"},{ic:"📉",l:"Agenda com buracos toda semana"}]},
    {id:"contato",tipo:"form",titulo:"Quase lá.",sub:"Para onde enviamos seu diagnóstico?"},
  ];

  const etapa=ETAPAS[step];

  const goNext=(val,campo)=>{
    if(campo)setRes(p=>({...p,[campo]:val}));
    if(step<ETAPAS.length-1)setStep(s=>s+1);
  };

  const submit=async()=>{
    if(!form.nome.trim()||form.whatsapp.replace(/\D/g,"").length<10)return;
    setLoading(true);
    const dados={...res,...form,nome:san(form.nome),clinica:san(form.clinica),whatsapp:san(form.whatsapp),
      perda,score:Math.min(95,70+(perda>5000?15:5)+(res.dor?10:0)),clinica_id:"wylvex",origem:"lp"};
    await sbInsert("leads",dados);
    setSavedLead(dados);
    // Zap enviado apenas após confirmar o horário (evita mensagem dupla)
    if(dados.email){
      fetch(`${HUB}/api/confirm-email`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({to:dados.email,nome:dados.nome,perda,clinica:dados.clinica}),
      }).catch(()=>{});
    }
    fbTrack("Lead",{content_name:"Diagnóstico Ritual",currency:"BRL",value:0});
    setLoading(false);setFase("resultado");
    setTimeout(()=>topo.current?.scrollIntoView({behavior:"smooth"}),100);
  };

  const S={
    page:{fontFamily:"'Plus Jakarta Sans',sans-serif",background:"#080407",color:"#e8d8cc",minHeight:"100vh"},
    wrap:{maxWidth:460,margin:"0 auto",padding:"0 20px"},
    btn:{background:"linear-gradient(135deg,#c9956c,#b8845b)",border:"none",color:"white",borderRadius:10,padding:"15px 24px",fontSize:15,fontWeight:700,cursor:"pointer",width:"100%",letterSpacing:.3},
    inp:{background:"rgba(255,255,255,.04)",border:"1.5px solid rgba(255,255,255,.08)",color:"#f0d9cc",padding:"14px",borderRadius:10,fontSize:14,width:"100%",fontFamily:"'Plus Jakarta Sans',sans-serif",marginBottom:10,display:"block"},
  };

  /* ── HERO ── */
  if(fase==="hero")return(
    <div ref={topo} style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{G}</style>

      {/* TOP BAR */}
      <div style={{borderBottom:"1px solid rgba(255,255,255,.04)",padding:"18px 20px",display:"flex",justifyContent:"center"}}>
        <div style={{textAlign:"center"}}>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontStyle:"italic",color:"rgba(240,217,204,.7)",letterSpacing:3}}>ritual</span>
          <span style={{fontSize:9,color:"rgba(201,149,108,.35)",letterSpacing:3,textTransform:"uppercase",marginLeft:8}}>by wylvex</span>
        </div>
      </div>

      {/* HERO */}
      <div className="lp-wrap" style={{...S.wrap,paddingTop:52,paddingBottom:56}}>

        {/* Badge */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:28}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(201,149,108,.07)",border:"1px solid rgba(201,149,108,.2)",borderRadius:40,padding:"6px 16px"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:"#c9956c",animation:"pulse 2s infinite"}}/>
            <span style={{fontSize:10,color:"rgba(201,149,108,.7)",letterSpacing:3,textTransform:"uppercase"}}>gestão de retorno · harmonização</span>
          </div>
        </div>

        {/* Headline */}
        <div style={{textAlign:"center",marginBottom:28,animation:"fadeUp .7s ease both"}}>
          <h1 className="hero-hl" style={{fontFamily:"'Cormorant Garamond',serif",fontSize:44,fontWeight:700,lineHeight:1.05,color:"rgba(240,217,204,.95)",marginBottom:18,letterSpacing:-1}}>
            Sua clínica está<br/>
            <span className="shim" style={{fontStyle:"italic"}}>perdendo pacientes</span><br/>
            toda semana.
          </h1>
          <p style={{fontSize:15,color:"rgba(255,255,255,.38)",lineHeight:1.8,fontWeight:300}}>
            Não porque ficaram insatisfeitas.<br/>
            <strong style={{color:"rgba(255,255,255,.6)",fontWeight:500}}>Porque ninguém lembrou delas.</strong>
          </p>
        </div>

        {/* Big animated stat */}
        <div style={{textAlign:"center",marginBottom:32,animation:"fadeUp .7s .1s ease both"}}>
          <div style={{background:"rgba(201,149,108,.04)",border:"1px solid rgba(201,149,108,.12)",borderRadius:16,padding:"24px 20px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#c9956c,transparent)"}}/>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:80,fontWeight:700,color:"#c9956c",fontStyle:"italic",lineHeight:.9,marginBottom:8,animation:"countUp .8s ease both"}}>{count}%</div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.45)",lineHeight:1.6}}>das suas pacientes <strong style={{color:"rgba(255,255,255,.7)"}}>somem em silêncio</strong> todo mês</div>
          </div>
        </div>

        {/* Secondary stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:32,animation:"fadeUp .7s .15s ease both"}}>
          {[["65%","voltam quando lembradas"],["30 dias","garantia ou devolução"]].map(([v,l])=>(
            <div key={l} style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:"16px 14px",textAlign:"center"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:700,color:"#c9956c",fontStyle:"italic"}}>{v}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:4,lineHeight:1.4}}>{l}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{animation:"fadeUp .7s .2s ease both"}}>
          <button style={S.btn} onClick={()=>{setFase("form");fbTrack("ViewContent",{content_name:"Diagnóstico"});}}>
            Calcular minha perda mensal →
          </button>
          <p style={{textAlign:"center",marginTop:10,fontSize:11,color:"rgba(255,255,255,.2)"}}>Gratuito · 3 minutos · sem compromisso</p>
        </div>
      </div>

      {/* COMO FUNCIONA */}
      <div className="section-pad" style={{borderTop:"1px solid rgba(255,255,255,.04)",padding:"56px 0"}}>
        <div className="lp-wrap" style={S.wrap}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <p style={{fontSize:9,color:"rgba(201,149,108,.45)",letterSpacing:4,textTransform:"uppercase",marginBottom:10}}>como funciona</p>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:700,color:"rgba(240,217,204,.85)",fontStyle:"italic",lineHeight:1.15}}>O Ritual trabalha enquanto<br/>você atende.</h2>
          </div>
          {/* Timeline */}
          <div style={{position:"relative",paddingLeft:32}}>
            <div style={{position:"absolute",left:9,top:8,bottom:8,width:1,background:"linear-gradient(to bottom,rgba(201,149,108,.4),rgba(201,149,108,.1))"}}/>
            {[
              ["Monitora","Aprende o ciclo de cada paciente automaticamente."],
              ["Identifica","Sabe quem precisa voltar — no momento exato."],
              ["Envia","Mensagem personalizada no WhatsApp. Automático ou 1 clique."],
              ["Aprende","Melhora com cada interação. Fica mais preciso todo dia."],
            ].map(([t,d],i)=>(
              <div key={t} style={{position:"relative",paddingBottom:i<3?28:0,paddingLeft:20}}>
                <div style={{position:"absolute",left:-23,top:4,width:10,height:10,borderRadius:"50%",background:"#c9956c",border:"2px solid rgba(201,149,108,.2)"}}/>
                <div style={{fontSize:14,fontWeight:700,color:"#f0d9cc",marginBottom:4}}>{t}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.38)",lineHeight:1.6}}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ANTES VS DEPOIS */}
      <div className="section-pad" style={{borderTop:"1px solid rgba(255,255,255,.04)",padding:"56px 0",background:"linear-gradient(180deg,rgba(201,149,108,.02) 0%,transparent 100%)"}}>
        <div className="lp-wrap" style={S.wrap}>
          <div style={{textAlign:"center",marginBottom:28}}>
            <p style={{fontSize:9,color:"rgba(201,149,108,.45)",letterSpacing:4,textTransform:"uppercase",marginBottom:10}}>a diferença</p>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:700,color:"rgba(240,217,204,.85)",fontStyle:"italic"}}>Sem sistema vs. Com Ritual</h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:"rgba(239,68,68,.04)",border:"1px solid rgba(239,68,68,.12)",borderRadius:14,padding:"18px 14px"}}>
              <p style={{fontSize:9,letterSpacing:2,color:"rgba(239,68,68,.45)",textTransform:"uppercase",marginBottom:14}}>Sem sistema</p>
              {["Paciente vai embora","Retorno na memória dela","3 meses: resultado ruindo","Ela foi pra outra clínica"].map(t=>(
                <div key={t} style={{display:"flex",gap:8,marginBottom:9,alignItems:"flex-start"}}>
                  <span style={{color:"rgba(239,68,68,.4)",fontSize:12,marginTop:1}}>✕</span>
                  <span style={{fontSize:12,color:"rgba(255,255,255,.28)",lineHeight:1.5}}>{t}</span>
                </div>
              ))}
            </div>
            <div style={{background:"rgba(16,185,129,.04)",border:"1px solid rgba(16,185,129,.18)",borderRadius:14,padding:"18px 14px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#10b981,transparent)"}}/>
              <p style={{fontSize:9,letterSpacing:2,color:"rgba(16,185,129,.55)",textTransform:"uppercase",marginBottom:14}}>Com Ritual</p>
              {["Sistema monitora ciclo","Mensagem automática certa","Paciente responde, volta","Receita recuperada"].map(t=>(
                <div key={t} style={{display:"flex",gap:8,marginBottom:9,alignItems:"flex-start"}}>
                  <span style={{color:"#10b981",fontSize:12,marginTop:1}}>✓</span>
                  <span style={{fontSize:12,color:"rgba(240,217,204,.6)",lineHeight:1.5}}>{t}</span>
                </div>
              ))}
              <div style={{marginTop:12,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.18)",borderRadius:9,padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,color:"#10b981",fontStyle:"italic"}}>R$ 4.200</div>
                <div style={{fontSize:10,color:"rgba(16,185,129,.5)",marginTop:2}}>recuperados em 45 dias · SP</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PROVA SOCIAL */}
      <div className="section-pad" style={{borderTop:"1px solid rgba(255,255,255,.04)",padding:"56px 0"}}>
        <div className="lp-wrap" style={S.wrap}>
          <div style={{textAlign:"center",marginBottom:28}}>
            <p style={{fontSize:9,color:"rgba(201,149,108,.45)",letterSpacing:4,textTransform:"uppercase",marginBottom:10}}>resultados reais</p>
          </div>
          {[
            {q:'"Sistema avisou. Ela voltou."',r:"R$ 4.200 em 45 dias",s:"Harmonização Facial · SP"},
            {q:'"Primeira semana, 3 retornos automáticos."',r:"R$ 2.700 sem esforço",s:"Clínica estética · RJ"},
            {q:'"Nunca mais perco paciente sem saber."',r:"Pipeline 100% visível",s:"Clínica premium · Curitiba"},
          ].map(({q,r,s})=>(
            <div key={q} style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:"18px 16px",marginBottom:10,borderLeft:"2px solid rgba(201,149,108,.3)"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontStyle:"italic",color:"rgba(240,217,204,.75)",marginBottom:10,lineHeight:1.55}}>{q}</div>
              <div style={{fontSize:14,fontWeight:700,color:"#c9956c",marginBottom:3}}>{r}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.25)"}}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* GARANTIA + CTA FINAL */}
      <div className="section-pad" style={{borderTop:"1px solid rgba(255,255,255,.04)",padding:"56px 0",background:"linear-gradient(180deg,transparent,rgba(201,149,108,.03) 100%)"}}>
        <div className="lp-wrap" style={{...S.wrap,textAlign:"center"}}>
          <div style={{fontSize:52,marginBottom:16}}>🛡️</div>
          <p style={{fontSize:9,color:"rgba(201,149,108,.45)",letterSpacing:4,textTransform:"uppercase",marginBottom:12}}>risco zero</p>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:700,color:"rgba(240,217,204,.9)",fontStyle:"italic",lineHeight:1.1,marginBottom:16}}>
            30 dias.<br/>Resultado ou devolvo.
          </h2>
          <p style={{fontSize:14,color:"rgba(255,255,255,.38)",lineHeight:1.85,marginBottom:28,fontWeight:300}}>
            Se o Ritual não trouxer nenhuma paciente de volta<br/>em 30 dias — <strong style={{color:"#f0d9cc",fontWeight:500}}>devolvo tudo. Sem pergunta.</strong>
          </p>
          <button style={S.btn} onClick={()=>{setFase("form");fbTrack("ViewContent",{content_name:"CTA Garantia"});}}>
            Ver diagnóstico gratuito →
          </button>
          <p style={{marginTop:10,fontSize:11,color:"rgba(255,255,255,.2)"}}>3 minutos · sem compromisso · sem cartão</p>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{borderTop:"1px solid rgba(255,255,255,.04)",padding:"28px 20px",textAlign:"center"}}>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontStyle:"italic",color:"rgba(201,149,108,.25)",marginBottom:5}}>ritual</p>
        <p style={{fontSize:10,color:"rgba(255,255,255,.12)",letterSpacing:2}}>by wylvex · wylvex.tech</p>
      </div>
    </div>
  );

  /* ── FORM ── */
  if(fase==="form")return(
    <div ref={topo} style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{G}</style>
      <div className="lp-wrap" style={{...S.wrap,paddingTop:44,paddingBottom:80}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28}}>
          <button onClick={()=>{if(step>0)setStep(s=>s-1);else setFase("hero");}} style={{background:"none",border:"none",color:"rgba(255,255,255,.3)",cursor:"pointer",fontSize:20,padding:"4px 8px"}}>←</button>
          <div style={{display:"flex",gap:5,flex:1,margin:"0 12px"}}>
            {ETAPAS.map((_,i)=>(
              <div key={i} style={{flex:1,height:3,borderRadius:2,background:i<=step?"#c9956c":"rgba(255,255,255,.06)",transition:"background .3s"}}/>
            ))}
          </div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.25)",whiteSpace:"nowrap"}}>{step+1}/{ETAPAS.length}</div>
        </div>

        <div style={{animation:"fadeUp .4s ease both"}}>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:"#f0d9cc",marginBottom:8,lineHeight:1.2}}>{etapa.titulo}</h2>
          <p style={{fontSize:13,color:"rgba(255,255,255,.35)",marginBottom:24,lineHeight:1.6}}>{etapa.sub}</p>

          {etapa.tipo==="slider"&&(
            <div>
              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:64,fontWeight:700,color:"#c9956c",fontStyle:"italic",lineHeight:1}}>{res.pacientes||20}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginTop:4}}>pacientes/mês</div>
              </div>
              <input type="range" min={5} max={200} value={res.pacientes||20}
                onChange={e=>setRes(p=>({...p,pacientes:+e.target.value}))}
                style={{width:"100%",accentColor:"#c9956c",marginBottom:24,height:4}}/>
              <button style={S.btn} onClick={()=>goNext(res.pacientes||20,"pacientes")}>Continuar →</button>
            </div>
          )}

          {etapa.tipo==="cards"&&(
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              {etapa.ops.map(op=>(
                <button key={op.l} onClick={()=>{setRes(p=>({...p,[etapa.id]:op.v||op.l}));setTimeout(()=>goNext(op.v||op.l,etapa.id),120);}}
                  style={{background:"rgba(255,255,255,.03)",border:"1.5px solid rgba(255,255,255,.08)",borderRadius:11,padding:"15px 16px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12,color:"rgba(240,217,204,.7)",fontSize:14,transition:"border-color .15s"}}>
                  {op.ic&&<span style={{fontSize:22}}>{op.ic}</span>}
                  <span>{op.l}</span>
                </button>
              ))}
            </div>
          )}

          {etapa.tipo==="form"&&(
            <div>
              <div style={{background:"linear-gradient(135deg,rgba(201,149,108,.06),rgba(201,149,108,.03))",border:"1px solid rgba(201,149,108,.15)",borderRadius:14,padding:"18px",marginBottom:22,textAlign:"center"}}>
                <p style={{fontSize:10,color:"rgba(201,149,108,.5)",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Sua perda estimada</p>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:42,fontWeight:700,color:"#c9956c",fontStyle:"italic"}}>
                  R$ {perda.toLocaleString("pt-BR")}<span style={{fontSize:16,color:"rgba(201,149,108,.5)"}}>/mês</span>
                </div>
              </div>
              <input type="text" autoComplete="name" style={S.inp} placeholder="Seu nome" value={form.nome} onChange={e=>setForm(p=>({...p,nome:e.target.value}))}/>
              <input type="text" style={S.inp} placeholder="Nome da clínica" value={form.clinica} onChange={e=>setForm(p=>({...p,clinica:e.target.value}))}/>
              <input type="tel" autoComplete="tel" style={S.inp} placeholder="WhatsApp (com DDD)" value={form.whatsapp} onChange={e=>setForm(p=>({...p,whatsapp:e.target.value}))}/>
              <input type="email" autoComplete="email" style={S.inp} placeholder="Email (opcional)" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/>
              <button style={{...S.btn,opacity:loading?.75:1}} onClick={submit} disabled={loading||!form.nome.trim()||form.whatsapp.replace(/\D/g,"").length<10}>
                {loading?"Calculando...":"Ver diagnóstico e agendar →"}
              </button>
              <p style={{fontSize:10,color:"rgba(255,255,255,.18)",textAlign:"center",marginTop:10,lineHeight:1.6}}>Seus dados são confidenciais. Não compartilhamos com ninguém.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ── RESULTADO ── */
  return(
    <div ref={topo} style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{G}</style>
      <div className="lp-wrap" style={{...S.wrap,paddingTop:44,paddingBottom:80}}>
        <div style={{animation:"fadeUp .5s ease both"}}>
          {/* Logo */}
          <div style={{textAlign:"center",marginBottom:24}}>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontStyle:"italic",color:"rgba(201,149,108,.4)",letterSpacing:3}}>ritual</span>
          </div>
          {/* Perda */}
          <div style={{background:"linear-gradient(135deg,rgba(201,149,108,.07),rgba(201,149,108,.03))",border:"1px solid rgba(201,149,108,.18)",borderRadius:16,padding:"24px 18px",marginBottom:18,textAlign:"center",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#c9956c,transparent)"}}/>
            <p style={{fontSize:10,color:"rgba(201,149,108,.5)",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Perda estimada identificada</p>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:48,fontWeight:700,color:"#c9956c",fontStyle:"italic"}}>
              R$ {perda.toLocaleString("pt-BR")}<span style={{fontSize:18,color:"rgba(201,149,108,.5)"}}>/mês</span>
            </div>
            <p style={{fontSize:12,color:"rgba(255,255,255,.3)",marginTop:6}}>em pacientes que somem antes do retorno</p>
          </div>
          {/* Mensagem */}
          <p style={{fontSize:14,color:"rgba(255,255,255,.45)",lineHeight:1.8,marginBottom:20,textAlign:"center"}}>
            <strong style={{color:"#f0d9cc"}}>{(savedLead?.nome||"").split(" ")[0]}</strong>, nossa equipe entra em contato pelo WhatsApp em breve.<br/>Enquanto isso, reserve um horário:
          </p>
          {/* Agendador */}
          <div style={{marginBottom:24}}>
            <p style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,.5)",marginBottom:12,letterSpacing:.3}}>📅 Agendar demonstração gratuita</p>
            <Agendador leadData={savedLead}/>
          </div>
          {/* Próximos passos */}
          <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:"18px 16px"}}>
            <p style={{fontSize:9,color:"rgba(255,255,255,.22)",letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>O que acontece agora</p>
            {[["📱","WhatsApp em breve","Nossa equipe confirma o horário"],["🎯","Demo de 30min","Ritual ao vivo com dados da sua clínica"],["🛡️","30 dias de garantia","Resultado ou devolução total"]].map(([ic,t,d])=>(
              <div key={t} style={{display:"flex",gap:12,marginBottom:12,alignItems:"flex-start"}}>
                <span style={{fontSize:20,flexShrink:0}}>{ic}</span>
                <div>
                  <p style={{fontSize:13,fontWeight:600,color:"#f0d9cc",marginBottom:2}}>{t}</p>
                  <p style={{fontSize:12,color:"rgba(255,255,255,.28)"}}>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
