"""Procedural, editable Occidental Gothic SVG motion rigs.

Original vector interpretation of concepts, never a bitmap wrapped inside an
SVG. All bodies have separate semantic drawing groups for limbs, body, face,
equipment and phase VFX. Screen-right side view; simulation owns root motion.
"""
import math
from html import escape

INK = "#202731"
WHITE = "#eee3d3"
ACTION_POSES = (
    "idle-a", "idle-b", "run-contact", "run-pass", "jump", "windup",
    "active", "recovery", "guard", "signature", "stagger", "hurt", "defeat",
)
FIELD_POSES = (
    "south-idle", "south-walk", "north-idle", "north-walk",
    "east-idle", "east-walk", "west-idle", "west-walk",
)
WIDTH, HEIGHT, FOOT = 144, 160, (72, 149)
POSE = {
    "idle-a": (0, 0, 0, 0, 0, 0),
    "idle-b": (-2, 0, -3, 2, 1, 0),
    "run-contact": (-2, 1, -28, -9, -4, 0),
    "run-pass": (0, -1, 24, 10, 4, 0),
    "jump": (-13, 2, -16, 18, -4, 0),
    "windup": (2, -1, -38, -55, -8, 1),
    "active": (-3, 2, 65, 66, 10, 2),
    "recovery": (2, 1, 20, 24, 7, 0),
    "guard": (0, -1, -26, 38, -2, 0),
    "signature": (-5, 1, 42, 76, 7, 3),
    "stagger": (5, -2, 42, 13, -13, 4),
    "hurt": (4, -1, 26, -15, -10, 4),
    "defeat": (25, 0, 36, -20, 40, 0),
}

def shift(hex_code, fraction):
    rgb = [int(hex_code[i:i+2], 16) for i in (1, 3, 5)]
    changed = [max(0, min(255, round(n+(255-n)*fraction if fraction >= 0 else n*(1+fraction)))) for n in rgb]
    return "#" + "".join(format(n, "02x") for n in changed)

def attrs(mapping):
    return "".join(" %s=\"%s\"" % (k, escape(str(v), quote=True)) for k,v in mapping.items() if v is not None)

def elem(name, fields, content=None):
    a = attrs(fields)
    return "<%s%s/>" % (name,a) if content is None else "<%s%s>%s</%s>" % (name,a,content,name)

def layer(name, content, **extra):
    return elem("g", {"data-part": name, **extra}, content)

def path(d, fill, stroke=INK, sw=2.5, **extra):
    return elem("path", {"d":d, "fill":fill, "stroke":stroke,
        "stroke-width":sw,"stroke-linejoin":"round","stroke-linecap":"round", **extra})

def line(x1,y1,x2,y2,color,sw=2):
    return path("M%s %s L%s %s" % (x1,y1,x2,y2), "none", color,sw)

def ellipse(cx,cy,rx,ry,fill,stroke="none",sw=2):
    return elem("ellipse",{"cx":cx,"cy":cy,"rx":rx,"ry":ry,"fill":fill,"stroke":stroke,"stroke-width":sw})

def circle(cx,cy,r,fill,stroke="none",sw=2):
    return elem("circle",{"cx":cx,"cy":cy,"r":r,"fill":fill,"stroke":stroke,"stroke-width":sw})

def palette(a):
    col = a["base"]
    return dict(cloth=col,dark=shift(col,-.36),mid=shift(col,.23),
        light=shift(col,.48),accent=a["accent"],accent_dark=shift(a["accent"],-.30),
        skin="#ba9b8c" if a["mark"]=="old-face" else "#c8ac91",paper=WHITE)

def phase(spec,c):
    effect=spec[5]
    if effect==0:return ""
    if effect==1: return layer("telegraph",path("M108 36 L127 45 L117 56","none",c["accent"],3))
    if effect==2:return layer("hit-arc",path("M110 33 Q136 56 128 96","none",c["accent"],5)+
        line(124,44,134,53,c["paper"],2))
    if effect==3:return layer("signature",path("M107 21 Q138 50 119 100","none",c["accent"],5)+
        path("M112 29 Q130 57 112 94","none",c["paper"],2)+circle(121,38,4,c["accent"]))
    return layer("stagger-symbol",line(41,60,31,49,c["accent"],3)+line(49,44,43,33,c["paper"],2))

