import fitz, io, json, re
doc = fitz.open("osb.pdf")

COUNTS={1:22,2:25,3:22,4:31,5:23,6:30,7:29,8:28,9:35,10:29,11:10,12:51,13:22,
14:31,15:27,16:36,17:16,18:27,19:25,20:26,21:37,22:30,23:33,24:18,25:40,26:37,
27:21,28:38,29:46,30:38,31:18,32:35,33:23,34:35,35:35,36:39,37:21,38:27,39:23,40:32}

def v1_anchor(ch):
    vl=[l for l in doc[188+ch].get_links() if l.get('kind')==1 and 'to' in l and l.get('page',0)>=229]
    vl.sort(key=lambda l:(round(l['from'].y0/5), l['from'].x0)); l=vl[0]
    return (l['page'], l['to'].x, l['to'].y)
anch={ch:v1_anchor(ch) for ch in range(1,41)}

# FILTERED reading-order span list (drop page-number + tiny spans) — keep flags/font.
# Dict block order = reading order for all prose pages; poetry (ch15) handled separately.
spans=[]
for p in range(230,304):
    for b in doc[p].get_text("dict")["blocks"]:
        for ln in b.get("lines",[]):
            for s in ln["spans"]:
                if s["size"]>=20 or s["size"]<10: continue
                if s["text"]=="": continue
                spans.append({"font":s["font"],"flags":s["flags"],"x":s["bbox"][0],
                              "y0":s["bbox"][1],"y1":s["bbox"][3],"t":s["text"],"p":p})

def start_idx(a):
    # link 'to' point marks the TOP-LEFT of the target line; match on y0 (weighted) then x.
    pg,ax,ay=a; best=None
    for i,sp in enumerate(spans):
        if sp["p"]!=pg: continue
        sc=abs(sp["y0"]-ay)*5 + abs(sp["x"]-ax)
        if best is None or sc<best[0]: best=(sc,i)
    return best[1]
IDX={ch:start_idx(anch[ch]) for ch in range(1,41)}; IDX[41]=len(spans)

NOTE=set("†ω")
EMB={n:re.compile(r'(?<!\d)'+str(n)+r'(?=[A-Za-z“‘"(])') for n in range(2,60)}

def parse_chapter(ch):
    maxv=COUNTS[ch]
    verses={1:[]}; headings={}; curv=1; mode="scripture"
    for sp in spans[IDX[ch]:IDX[ch+1]]:
        t=sp["t"]
        if sp["font"]=="Georgia-Bold":
            letters=re.sub(r'[^A-Za-z]','',t.replace(' ',''))
            if letters and letters==letters.upper() and len(letters)>1:
                mode="article"
            elif len(letters)>1:
                headings[curv]=t.strip()
            continue
        if bool(sp["flags"] & 1):                 # superscript span
            ts=t.strip()
            if ts.isdigit():
                n=int(ts)
                if n==curv+1 and curv+1<=maxv:
                    curv=n; verses[curv]=[]; mode="scripture"
                continue
            if ts=="" or all(c in NOTE for c in ts):
                continue
            # else fall through as body text
        # standalone numeric span == next verse (poetry layout: "2", "3" as own spans)
        if t.strip().isdigit() and int(t.strip())==curv+1 and curv+1<=maxv:
            curv+=1; verses[curv]=[]; mode="scripture"; continue
        # body text: scan for embedded sequential markers; works in either mode
        rem=t
        while curv+1<=maxv:
            m=EMB[curv+1].search(rem)
            if not m: break
            if mode=="scripture": verses[curv].append(rem[:m.start()])
            curv+=1; verses[curv]=[]; mode="scripture"
            rem=rem[m.end():]
        if mode=="scripture": verses[curv].append(rem)
    out={}
    for v in range(1,maxv+1):
        txt=" ".join(verses.get(v,[]))
        txt=txt.replace("†","").replace("ω","")     # strip any glued note markers
        txt=re.sub(r'\s+',' ',txt).strip()
        txt=re.sub(r'\s+([,;:.!?”’])',r'\1',txt)
        out[v]=txt
    return out, headings

