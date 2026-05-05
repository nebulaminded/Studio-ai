import { useState, useRef, useEffect } from "react";

// ── Config — PASTE YOUR STRIPE PRICE IDs HERE ────────────────────────────────
const STRIPE_PRICES = {
  pro:  "price_YOUR_PRO_PRICE_ID",   // ← from Stripe dashboard
  team: "price_YOUR_TEAM_PRICE_ID",  // ← from Stripe dashboard
};

const FREE_AI_USES = 3;

const PLANS = {
  free: { label: "Free",  price: "$0",     color: "#a0a0a0" },
  pro:  { label: "Pro",   price: "$12/mo", color: "#f0c040" },
  team: { label: "Team",  price: "$29/mo", color: "#60d0ff" },
};

const TEMPLATES = [
  { id: 1, label: "Social Post",  w: 1080, h: 1080, bg: "#1a1a2e", accent: "#e94560" },
  { id: 2, label: "Banner",       w: 1200, h: 628,  bg: "#0f3460", accent: "#60d0ff" },
  { id: 3, label: "Story",        w: 1080, h: 1920, bg: "#16213e", accent: "#9b59b6" },
  { id: 4, label: "Poster",       w: 794,  h: 1123, bg: "#2d2d2d", accent: "#f5a623" },
  { id: 5, label: "Logo",         w: 800,  h: 800,  bg: "#fff",    accent: "#111" },
  { id: 6, label: "Presentation", w: 1920, h: 1080, bg: "#111",    accent: "#9b59b6", pro: true },
  { id: 7, label: "Resume",       w: 794,  h: 1123, bg: "#fafafa", accent: "#2c3e50", pro: true },
  { id: 8, label: "Brand Kit",    w: 1200, h: 900,  bg: "#fffbe6", accent: "#e67e22", pro: true },
];

const FONTS = ["Playfair Display","Bebas Neue","Pacifico","Oswald","Lobster","Raleway","Cinzel","Dancing Script"];
const COLORS = ["#fff","#111","#e94560","#f5a623","#9b59b6","#16c79a","#60d0ff","#f0c040","#ff6b6b","#4ecdc4","#45b7d1","#fed330"];

let _id = 1;
const uid = () => `el_${_id++}`;

const defaultText = (x = 140, y = 120) => ({
  id: uid(), type: "text",
  x, y, text: "Double-click to edit",
  font: "Playfair Display", size: 32, color: "#ffffff",
  bold: false, italic: false, w: 320, h: 60,
});