def gear(a,c):
    t=a["equipment"]; ink=INK; accent=c["accent"]; paper=c["paper"]
    if t in ("empty","none"):return ""
    if t in ("spear","lance","glaive","banner"):
        s=line(0,11,0,-68,c["accent_dark"],4)
        s+=path("M0 -81 L7 -66 L0 -58 L-7 -66 Z" if t=="lance" else
                "M0 -77 L5 -65 L0 -57 L-5 -65 Z", paper,ink,1.7)
        if t=="banner":s+=path("M1 -64 Q23 -66 23 -46 L13 -54 L1 -46 Z",accent,ink,1.8)
        if t=="lance":s+=path("M0 -84 L2 -73 L-2 -73 Z",accent,"none")
        return s
    if t in ("sword","tachi","blade","sickle"):
        s=line(0,11,0,-49,c["accent_dark"],4)
        blade="M0 -46 Q18 -72 32 -58 Q18 -59 12 -39 Z" if t=="sickle" else "M-4 -49 L-1 -84 L4 -89 L4 -48 Z"
        return s+path(blade,paper,ink,1.8)+line(-10,-49,9,-49,accent,2.5)
    if t in ("maul","hammer"):
        return line(0,14,0,-66,c["accent_dark"],5)+path("M-20 -69 L18 -69 L19 -50 L-18 -50 Z",c["mid"],ink,3)+line(-10,-58,10,-58,accent,2)
    if t=="fan":
        s=path("M0 4 Q-9 -25 0 -44 Q18 -39 24 -18 L2 5 Z",paper,ink,2)
        for k in (-5,2,9,16):s+=line(1,2,3+k,-32,c["accent_dark"],1.2)
        return s
    if t in ("ritual","scroll","resonance"):
        return path("M-13 -29 Q0 -33 16 -28 L17 -10 Q0 -13 -12 -9 Z",paper,ink,2)+line(-5,-23,10,-23,c["accent_dark"],1.4)
    if t=="medicine":
        return path("M-7 -25 L7 -25 L6 -18 Q12 -14 10 -3 L-10 -3 Q-12 -15 -6 -19 Z","#9dc0af",ink,2)+path("M-9 -14 L8 -14 L8 -5 L-9 -5 Z",accent,"none")
    if t=="ruler":
        s=path("M-4 -60 L5 -60 L12 12 L2 13 Z",paper,ink,2)
        for v in range(-51,5,8):s+=line(-2,v,5,v-1,c["accent_dark"],1.4)
        return s
    if t=="shield":
        return path("M-11 -49 Q15 -55 22 -39 L16 -13 L2 0 L-12 -16 Z",c["mid"],ink,3)+line(3,-45,3,-9,accent,2)
    if t=="musket":return path("M-6 8 L-6 -58 L-2 -69 L2 -66 L3 -4 L13 8 Z",c["accent_dark"],ink,2)+line(-5,-50,-5,-68,paper,2)
    if t=="chain":
        s=line(0,-8,5,-27,c["accent_dark"],3)
        for i in range(5):s+=ellipse(5+i*2,-28-i*8,3,5,"none",accent,1.8)
        return s+circle(13,-67,10,c["mid"],ink,2.3)
    if t=="parasol":
        return line(0,14,0,-65,c["accent_dark"],4)+path("M-42 -54 Q-22 -87 0 -81 Q25 -86 43 -54 Z",accent,ink,3)+path("M-40 -54 Q0 -64 43 -54","none",paper,1.4)
    if t=="seal":return path("M-12 -31 L12 -31 L15 -10 L-12 -10 Z",accent,ink,2.5)+line(-7,-23,9,-23,paper,1.4)
    if t=="claw":
        return "".join(path("M%d -12 L%d -54 L%d -61 L%d -13 Z" % (i*7,i*7+3,i*7+8,i*7+4),paper,ink,1.6) for i in (-1,0,1))
    return path("M-3 -30 L4 -30 L4 12 L-3 12 Z",accent,ink,2)