def parse_ch15():
    # Song of the Sea: dict block order is scrambled; flat get_text() is correctly ordered.
    flat=doc[254].get_text()+"\n"+doc[255].get_text()+"\n"+doc[256].get_text()
    flat=flat.replace("†","").replace("ω","")
    # window: from v1 opening to start of ch16 (bound at the ch16 heading if present)
    i0=flat.find("Now Moses and the children of Israel sang")
    cands=[flat.find("Manna and Quail"), flat.find("Now they journeyed from Elim")]
    cands=[c for c in cands if c>i0]
    i1=min(cands) if cands else len(flat)
    flat=flat[i0:i1]
    # drop inline section headings
    for h in ["The Song of Miriam","Bitter Waters Sweetened"]:
        flat=flat.replace(h,"\n")
    flat=re.sub(r'[ \t]*\n[ \t]*',' ',flat)
    maxv=COUNTS[15]; out={}; pos=0; curv=1
    for nv in range(2,maxv+1):
        # poetry: "2 The" (space+capital);  prose: "19For"/"26and" (glued, any case)
        m=re.compile(r'(?<!\d)'+str(nv)+r'(?:(?= [“"‘]?[A-Z])|(?=[A-Za-z“"‘]))').search(flat,pos)
        if not m:
            out[curv]=flat[pos:].strip(); pos=len(flat); curv=nv; continue
        out[curv]=flat[pos:m.start()].strip(); pos=m.end(); curv=nv
    out[curv]=flat[pos:].strip()
    for v in out:
        t=re.sub(r'\s+',' ',out[v]).strip()
        # strip stray cross-ref digits (all real ch15 numbers are spelled out)
        t=re.sub(r'(?<=[A-Za-z,;])\s+\d+\s+(?=[A-Za-z])',' ',t)
        out[v]=re.sub(r'\s+',' ',t).strip()
    return out,{}

REQ=list(range(1,21))+[32,33,34,38,39,40]
result={"book":"Exodus",
        "translation":"Orthodox Study Bible — St. Athanasius Academy Septuagint (SAAS)",
        "attribution":"Scripture from The Orthodox Study Bible, © St. Athanasius Academy of Orthodox Theology. Used under fair use for non-commercial study.",
        "versification":"Septuagint (LXX)","verses":{},"headings":{}}
allpass=True; report=[]
for ch in REQ:
    vs,hd=parse_ch15() if ch==15 else parse_chapter(ch)
    empties=[v for v in vs if not vs[v]]
    ok=(len(vs)==COUNTS[ch]) and not empties
    allpass=allpass and ok
    report.append(f"ch{ch:2d}: {len(vs)}/{COUNTS[ch]} {'PASS' if ok else 'FAIL '+str(empties)}")
    for v in range(1,COUNTS[ch]+1): result["verses"][f"{ch}:{v}"]=vs[v]
    for v,h in hd.items(): result["headings"][f"{ch}:{v}"]=h

io.open("exodus_out/exodus-verses.json","w",encoding="utf-8").write(json.dumps(result,ensure_ascii=False,indent=1))
print("\n".join(report)); print("ALL PASS:",allpass,"| total verses:",len(result["verses"]))

# boundary sanity: v1 should start capital/quote; last verse should end with . ? ! ” ’
print("\n--- boundary diagnostics ---")
for ch in REQ:
    v1=result["verses"][f"{ch}:1"]; last=result["verses"][f"{ch}:{COUNTS[ch]}"]
    flags=[]
    if v1 and not re.match(r'[“‘"A-Z(]', v1): flags.append(f"v1 starts: {v1[:30]!r}")
    if last and last.rstrip()[-1] not in '.?!”’"': flags.append(f"vLast ends: ...{last[-30:]!r}")
    if flags: print(f"  ch{ch}: "+" | ".join(flags))