// ── Stripe checkout helper ────────────────────────────────────────────────────
async function startCheckout(plan) {
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const { url, error } = await res.json();
    if (error) throw new Error(error);
    window.location.href = url;
  } catch (e) {
    alert("Checkout error: " + e.message);
  }
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // Check for Stripe redirect result in URL
  const urlParams = new URLSearchParams(window.location.search);
  const stripeSuccess = urlParams.get("success");
  const stripePlan    = urlParams.get("plan");

  const [plan, setPlan]           = useState(stripeSuccess && stripePlan ? stripePlan : "free");
  const [aiUses, setAiUses]       = useState(0);
  const [screen, setScreen]       = useState("home");
  const [template, setTemplate]   = useState(null);
  const [elements, setElements]   = useState([]);
  const [selected, setSelected]   = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [dragging, setDragging]   = useState(null);
  const [aiPrompt, setAiPrompt]   = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult]   = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [notification, setNotification] = useState(null);
  const [bgColor, setBgColor]     = useState("#1a1a2e");
  const [showProModal, setShowProModal] = useState(null);

  const canvasRef  = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Show welcome notification after successful Stripe payment
  useEffect(() => {
    if (stripeSuccess && stripePlan) {
      notify(`🎉 Welcome to ${PLANS[stripePlan]?.label || "Pro"}! Your plan is now active.`, "success");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const isPro = plan !== "free";

  const openTemplate = (t) => {
    if (t.pro && !isPro) { setShowProModal(t); return; }
    setTemplate(t);
    setBgColor(t.bg);
    setElements([{
      ...defaultText(60, 80),
      text: t.label + " Design",
      color: t.accent === "#fff" ? "#111" : "#fff",
      size: 48,
    }]);
    setSelected(null);
    setScreen("editor");
  };

  // ── AI generation ──
  const runAI = async () => {
    if (!aiPrompt.trim()) return;
    if (!isPro && aiUses >= FREE_AI_USES) { setShowUpgrade(true); return; }
    setAiLoading(true);
    setAiResult("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a creative copywriter for a graphic design tool like Canva.
The user gives you a prompt and you return SHORT, punchy, visually-ready text for their design.
Reply with ONLY the copy — headline first, then optional 1-line subtext separated by a newline.
Keep it concise and impactful. No quotes, no explanations.`,
          messages: [{ role: "user", content: aiPrompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "Creative copy here";
      setAiResult(text);
      if (!isPro) setAiUses(u => u + 1);
    } catch (e) {
      setAiResult("Error generating — please try again.");
    }
    setAiLoading(false);
  };

  const addAiText = () => {
    if (!aiResult) return;
    const lines = aiResult.split("\n").filter(Boolean);
    setElements(prev => [...prev, ...lines.map((line, i) => ({
      ...defaultText(60, 80 + i * 70),
      text: line,
      size: i === 0 ? 44 : 24,
      color: "#ffffff",
      font: i === 0 ? "Bebas Neue" : "Raleway",
    }))]);
    setAiResult("");
    setAiPrompt("");
    notify("Text added to canvas ✓", "success");
  };

  // ── Element ops ──
  const addText  = () => { const el = defaultText(60 + Math.random()*80, 80 + Math.random()*80); setElements(p=>[...p, el]); setSelected(el.id); };
  const addShape = (shape) => { const el = { id:uid(), type:"shape", shape, x:100, y:100, w:120, h:120, color: template?.accent||"#e94560" }; setElements(p=>[...p, el]); setSelected(el.id); };
  const updateEl = (id, patch) => setElements(prev => prev.map(e => e.id===id ? {...e,...patch} : e));
  const deleteEl = () => { if (selected) { setElements(p=>p.filter(e=>e.id!==selected)); setSelected(null); } };
  const selEl    = elements.find(e => e.id === selected);

  // ── Drag ──
  const onMouseDown = (e, el) => {
    e.stopPropagation();
    setSelected(el.id);
    const rect = canvasRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left - el.x, y: e.clientY - rect.top - el.y };
    setDragging(el.id);
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      updateEl(dragging, {
        x: e.clientX - rect.left - dragOffset.current.x,
        y: e.clientY - rect.top  - dragOffset.current.y,
      });
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging]);

  const download = () => notify("Export ready! Connect a canvas-to-PNG library for full downloads.", "success");

  // ─────────────────────────────────────────────────────────────
  // HOME
  // ─────────────────────────────────────────────────────────────
  if (screen === "home") return (
    <div style={{minHeight:"100vh",background:"#0b0b0f",color:"#fff",fontFamily:"'Raleway',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;700&family=Bebas+Neue&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Pacifico&family=Oswald:wght@400;700&family=Lobster&family=Cinzel:wght@400;700&family=Dancing+Script:wght@700&display=swap" rel="stylesheet"/>

      {notification && (
        <div style={{position:"fixed",top:20,right:20,background:notification.type==="success"?"#16c79a":"#e94560",color:"#fff",padding:"12px 22px",borderRadius:10,zIndex:9999,fontWeight:700,fontSize:14,boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>
          {notification.msg}
        </div>
      )}

      {/* Nav */}
      <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 40px",borderBottom:"1px solid #1f1f2e",background:"rgba(11,11,15,0.95)",backdropFilter:"blur(10px)",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,background:"linear-gradient(135deg,#e94560,#f5a623)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,fontFamily:"Bebas Neue"}}>S</div>
          <span style={{fontFamily:"Bebas Neue",fontSize:24,letterSpacing:2}}>STUDIO AI</span>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <span style={{fontSize:13,color:"#888"}}>
            {isPro ? `✦ ${PLANS[plan].label} Plan` : `Free · ${FREE_AI_USES - aiUses} AI uses left`}
          </span>
          <button onClick={()=>setScreen("pricing")} style={{background:"transparent",border:"1px solid #333",color:"#aaa",padding:"7px 16px",borderRadius:6,cursor:"pointer",fontSize:13}}>Pricing</button>
          {!isPro && (
            <button onClick={()=>setScreen("pricing")} style={{background:"linear-gradient(135deg,#e94560,#f5a623)",border:"none",color:"#fff",padding:"8px 20px",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:13}}>Upgrade ✦</button>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div style={{textAlign:"center",padding:"80px 20px 40px",position:"relative"}}>
        <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:600,height:300,background:"radial-gradient(ellipse,rgba(233,69,96,0.15),transparent 70%)",pointerEvents:"none"}}/>
        <p style={{fontSize:13,letterSpacing:4,color:"#e94560",textTransform:"uppercase",marginBottom:16}}>AI-Powered Design Tool</p>
        <h1 style={{fontFamily:"Bebas Neue",fontSize:"clamp(52px,8vw,96px)",lineHeight:1,letterSpacing:2,margin:"0 0 20px"}}>
          Design Anything.<br/>
          <span style={{WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundImage:"linear-gradient(90deg,#e94560,#f5a623,#9b59b6)"}}>In Seconds.</span>
        </h1>
        <p style={{color:"#888",fontSize:17,maxWidth:480,margin:"0 auto 36px",lineHeight:1.6}}>Professional designs with AI-generated copy. No experience needed.</p>
        <button onClick={()=>setScreen("editor")} style={{background:"linear-gradient(135deg,#e94560,#f5a623)",border:"none",color:"#fff",padding:"14px 36px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:16,letterSpacing:1}}>
          Start Designing Free →
        </button>
      </div>

      {/* Templates grid */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:"20px 24px 80px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
          <h2 style={{fontFamily:"Playfair Display",fontSize:28,margin:0}}>Templates</h2>
          <span style={{color:"#555",fontSize:13}}>{TEMPLATES.filter(t=>t.pro).length} Pro-only templates</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:16}}>
          {TEMPLATES.map(t => (
            <div key={t.id} onClick={()=>openTemplate(t)}
              style={{borderRadius:12,overflow:"hidden",cursor:"pointer",border:"1px solid #1f1f2e",transition:"transform .2s,border-color .2s",position:"relative"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.borderColor="#e94560"}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.borderColor="#1f1f2e"}}
            >
              {t.pro && <div style={{position:"absolute",top:10,right:10,background:"linear-gradient(135deg,#e94560,#f5a623)",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:4,letterSpacing:1,zIndex:2}}>PRO</div>}
              <div style={{height:140,background:t.bg,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                <div style={{width:"60%",height:8,background:t.accent,opacity:0.7,borderRadius:4}}/>
                <div style={{position:"absolute",bottom:20,left:20,width:"40%",height:5,background:t.accent,opacity:0.4,borderRadius:3}}/>
              </div>
              <div style={{background:"#13131a",padding:"12px 14px"}}>
                <div style={{fontWeight:700,fontSize:14}}>{t.label}</div>
                <div style={{color:"#555",fontSize:12,marginTop:2}}>{t.w}×{t.h}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showProModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"#13131a",border:"1px solid #2a2a3a",borderRadius:16,padding:40,maxWidth:420,textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:12}}>✦</div>
            <h2 style={{fontFamily:"Playfair Display",margin:"0 0 8px"}}>Pro Template</h2>
            <p style={{color:"#888",lineHeight:1.6,marginBottom:28}}>The <strong style={{color:"#fff"}}>{showProModal.label}</strong> template is available on Pro & Team plans.</p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button onClick={()=>setShowProModal(null)} style={{background:"transparent",border:"1px solid #333",color:"#aaa",padding:"10px 20px",borderRadius:8,cursor:"pointer"}}>Maybe later</button>
              <button onClick={()=>{setShowProModal(null);setScreen("pricing")}} style={{background:"linear-gradient(135deg,#e94560,#f5a623)",border:"none",color:"#fff",padding:"10px 24px",borderRadius:8,cursor:"pointer",fontWeight:700}}>See Plans →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // PRICING
  // ─────────────────────────────────────────────────────────────
  if (screen === "pricing") return (
    <div style={{minHeight:"100vh",background:"#0b0b0f",color:"#fff",fontFamily:"'Raleway',sans-serif",padding:"40px 20px"}}>
      <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;700&family=Bebas+Neue&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet"/>
      <button onClick={()=>setScreen("home")} style={{background:"transparent",border:"1px solid #333",color:"#aaa",padding:"8px 16px",borderRadius:6,cursor:"pointer",marginBottom:40,fontSize:13}}>← Back</button>
      <div style={{textAlign:"center",marginBottom:50}}>
        <h1 style={{fontFamily:"Bebas Neue",fontSize:56,letterSpacing:3,margin:"0 0 12px"}}>Choose Your Plan</h1>
        <p style={{color:"#666",fontSize:16}}>Start free. Upgrade when you're ready.</p>
      </div>
      <div style={{display:"flex",gap:20,justifyContent:"center",flexWrap:"wrap",maxWidth:900,margin:"0 auto"}}>
        {Object.entries(PLANS).map(([key, p]) => {
          const active    = plan === key;
          const isPopular = key === "pro";
          return (
            <div key={key} style={{background:active?"rgba(233,69,96,0.08)":"#13131a",border:`2px solid ${active?"#e94560":isPopular?"#333":"#1f1f2e"}`,borderRadius:16,padding:"32px 28px",width:240,position:"relative"}}>
              {isPopular && <div style={{position:"absolute",top:-14,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#e94560,#f5a623)",fontSize:11,fontWeight:700,padding:"4px 14px",borderRadius:20,letterSpacing:1,whiteSpace:"nowrap"}}>MOST POPULAR</div>}
              <div style={{color:p.color,fontSize:13,fontWeight:700,letterSpacing:2,marginBottom:8}}>{p.label.toUpperCase()}</div>
              <div style={{fontFamily:"Bebas Neue",fontSize:48,letterSpacing:1,margin:"8px 0 4px"}}>{p.price}</div>
              <div style={{color:"#555",fontSize:13,marginBottom:24}}>per month</div>
              <ul style={{color:"#999",fontSize:14,listStyle:"none",padding:0,margin:"0 0 28px",lineHeight:2.2}}>
                {key === "free" && <><li>✓ 3 AI uses / day</li><li>✓ 5 templates</li><li>✓ Basic export</li><li style={{color:"#333"}}>✗ Pro templates</li><li style={{color:"#333"}}>✗ Unlimited AI</li></>}
                {key === "pro"  && <><li>✓ Unlimited AI</li><li>✓ All 8 templates</li><li>✓ HD export</li><li>✓ Brand kit</li><li>✓ Remove watermark</li></>}
                {key === "team" && <><li>✓ Everything in Pro</li><li>✓ 10 seats</li><li>✓ Shared brand kit</li><li>✓ Priority support</li><li>✓ Custom fonts</li></>}
              </ul>
              {key === "free" ? (
                <button onClick={()=>{setPlan("free");setScreen("home")}} style={{width:"100%",padding:"12px 0",borderRadius:8,border:"1px solid #333",background:"transparent",color:"#aaa",fontWeight:700,cursor:"pointer",fontSize:14}}>
                  {active ? "✓ Current Plan" : "Use Free"}
                </button>
              ) : (
                <button
                  onClick={() => active ? notify("You're already on this plan!","success") : startCheckout(key)}
                  style={{width:"100%",padding:"12px 0",borderRadius:8,border:`1px solid ${active?"#e94560":"transparent"}`,background:active?"transparent":"linear-gradient(135deg,#e94560,#f5a623)",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:14}}
                >
                  {active ? "✓ Current Plan" : `Upgrade to ${p.label} →`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p style={{textAlign:"center",color:"#333",fontSize:12,marginTop:40}}>Payments securely processed by Stripe. Cancel anytime.</p>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // EDITOR
  // ─────────────────────────────────────────────────────────────
  const canvasW = template?.w || 1080;
  const canvasH = template?.h || 1080;
  const scale   = Math.min(520 / canvasW, 520 / canvasH);

  return (
    <div style={{minHeight:"100vh",background:"#0b0b0f",color:"#fff",fontFamily:"'Raleway',sans-serif",display:"flex",flexDirection:"column"}}>
      <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;700&family=Bebas+Neue&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Pacifico&family=Oswald:wght@400;700&family=Lobster&family=Cinzel:wght@400;700&family=Dancing+Script:wght@700&display=swap" rel="stylesheet"/>

      {showUpgrade && (
        <div style={{background:"linear-gradient(90deg,#e94560,#f5a623)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontWeight:700,fontSize:14}}>✦ You've used all free AI generations. Upgrade for unlimited.</span>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setShowUpgrade(false)} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.4)",color:"#fff",padding:"6px 14px",borderRadius:6,cursor:"pointer",fontSize:13}}>Dismiss</button>
            <button onClick={()=>{setShowUpgrade(false);setScreen("pricing")}} style={{background:"#fff",color:"#e94560",padding:"6px 14px",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:13,border:"none"}}>Upgrade →</button>
          </div>
        </div>
      )}

      {notification && (
        <div style={{position:"fixed",top:20,right:20,background:notification.type==="success"?"#16c79a":"#e94560",color:"#fff",padding:"12px 22px",borderRadius:10,zIndex:9999,fontWeight:700,fontSize:14,boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>
          {notification.msg}
        </div>
      )}

      {/* Top bar */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 20px",borderBottom:"1px solid #1f1f2e",background:"#0f0f14"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setScreen("home")} style={{background:"transparent",border:"none",color:"#666",cursor:"pointer",fontSize:20,padding:0,lineHeight:1}}>←</button>
          <span style={{fontFamily:"Bebas Neue",fontSize:20,letterSpacing:2,color:"#e94560"}}>STUDIO AI</span>
          <span style={{color:"#444",fontSize:13}}>{template?.label || "Blank"} · {canvasW}×{canvasH}</span>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:12,color:"#555"}}>{isPro ? "✦ Pro" : `Free · ${Math.max(0,FREE_AI_USES-aiUses)} AI left`}</span>
          {!isPro && <button onClick={()=>setScreen("pricing")} style={{background:"transparent",border:"1px solid #333",color:"#888",padding:"7px 14px",borderRadius:6,cursor:"pointer",fontSize:12}}>Upgrade ✦</button>}
          <button onClick={download} style={{background:"linear-gradient(135deg,#e94560,#f5a623)",border:"none",color:"#fff",padding:"8px 20px",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:13}}>Export ↓</button>
        </div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Left panel */}
        <div style={{width:224,background:"#0f0f14",borderRight:"1px solid #1a1a28",padding:16,overflowY:"auto",display:"flex",flexDirection:"column",gap:20}}>
          {/* AI */}
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,color:"#e94560",marginBottom:10}}>AI COPY ✦</div>
            <textarea value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="e.g. Summer sale for a luxury jewelry brand" rows={3}
              style={{width:"100%",background:"#1a1a28",border:"1px solid #2a2a3a",borderRadius:8,color:"#fff",padding:"8px 10px",fontSize:12,resize:"none",boxSizing:"border-box",fontFamily:"Raleway"}}/>
            {!isPro && <div style={{fontSize:11,color:"#555",margin:"4px 0"}}>{Math.max(0,FREE_AI_USES-aiUses)}/{FREE_AI_USES} free uses left</div>}
            <button onClick={runAI} disabled={aiLoading}
              style={{width:"100%",background:aiLoading?"#333":"linear-gradient(135deg,#e94560,#f5a623)",border:"none",color:"#fff",padding:"9px 0",borderRadius:7,cursor:aiLoading?"default":"pointer",fontWeight:700,fontSize:13,marginTop:4}}>
              {aiLoading ? "Generating…" : "Generate ✦"}
            </button>
            {aiResult && (
              <div style={{marginTop:10,background:"#1a1a28",border:"1px solid #2a2a3a",borderRadius:8,padding:10}}>
                <div style={{fontSize:12,color:"#ccc",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{aiResult}</div>
                <button onClick={addAiText} style={{width:"100%",background:"#16c79a",border:"none",color:"#fff",padding:"8px 0",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:12,marginTop:8}}>Add to Canvas →</button>
              </div>
            )}
          </div>

          {/* Add elements */}
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,color:"#666",marginBottom:10}}>ELEMENTS</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[["T  Add Text",addText],["▭  Rectangle",()=>addShape("rect")],["○  Circle",()=>addShape("circle")],["—  Line",()=>addShape("line")]].map(([label,fn])=>(
                <button key={label} onClick={fn} style={{background:"#1a1a28",border:"1px solid #2a2a3a",color:"#ccc",padding:"8px 12px",borderRadius:7,cursor:"pointer",fontSize:13,textAlign:"left"}}>{label}</button>
              ))}
            </div>
          </div>

          {/* Background */}
          <div>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,color:"#666",marginBottom:10}}>BACKGROUND</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {COLORS.map(c=>(
                <div key={c} onClick={()=>setBgColor(c)}
                  style={{width:28,height:28,borderRadius:6,background:c,cursor:"pointer",border:bgColor===c?"2px solid #e94560":"2px solid transparent"}}/>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#111118",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(#1f1f2e 1px,transparent 1px)",backgroundSize:"24px 24px",opacity:0.5}}/>
          <div ref={canvasRef} onClick={()=>setSelected(null)}
            style={{position:"relative",width:canvasW*scale,height:canvasH*scale,background:bgColor,borderRadius:4,boxShadow:"0 20px 80px rgba(0,0,0,0.8)",overflow:"hidden",cursor:"default"}}>
            {elements.map(el => {
              const isSel = selected === el.id;
              if (el.type === "text") return (
                <div key={el.id} onMouseDown={e=>onMouseDown(e,el)} onDoubleClick={()=>setEditingId(el.id)}
                  style={{position:"absolute",left:el.x*scale,top:el.y*scale,cursor:"move",outline:isSel?"2px dashed rgba(233,69,96,0.8)":"none",userSelect:"none",minWidth:60}}>
                  {editingId === el.id ? (
                    <input autoFocus value={el.text} onChange={e=>updateEl(el.id,{text:e.target.value})} onBlur={()=>setEditingId(null)}
                      style={{fontFamily:el.font,fontSize:el.size*scale,color:el.color,fontWeight:el.bold?"bold":"normal",fontStyle:el.italic?"italic":"normal",background:"transparent",border:"none",outline:"none",width:el.w*scale}}/>
                  ) : (
                    <div style={{fontFamily:el.font,fontSize:el.size*scale,color:el.color,fontWeight:el.bold?"bold":"normal",fontStyle:el.italic?"italic":"normal",whiteSpace:"nowrap"}}>{el.text}</div>
                  )}
                </div>
              );
              if (el.type === "shape") return (
                <div key={el.id} onMouseDown={e=>onMouseDown(e,el)}
                  style={{position:"absolute",left:el.x*scale,top:el.y*scale,width:el.w*scale,height:el.shape==="line"?3:el.h*scale,cursor:"move",outline:isSel?"2px dashed rgba(233,69,96,0.8)":"none",
                    background:el.shape!=="line"?el.color:"transparent",borderRadius:el.shape==="circle"?"50%":0,borderBottom:el.shape==="line"?`3px solid ${el.color}`:"none"}}/>
              );
              return null;
            })}
          </div>
        </div>

        {/* Right panel */}
        <div style={{width:214,background:"#0f0f14",borderLeft:"1px solid #1a1a28",padding:16,overflowY:"auto"}}>
          {selEl ? (
            <>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:2,color:"#666",marginBottom:14}}>PROPERTIES</div>
              {selEl.type === "text" && <>
                <label style={{fontSize:11,color:"#555",display:"block",marginBottom:4}}>Text</label>
                <input value={selEl.text} onChange={e=>updateEl(selEl.id,{text:e.target.value})}
                  style={{width:"100%",background:"#1a1a28",border:"1px solid #2a2a3a",borderRadius:6,color:"#fff",padding:"6px 8px",fontSize:12,boxSizing:"border-box",fontFamily:"Raleway",marginBottom:10}}/>
                <label style={{fontSize:11,color:"#555",display:"block",marginBottom:4}}>Font</label>
                <select value={selEl.font} onChange={e=>updateEl(selEl.id,{font:e.target.value})}
                  style={{width:"100%",background:"#1a1a28",border:"1px solid #2a2a3a",borderRadius:6,color:"#fff",padding:"6px 8px",fontSize:12,marginBottom:10}}>
                  {FONTS.map(f=><option key={f} value={f}>{f}</option>)}
                </select>
                <label style={{fontSize:11,color:"#555",display:"block",marginBottom:4}}>Size: {selEl.size}px</label>
                <input type="range" min={10} max={120} value={selEl.size} onChange={e=>updateEl(selEl.id,{size:+e.target.value})}
                  style={{width:"100%",marginBottom:10,accentColor:"#e94560"}}/>
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  <button onClick={()=>updateEl(selEl.id,{bold:!selEl.bold})} style={{flex:1,background:selEl.bold?"#e94560":"#1a1a28",border:"1px solid #2a2a3a",color:"#fff",padding:"6px 0",borderRadius:6,cursor:"pointer",fontWeight:700}}>B</button>
                  <button onClick={()=>updateEl(selEl.id,{italic:!selEl.italic})} style={{flex:1,background:selEl.italic?"#e94560":"#1a1a28",border:"1px solid #2a2a3a",color:"#fff",padding:"6px 0",borderRadius:6,cursor:"pointer",fontStyle:"italic"}}>I</button>
                </div>
              </>}
              <label style={{fontSize:11,color:"#555",display:"block",marginBottom:6}}>Color</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
                {COLORS.map(c=>(
                  <div key={c} onClick={()=>updateEl(selEl.id,{color:c})}
                    style={{width:24,height:24,borderRadius:5,background:c,cursor:"pointer",border:selEl.color===c?"2px solid #e94560":"2px solid transparent"}}/>
                ))}
              </div>
              <button onClick={deleteEl} style={{width:"100%",background:"transparent",border:"1px solid #3a1a1a",color:"#e94560",padding:"8px 0",borderRadius:7,cursor:"pointer",fontSize:13,marginTop:6}}>Delete Element</button>
            </>
          ) : (
            <div style={{color:"#444",fontSize:13,lineHeight:1.8,marginTop:20}}>
              Click an element to edit.<br/>Drag to reposition.<br/>Double-click text to edit inline.
            </div>
          )}
          <div style={{marginTop:24}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,color:"#666",marginBottom:10}}>LAYERS</div>
            {elements.length === 0 && <div style={{color:"#333",fontSize:12}}>No elements yet</div>}
            {[...elements].reverse().map(el=>(
              <div key={el.id} onClick={()=>setSelected(el.id)}
                style={{padding:"6px 8px",borderRadius:6,marginBottom:4,cursor:"pointer",fontSize:12,background:selected===el.id?"#1f1f30":"transparent",border:`1px solid ${selected===el.id?"#e94560":"transparent"}`,color:"#aaa"}}>
                {el.type==="text" ? `T  ${el.text.slice(0,18)}` : `◼  ${el.shape}`}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