def head(a,c,front=False,back=False):
    mark=a["mark"]; clothing=a["outfit"]
    shape=(ellipse(74,45,18,20,c["skin"],INK,2.5) if front or back else
           path("M57 38 Q66 23 83 31 Q94 35 92 51 L86 60 Q69 65 60 54 Z",c["skin"],INK,2.6))
    shape+=path("M69 55 L83 55 L84 67 L68 68 Z",c["skin"],INK,2)
    if not back:
        if front:shape+=circle(67,47,1.9,INK)+circle(82,47,1.9,INK)+path("M68 57 Q74 60 80 57","none",c["dark"],1.7)
        else:shape+=circle(82,46,1.9,INK)+path("M86 47 Q93 44 97 49","none",INK,2)
    if mark in ("masked","helmet","court-hat"):
        if mark=="court-hat":shape+=path("M56 42 L92 42 L96 28 L54 28 Z",c["dark"],INK,2.5)+line(48,39,103,39,c["accent_dark"],4)
        else:shape+=path("M54 38 Q74 17 96 38 L92 51 L56 51 Z",c["dark"],INK,2.6)+path("M57 41 L90 41 L87 47 L61 47 Z",c["accent_dark"],"none")
    elif mark=="old-face":
        shape+=path("M55 40 Q62 25 83 29 Q94 31 94 43 L86 38 L56 45 Z",c["mid"],INK,2.3)
        shape+=path("M64 29 Q72 17 78 22 Q86 16 88 31 Z",c["dark"],INK,1.6)
        if not back:shape+=path("M73 58 Q82 69 88 57","none",c["dark"],2.3)
    elif mark=="long-hair":
        shape+=path("M53 44 Q49 16 76 19 Q104 18 96 51 L94 72 L86 63 L56 71 Z",c["dark"],INK,2.2)
    elif mark=="tied-hair":
        shape+=path("M54 42 Q55 22 75 23 Q98 25 95 46 L87 39 L56 44 Z",INK,"none")+ellipse(93,30,7,6,INK)
    elif mark=="beard":
        shape+=path("M54 40 Q55 22 75 22 Q96 22 95 41 L87 37 L60 41 Z",INK,"none")
        if not back:shape+=path("M70 55 Q80 65 89 54 L85 69 L73 64 Z",c["dark"],"none")
    else: shape+=path("M54 41 Q55 22 75 24 Q94 21 96 40 L86 33 L55 45 Z",INK,"none")
    if clothing in ("oni-armor","demon"):
        shape+=path("M54 39 L52 18 L62 32 L76 23 L91 31 L103 11 L99 44 Z",c["dark"],INK,3)
        shape+=path("M58 41 Q76 34 92 42","none",c["accent"],3)
    return layer("face-and-head",shape)

def humanoid(a,c,frame,face="east"):
    pose=POSE[frame]
    bob,step,arms,weapon,tilt,fx=pose
    frontal=face in ("north","south")
    back=face=="north"
    o=a["outfit"]
    armored=o in ("oni-armor","demon","samurai","guardian","soldier","warden")
    left=(-10 if step==1 else 10 if step==-1 else -5 if step==2 else 0)
    right=(10 if step==1 else -10 if step==-1 else 7 if step==2 else 0)
    s=ellipse(72,150,30,3,INK)
    base=""
    # Backing cloak and coat hem.
    cape=""
    if o in ("hunter","courier","priest","court","ronin","archivist","enma","weather","magistrate"):
        cape+=path("M58 66 Q46 72 35 97 L34 135 L48 141 L55 102 L64 90 Z",c["dark"],INK,2.7)
    if o=="hunter":cape+=path("M56 64 L38 89 L47 143 L58 116 L89 122 L111 146 L105 86 L90 66 Z",c["dark"],INK,2.8)
    if o in ("priest","court","magistrate","enma","shroud"):
        cape+=path("M58 98 L94 97 L110 140 Q72 150 39 140 Z",c["dark"],INK,2.5)
    if armored:cape+=path("M51 71 L94 72 L110 96 L102 107 L93 94 L54 95 L45 108 L38 96 Z",c["mid"],INK,3)
    base+=layer("cape",cape)
    # Planted feet and independently articulated gait.
    legs=path("M56 103 L69 104 L%d 128 L%d 144 L%d 144 L%d 126 Z" % (63+left//2,64+left,50+left,52+left),c["dark"],INK,2.8)
    legs+=path("M80 103 L94 102 L%d 127 L%d 144 L%d 144 L%d 127 Z" % (87+right//2,94+right,81+right,79+right),c["mid"],INK,2.8)
    legs+=line(53+left,139,64+left,139,c["accent_dark"],2)+line(82+right,139,94+right,139,c["accent_dark"],2)
    base+=layer("legs",legs)
    # Each arm has its own shoulder pivot.
    back_arm=path("M57 77 Q43 81 44 94 L51 115 L61 109 L54 93 Z",c["dark"],INK,2.8)
    back_arm+=ellipse(54,111,6,7,c["skin"],INK,1.5)
    base+=layer("left-arm",back_arm,transform="rotate(%s 58 78)" % round(-arms*.35,2))
    torso=path("M58 65 Q73 58 91 66 L103 91 L94 112 L55 112 L47 91 Z",c["cloth"],INK,3)
    torso+=path("M67 65 L76 78 L85 66 L90 105 L64 105 Z",c["dark"] if armored else c["mid"],INK,1.7)
    torso+=path("M52 103 Q75 109 99 103 L97 111 L56 113 Z",c["accent_dark"],INK,1.6)
    if armored:
        for yy in (78,86,94):torso+=line(61,yy,94,yy,c["accent_dark"],2.4)
    if o in ("courier","hunter","weather"):torso+=line(57,75,92,102,c["accent"],3.5)
    if o in ("archivist","magistrate"):torso+=path("M62 81 L90 81 L87 102 L65 101 Z",c["paper"],INK,1.8)
    if o=="priest":torso+=line(75,78,75,106,c["paper"],2)
    if o=="healer":torso+=path("M54 90 L99 90 L102 121 L92 126 L87 113 L59 113 L56 125 L49 122 Z",c["mid"],INK,1.7)
    base+=layer("torso",torso)
    base+=layer("neck-and-head",head(a,c,frontal,back),transform="rotate(%s 74 53)" % (8 if frame in ("hurt","stagger") else 0))
    arm=path("M92 75 Q107 74 114 92 L105 109 L96 106 L103 91 L91 90 Z",c["cloth"],INK,2.7)
    arm+=layer("held-equipment",gear(a,c),transform="translate(106 101) rotate(%d)" % weapon)
    arm+=ellipse(106,104,7,7,c["skin"],INK,1.5)
    base+=layer("right-arm",arm,transform="rotate(%s 92 76)" % round(arms*.36,2))
    if o=="guardian":base+=layer("shield-shoulder",path("M44 74 L34 98 L45 117 L57 98 Z",c["mid"],INK,2.8))
    if o=="healer":base+=layer("medicine-bag",path("M88 107 L103 113 L103 135 L87 132 Z",c["accent_dark"],INK,2.1)+line(90,120,100,120,c["paper"],2))
    if o=="enma":base+=layer("wide-sleeve",path("M49 77 Q32 90 32 118 Q45 126 50 110 Z",c["accent"],INK,2))
    if a["group"]=="npc":
        role=a["id"][4:]
        detail=""
        if role in ("courier","trade-broker","post-keeper","port-clerk"):
            detail+=path("M92 108 L103 111 L106 129 L88 128 Z",c["accent_dark"],INK,1.9)
            detail+=line(89,113,103,113,c["paper"],1.5)
        if role=="dock-worker":
            detail+=circle(103,115,11,"none",c["accent"],3)+circle(103,115,5,"none",c["accent"],2)
        if role=="market-seller":
            detail+=path("M91 119 Q100 106 111 119 L109 133 L92 133 Z",c["accent_dark"],INK,1.8)
            detail+=line(96,121,108,121,c["paper"],1.7)
        if role=="ferry-captain":
            detail+=path("M54 39 L96 39 L93 47 L60 47 Z",c["accent"],INK,2.1)
        if role=="print-organizer":
            detail+=path("M91 114 L112 112 L111 128 L92 131 Z",c["paper"],INK,1.7)
            detail+=line(94,119,108,118,c["accent_dark"],1.4)
        if role=="physician":
            detail+=path("M87 114 L103 114 L103 131 L87 131 Z",c["accent_dark"],INK,1.8)
        if role=="net-mender":
            detail+=path("M89 111 L116 111 L109 137 L91 136 Z","none",c["accent"],2)
            for j in range(4):
                detail+=line(92+j*6,111,95+j*4,136,c["paper"],.9)
        if role=="former-retainer":
            detail+=path("M50 85 L59 78 L64 90 L56 99 Z",c["accent_dark"],INK,2)
        if role=="caretaker":
            detail+=path("M88 116 Q103 109 111 118 L109 132 Q96 139 89 127 Z",c["paper"],INK,1.5)
        if detail:base+=layer("civilian-occupation-detail",detail)
    if o=="demon":
        base+=layer("demon-tendrils",path("M36 82 Q12 67 22 49 Q32 75 46 74 M108 84 Q131 71 126 54 Q116 80 105 94","none",c["accent"],6))
    if frame=="defeat":transform="translate(0 13) rotate(47 74 112) scale(.9)"
    else:transform="translate(0 %d) rotate(%d 74 107)" % (bob,tilt)
    body=layer("articulated-humanoid",base,transform=transform)
    return s+body+phase(pose,c)

def quadruped(a,c,frame):
    bob,step,arms,weapon,tilt,fx=POSE[frame]
    k=10 if step==1 else -10 if step==-1 else 0
    rig=a["rig"]
    s=ellipse(72,150,34,3,INK)
    base=path("M42 88 Q26 75 22 59 Q12 52 12 67","none",c["dark"],10)
    if rig=="cat":base=path("M43 89 Q18 57 24 40 Q33 17 31 44 M39 91 Q59 67 43 43","none",c["mid"],8)
    if rig=="baku":base=path("M43 91 Q31 85 20 92","none",c["dark"],7)
    base=layer("tail",base,transform="rotate(%d 42 88)" % (fx*5))
    for i,x in enumerate((51,67,87,103)):
        d=k if i%2 else -k
        leg=path("M%d 101 L%d 101 L%d 129 L%d 145 L%d 145 L%d 126 Z" % (x-6,x+4,x+d//2,x+d+3,x+d-8,x-7),
            c["dark"] if i%2 else c["cloth"],INK,2.5)
        base+=layer("leg-%d"%i,leg)
    base+=layer("body",ellipse(72,88,44 if rig=="behemoth" else 36,30 if rig=="behemoth" else 23,c["cloth"],INK,3)+
        path("M44 76 Q73 57 105 75","none",c["mid"],4))
    if rig=="tanuki":base+=ellipse(72,96,27,20,c["mid"],INK,2)
    if rig=="kappa":base+=layer("shell",ellipse(65,83,27,22,c["accent_dark"],INK,3)+line(50,77,83,77,c["accent"],2))
    if rig=="baku":base+=path("M107 83 Q136 81 132 113 L120 114 L118 98 Z",c["mid"],INK,2.5)
    head=path("M95 75 Q118 61 129 78 L126 103 Q112 111 95 96 Z",c["mid"],INK,3)
    head+=path("M123 83 Q137 86 127 96 Q114 100 112 93 Z",c["accent_dark"],INK,2)
    head+=circle(116,82,3,c["paper"],INK,1.4)
    if rig in ("hound","cat","weasel"):head+=path("M100 79 L96 55 L113 71 L126 57 L124 79 Z",c["dark"],INK,2.8)
    if rig in ("behemoth","chimera"):head+=path("M106 73 L109 47 L118 66 L125 52 L131 80 Z",c["accent"],INK,2.6)
    if rig=="weasel":head+=path("M116 84 Q140 69 135 57","none",c["accent"],5)
    if rig=="tanuki":head+=ellipse(107,87,10,13,c["dark"],INK,1.5)
    if rig=="chimera":head+=path("M58 63 L69 47 L78 63 Z",c["accent"],INK,1.7)
    base+=layer("head",head)
    body=layer("quadruped",base,transform="translate(0 %d) rotate(%s 74 99)" % (bob,round(tilt*.4,1)))
    return s+body+phase(POSE[frame],c)

def winged(a,c,frame):
    bob,step,arms,weapon,tilt,fx=POSE[frame]
    moth=a["rig"]=="moth"
    if moth:
        base=path("M75 84 Q36 28 23 47 Q16 83 56 101 Q30 122 46 129 L79 95 Q104 128 115 115 Q126 98 102 94 Q131 80 118 47 Q108 34 75 84 Z",c["cloth"],INK,3)
        base+=ellipse(75,88,10,34,c["dark"],INK,2)
        base+=circle(49,73,10,c["accent"])+circle(100,73,10,c["accent"])
    else:
        base=path("M61 73 Q37 54 43 39 L57 48 Q68 28 81 45 Q98 28 104 47 L95 64 Q123 83 105 103 Q102 122 81 123 Q57 117 55 105 Q31 94 61 73 Z",c["cloth"],INK,3)
        base+=circle(79,76,14,c["accent_dark"],INK,2.5)+ellipse(83,78,4,5,c["paper"])
    base+=path("M72 58 Q79 44 85 55","none",c["paper"],3)
    s=layer("winged-body",base,transform="translate(0 %s) rotate(%d 75 88)" % (bob*1.8,-10 if step==1 else 10 if step==-1 else 0))
    if frame in ("active","signature"):s+=circle(118,80,12,c["accent"])
    return s+phase(POSE[frame],c)

def spider(a,c,frame):
    bob,step,arms,weapon,tilt,fx=POSE[frame]
    s=""
    for side in (-1,1):
        for i in range(4):
            x=74+side*18;y=76+i*8
            s+=path("M%d %d Q%d %d %d %d" %
              (x,y,74+side*(47+i*3),50+i*7,74+side*(60+i*2),105+i*6+step*6),
              "none",c["dark"] if i%2 else c["accent_dark"],4.2)
    s+=ellipse(75,86,27,26,c["dark"],INK,3)+ellipse(76,75,16,20,c["cloth"],INK,2.5)
    for i in range(4):s+=circle(65+i*7,74+i%2*5,2.5,c["accent"])
    return layer("spider-rig",s,transform="translate(0 %d)"%bob)+phase(POSE[frame],c)

def plant(a,c,frame):
    bob,step,arms,weapon,tilt,fx=POSE[frame];rig=a["rig"]
    s=ellipse(72,146,24,3,c["dark"])
    base=path("M72 145 Q67 114 72 95 Q79 72 72 57","none",c["dark"],12)
    base+=path("M70 122 Q42 97 35 115 Q50 130 70 122 Z M76 107 Q111 79 119 98 Q107 117 77 114 Z",c["mid"],INK,2.1)
    if rig=="bamboo":
        base=path("M67 149 L65 37 L83 37 L83 149 Z",c["cloth"],INK,3)
        for y in range(50,139,18):base+=line(66,y,82,y,c["accent_dark"],3)
        base+=path("M70 57 Q34 30 21 43 Q35 65 69 68 M81 83 Q121 49 129 62 Q114 94 81 96",c["mid"],INK,2.3)
    elif rig=="maw":
        base+=path("M50 66 Q37 39 68 35 Q102 24 113 57 Q125 95 80 100 Q43 94 50 66 Z",c["cloth"],INK,3)
        base+=path("M53 70 Q83 52 107 71 Q82 98 54 79 Z",INK,c["accent"],3)
        for k in range(5):base+=path("M%d 69 l4 11 l-6 -2 Z" % (59+k*9),c["paper"],INK,1)
    else:
        base+=circle(74,60,27 if rig=="blossom" else 21,c["dark"],INK,2)
        petal_count=8 if rig=="lily" else 11
        for i in range(petal_count):
            d=("M0 -5 Q-8 -28 0 -42 Q8 -28 0 -5 Z" if rig=="lily"
               else "M0 -8 Q-11 -25 0 -33 Q11 -25 0 -8 Z")
            base+=layer("petal",path(d,c["accent"],INK,1.5),transform="translate(74 60) rotate(%f)"%(i*360/petal_count))
        base+=circle(74,60,11,c["accent_dark"],INK,2)+circle(74,60,4,c["paper"])
    return s+layer("root-stem-flower",base,transform="rotate(%s 72 145) translate(0 %d)"%(round(tilt*.6+step*4,1),bob))+phase(POSE[frame],c)

def forge(a,c,frame):
    bob,step,arms,weapon,tilt,fx=POSE[frame]
    s=ellipse(73,150,37,3,INK)
    base=path("M47 120 L37 92 L48 66 L99 66 L112 92 L99 122 L92 146 L57 146 Z",c["dark"],INK,4)
    base+=path("M52 78 L95 78 L103 103 L92 125 L55 125 L45 105 Z",c["cloth"],INK,3)
    base+=path("M65 91 Q75 72 86 90 L89 112 L61 112 Z",c["accent"],INK,2.3)
    base+=path("M57 71 L58 46 L65 51 L72 30 L83 52 L89 41 L93 71 Z",c["mid"],INK,3)
    base+=line(48,120,53,142,c["accent_dark"],5)+line(94,120,96,142,c["accent_dark"],5)
    return s+layer("furnace-body",base,transform="translate(0 %d) rotate(%s 74 130)"%(bob,round(tilt*.3,1)))+phase(POSE[frame],c)

def leech(a,c,frame):
    bob,step,arms,weapon,tilt,fx=POSE[frame]
    s=path("M45 109 Q24 80 50 55 Q77 28 103 60 Q131 90 98 117 Q74 139 45 109 Z",c["cloth"],INK,3)
    s+=ellipse(83,78,16,15,c["accent"],INK,2.5)+ellipse(85,77,6,6,INK)
    s+=path("M54 104 Q78 124 104 94","none",c["mid"],4)
    return layer("leech-body",s,transform="translate(0 %d) rotate(%d 75 91)"%(bob*2,tilt))+phase(POSE[frame],c)

def bell(a,c,frame):
    bob,step,arms,weapon,tilt,fx=POSE[frame]
    s=path("M65 18 Q74 11 83 18 L87 38 L99 46 L112 108 L97 133 L49 133 L32 110 L45 46 L61 38 Z",c["dark"],INK,4)
    s+=path("M55 52 Q74 38 95 53 L102 103 Q78 118 45 104 Z",c["cloth"],c["accent_dark"],4)
    s+=ellipse(75,110,29,14,INK,c["accent"],3)
    s+=path("M66 58 L83 58 L92 84 L76 102 L55 82 Z",c["accent"],INK,3)
    s+=circle(74,79,7,c["paper"],INK,2)
    s+=line(40,120,34,145,c["mid"],5)+line(108,120,115,145,c["mid"],5)
    body=layer("bell-and-node-rig",s,transform="translate(0 %d) rotate(%s 75 97)"%(bob,round(tilt*.45,1)))
    if frame in ("active","signature"):body+=ellipse(74,84,40,30,"none",c["accent"],3)
    return body+phase(POSE[frame],c)

def widow(a,c,frame):
    bob,step,arms,weapon,tilt,fx=POSE[frame]
    s=path("M58 50 Q73 28 93 51 L103 105 L119 144 Q79 154 31 146 L48 101 Z",c["cloth"],INK,2.3)
    s+=ellipse(75,47,17,20,c["skin"],INK,2)
    s+=path("M56 43 Q63 18 84 29 Q98 34 95 60 L112 105 Q95 102 86 61 L56 84 Z",c["dark"],INK,2)
    s+=path("M49 78 Q26 97 28 118 M99 78 Q120 104 116 128","none",c["mid"],7)
    s+=circle(82,46,2,c["accent"])
    return layer("widow-rig",s,transform="translate(0 %d) rotate(%s 74 130)"%(round(bob*1.3),round(tilt*.28,1)))+phase(POSE[frame],c)

def draw(a,frame,facing="east"):
    c=palette(a);rig=a["rig"]
    if rig in ("human","oni"):body=humanoid(a,c,frame,facing)
    elif rig in ("hound","chimera","baku","cat","weasel","tanuki","kappa","behemoth"):body=quadruped(a,c,frame)
    elif rig in ("wisp","moth"):body=winged(a,c,frame)
    elif rig=="spider":body=spider(a,c,frame)
    elif rig in ("blossom","bamboo","lily","maw"):body=plant(a,c,frame)
    elif rig=="forge":body=forge(a,c,frame)
    elif rig=="leech":body=leech(a,c,frame)
    elif rig=="bell":body=bell(a,c,frame)
    elif rig=="widow":body=widow(a,c,frame)
    else:raise ValueError("Unknown rig for %s: %s"%(a["id"],rig))
    if facing=="west":return layer("mirrored-west",body,transform="translate(144 0) scale(-1 1)")
    return body
