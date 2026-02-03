import zipfile
from datetime import datetime
from xml.sax.saxutils import escape

EMU_PER_INCH = 914400

SLIDE_W_IN = 13.333
SLIDE_H_IN = 7.5
SLIDE_W = int(SLIDE_W_IN * EMU_PER_INCH)
SLIDE_H = int(SLIDE_H_IN * EMU_PER_INCH)

# Brand tokens
COLORS = {
    "bg": "F3EFE7",
    "surface": "FFFFFF",
    "surface2": "F7F4EE",
    "surface3": "EFE9E1",
    "ink": "12151A",
    "ink2": "222832",
    "muted": "6D737F",
    "muted2": "9AA3AD",
    "accent": "7B1E2B",
    "accent2": "C2A06A",
    "accent3": "2A6F66",
    "stone900": "1C1917",
    "stone700": "44403C",
    "stone600": "57534E",
    "stone500": "78716C",
    "slate200": "E2E8F0",
    "rose600": "E11D48",
    "emerald600": "059669",
    "amber700": "B45309",
}

FONTS = {
    "display": "Fraunces",
    "body": "Space Grotesk",
    "mono": "SF Mono",
}


def emu(inches):
    return int(inches * EMU_PER_INCH)


def alpha_val(opacity):
    """opacity: 0..1 -> 0..100000"""
    return str(int(opacity * 100000))


def solid_fill(color_hex, opacity=1.0):
    if opacity >= 0.999:
        return f"<a:solidFill><a:srgbClr val=\"{color_hex}\"/></a:solidFill>"
    return (
        f"<a:solidFill><a:srgbClr val=\"{color_hex}\"><a:alpha val=\"{alpha_val(opacity)}\"/></a:srgbClr></a:solidFill>"
    )


def line_xml(color_hex=None, width=12700, opacity=1.0):
    if color_hex is None:
        return "<a:ln><a:noFill/></a:ln>"
    if opacity >= 0.999:
        fill = f"<a:solidFill><a:srgbClr val=\"{color_hex}\"/></a:solidFill>"
    else:
        fill = (
            f"<a:solidFill><a:srgbClr val=\"{color_hex}\"><a:alpha val=\"{alpha_val(opacity)}\"/></a:srgbClr></a:solidFill>"
        )
    return f"<a:ln w=\"{width}\">{fill}</a:ln>"


def effect_shadow(color_hex, opacity=0.12, dist=120000, blur=300000, dir_deg=270):
    # dir in degrees -> 60000 per degree
    dir_val = int(dir_deg * 60000)
    return (
        "<a:effectLst>"
        f"<a:outerShdw dist=\"{dist}\" dir=\"{dir_val}\" blurRad=\"{blur}\" algn=\"ctr\" rotWithShape=\"0\">"
        f"<a:srgbClr val=\"{color_hex}\"><a:alpha val=\"{alpha_val(opacity)}\"/></a:srgbClr>"
        "</a:outerShdw>"
        "</a:effectLst>"
    )


def shape_rect(sp_id, name, x, y, w, h, fill=None, line=None, round_rect=False, shadow=False):
    prst = "roundRect" if round_rect else "rect"
    fill_xml = solid_fill(fill[0], fill[1]) if fill else "<a:noFill/>"
    line_part = line_xml(line[0], line[1], line[2]) if line else "<a:ln><a:noFill/></a:ln>"
    effect = effect_shadow(COLORS["ink"], 0.12, dist=90000, blur=240000) if shadow else ""

    return (
        f"<p:sp>"
        f"<p:nvSpPr><p:cNvPr id=\"{sp_id}\" name=\"{escape(name)}\"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>"
        f"<p:spPr>"
        f"<a:xfrm><a:off x=\"{x}\" y=\"{y}\"/><a:ext cx=\"{w}\" cy=\"{h}\"/></a:xfrm>"
        f"<a:prstGeom prst=\"{prst}\"><a:avLst/></a:prstGeom>"
        f"{fill_xml}"
        f"{line_part}"
        f"{effect}"
        f"</p:spPr>"
        f"</p:sp>"
    )


def _run_xml(text, font, size, color, bold=False, italic=False):
    rpr = [f"sz=\"{size}\"", "lang=\"en-US\""]
    if bold:
        rpr.append("b=\"1\"")
    if italic:
        rpr.append("i=\"1\"")
    rpr_str = " ".join(rpr)
    return (
        f"<a:r><a:rPr {rpr_str}><a:latin typeface=\"{escape(font)}\"/><a:srgbClr val=\"{color}\"/></a:rPr><a:t>{escape(text)}</a:t></a:r>"
    )


def paragraph_xml(runs, align="l", bullet=False):
    if bullet:
        ppr = (
            f"<a:pPr algn=\"{align}\" marL=\"{emu(0.25)}\" indent=\"-{emu(0.12)}\">"
            f"<a:buChar char=\"•\"/></a:pPr>"
        )
    else:
        ppr = f"<a:pPr algn=\"{align}\"/>"
    return "<a:p>" + ppr + "".join(runs) + "<a:endParaRPr lang=\"en-US\"/>" + "</a:p>"


def shape_textbox(sp_id, name, x, y, w, h, paragraphs, align="l", valign="t", fill=None, line=None, round_rect=False, margin=0.08):
    prst = "roundRect" if round_rect else "rect"
    fill_xml = solid_fill(fill[0], fill[1]) if fill else "<a:noFill/>"
    line_part = line_xml(line[0], line[1], line[2]) if line else "<a:ln><a:noFill/></a:ln>"
    l_ins = r_ins = t_ins = b_ins = emu(margin)

    paras_xml = "".join(paragraphs)
    body_pr = f"<a:bodyPr wrap=\"square\" anchor=\"{valign}\" lIns=\"{l_ins}\" rIns=\"{r_ins}\" tIns=\"{t_ins}\" bIns=\"{b_ins}\"/>"

    return (
        f"<p:sp>"
        f"<p:nvSpPr><p:cNvPr id=\"{sp_id}\" name=\"{escape(name)}\"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>"
        f"<p:spPr>"
        f"<a:xfrm><a:off x=\"{x}\" y=\"{y}\"/><a:ext cx=\"{w}\" cy=\"{h}\"/></a:xfrm>"
        f"<a:prstGeom prst=\"{prst}\"><a:avLst/></a:prstGeom>"
        f"{fill_xml}"
        f"{line_part}"
        f"</p:spPr>"
        f"<p:txBody>{body_pr}<a:lstStyle/>{paras_xml}</p:txBody>"
        f"</p:sp>"
    )


def slide_xml(shapes):
    return (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<p:sld xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" "
        "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" "
        "xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\">"
        "<p:cSld>"
        "<p:spTree>"
        "<p:nvGrpSpPr><p:cNvPr id=\"1\" name=\"\"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>"
        "<p:grpSpPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"0\" cy=\"0\"/>"
        "<a:chOff x=\"0\" y=\"0\"/><a:chExt cx=\"0\" cy=\"0\"/></a:xfrm></p:grpSpPr>"
        + "".join(shapes) +
        "</p:spTree>"
        "</p:cSld>"
        "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>"
        "</p:sld>"
    )


# Build slides
slides = []

# Slide 1: Cover
shapes = []
sp = 2
# background
shapes.append(shape_rect(sp, "Background", 0, 0, SLIDE_W, SLIDE_H, fill=(COLORS["bg"], 1.0)))
sp += 1
# Orb glows (approx w/ semi-transparent circles)
for i, (cx_in, cy_in, r_in, color, opacity) in enumerate([
    (11.5, 0.8, 2.3, COLORS["accent"], 0.10),
    (11.5, 0.8, 1.6, COLORS["accent"], 0.14),
    (1.2, 6.6, 2.6, COLORS["accent2"], 0.08),
    (1.2, 6.6, 1.9, COLORS["accent2"], 0.12),
]):
    x = emu(cx_in - r_in)
    y = emu(cy_in - r_in)
    d = emu(r_in * 2)
    shapes.append(shape_rect(sp, f"Glow {i+1}", x, y, d, d, fill=(color, opacity), line=None, round_rect=True))
    sp += 1

# Eyebrow pill
pill_x, pill_y, pill_w, pill_h = emu(0.8), emu(0.7), emu(3.2), emu(0.45)
shapes.append(shape_textbox(
    sp, "Eyebrow", pill_x, pill_y, pill_w, pill_h,
    [paragraph_xml([
        _run_xml("AGENT WARGAME", FONTS["body"], 1100, COLORS["stone500"], bold=True)
    ])],
    align="l", valign="ctr",
    fill=(COLORS["surface"], 1.0),
    line=(COLORS["ink"], 12700, 0.08),
    round_rect=True,
    margin=0.15,
))
sp += 1
# Accent dot

dot_size = emu(0.12)
shapes.append(shape_rect(
    sp, "Eyebrow Dot", pill_x + emu(0.15), pill_y + emu(0.165), dot_size, dot_size,
    fill=(COLORS["accent"], 1.0), line=None, round_rect=True
))
sp += 1

# Hero icon badge
shapes.append(shape_textbox(
    sp, "Hero Icon", emu(0.8), emu(1.45), emu(0.7), emu(0.7),
    [paragraph_xml([
        _run_xml("A", FONTS["display"], 2200, "FFFFFF", bold=True)
    ], align="c")],
    align="c", valign="ctr",
    fill=(COLORS["stone900"], 1.0),
    line=None,
    round_rect=True,
    margin=0.0,
))
sp += 1

# Title
shapes.append(shape_textbox(
    sp, "Title", emu(0.8), emu(2.1), emu(8.5), emu(0.9),
    [paragraph_xml([
        _run_xml("Agent Wargame", FONTS["display"], 5200, COLORS["ink"], bold=False)
    ])],
    align="l", valign="t"
))
sp += 1

# Subtitle
shapes.append(shape_textbox(
    sp, "Subtitle", emu(0.8), emu(3.0), emu(7.5), emu(0.7),
    [paragraph_xml([
        _run_xml("A multi‑agent simulation of power, incentives, and emergent outcomes.", FONTS["body"], 2000, COLORS["muted"], bold=False)
    ])],
    align="l", valign="t"
))
sp += 1

# Small feature cards
card_w = emu(3.0)
card_h = emu(0.9)
shapes.append(shape_textbox(
    sp, "Feature Card 1", emu(0.8), emu(4.2), card_w, card_h,
    [
        paragraph_xml([_run_xml("BRANCHING TIMELINE", FONTS["body"], 900, COLORS["stone500"], bold=True)]),
        paragraph_xml([_run_xml("Fork critical turns and compare futures.", FONTS["body"], 1200, COLORS["stone700"])])
    ],
    align="l", valign="t",
    fill=(COLORS["surface2"], 1.0),
    line=(COLORS["ink"], 12700, 0.08),
    round_rect=True,
    margin=0.12,
))
sp += 1

shapes.append(shape_textbox(
    sp, "Feature Card 2", emu(4.0), emu(4.2), card_w, card_h,
    [
        paragraph_xml([_run_xml("MANY AGENTS", FONTS["body"], 900, COLORS["stone500"], bold=True)]),
        paragraph_xml([_run_xml("Motives, constraints, leverage evolve each turn.", FONTS["body"], 1200, COLORS["stone700"])])
    ],
    align="l", valign="t",
    fill=(COLORS["surface2"], 1.0),
    line=(COLORS["ink"], 12700, 0.08),
    round_rect=True,
    margin=0.12,
))
sp += 1

slides.append(slide_xml(shapes))

# Slide 2: Palette
shapes = []
sp = 2
shapes.append(shape_rect(sp, "Background", 0, 0, SLIDE_W, SLIDE_H, fill=(COLORS["bg"], 1.0)))
sp += 1
shapes.append(shape_textbox(
    sp, "Palette Title", emu(0.8), emu(0.5), emu(6.5), emu(0.6),
    [paragraph_xml([_run_xml("Color Palette", FONTS["display"], 3600, COLORS["ink"], bold=False)])],
))
sp += 1

# Swatches
swatch_x = emu(0.8)
swatch_y = emu(1.4)
swatch_w = emu(2.0)
swatch_h = emu(0.9)
gap_x = emu(0.3)
gap_y = emu(0.3)

swatches = [
    ("Background", COLORS["bg"]),
    ("Surface", COLORS["surface"]),
    ("Surface 2", COLORS["surface2"]),
    ("Surface 3", COLORS["surface3"]),
    ("Ink", COLORS["ink"]),
    ("Muted", COLORS["muted"]),
    ("Accent", COLORS["accent"]),
    ("Accent 2", COLORS["accent2"]),
    ("Accent 3", COLORS["accent3"]),
    ("Border", "12151A"),
]

for i, (label, col) in enumerate(swatches):
    row = i // 3
    col_i = i % 3
    x = swatch_x + col_i * (swatch_w + gap_x)
    y = swatch_y + row * (swatch_h + gap_y)
    shapes.append(shape_rect(
        sp, f"Swatch {label}", x, y, swatch_w, swatch_h,
        fill=(col, 1.0),
        line=(COLORS["ink"], 12700, 0.08),
        round_rect=True
    ))
    sp += 1
    shapes.append(shape_textbox(
        sp, f"Swatch Label {label}", x, y + emu(0.95), swatch_w, emu(0.35),
        [paragraph_xml([_run_xml(label.upper(), FONTS["body"], 900, COLORS["stone500"], bold=True)])],
        align="l", valign="t", fill=None, line=None, margin=0.0
    ))
    sp += 1

# Token notes
shapes.append(shape_textbox(
    sp, "Palette Notes", emu(7.2), emu(1.4), emu(5.6), emu(4.6),
    [
        paragraph_xml([_run_xml("Usage Notes", FONTS["display"], 2200, COLORS["ink"])], align="l"),
        paragraph_xml([_run_xml("Use warm neutrals for canvas and cards", FONTS["body"], 1400, COLORS["muted"])], align="l", bullet=True),
        paragraph_xml([_run_xml("Burgundy drives primary actions and accents", FONTS["body"], 1400, COLORS["muted"])], align="l", bullet=True),
        paragraph_xml([_run_xml("Gold + teal are sparing secondary accents", FONTS["body"], 1400, COLORS["muted"])], align="l", bullet=True),
        paragraph_xml([_run_xml("Borders are soft and low-contrast", FONTS["body"], 1400, COLORS["muted"])], align="l", bullet=True),
    ],
    align="l", valign="t"
))
sp += 1

slides.append(slide_xml(shapes))

# Slide 3: Typography
shapes = []
sp = 2
shapes.append(shape_rect(sp, "Background", 0, 0, SLIDE_W, SLIDE_H, fill=(COLORS["bg"], 1.0)))
sp += 1
shapes.append(shape_textbox(
    sp, "Type Title", emu(0.8), emu(0.5), emu(6.5), emu(0.6),
    [paragraph_xml([_run_xml("Typography & Scale", FONTS["display"], 3600, COLORS["ink"])])],
))
sp += 1

# Display column
shapes.append(shape_textbox(
    sp, "Display Label", emu(0.8), emu(1.3), emu(5.5), emu(0.4),
    [paragraph_xml([_run_xml("DISPLAY / FRAUNCES", FONTS["body"], 900, COLORS["stone500"], bold=True)])],
))
sp += 1

sizes = [4800, 3200, 2400]
labels = ["Hero Title", "Section Title", "Card Title"]
for i, sz in enumerate(sizes):
    shapes.append(shape_textbox(
        sp, f"Display {i}", emu(0.8), emu(1.8 + i*0.9), emu(6.0), emu(0.7),
        [paragraph_xml([_run_xml(labels[i], FONTS["display"], sz, COLORS["ink"])])],
    ))
    sp += 1

# Body column
shapes.append(shape_textbox(
    sp, "Body Label", emu(7.2), emu(1.3), emu(5.5), emu(0.4),
    [paragraph_xml([_run_xml("BODY / SPACE GROTESK", FONTS["body"], 900, COLORS["stone500"], bold=True)])],
))
sp += 1

body_sizes = [2000, 1600, 1200]
body_labels = ["Body 18pt", "Body 14pt", "Micro 12pt"]
for i, sz in enumerate(body_sizes):
    shapes.append(shape_textbox(
        sp, f"Body {i}", emu(7.2), emu(1.8 + i*0.8), emu(5.5), emu(0.6),
        [paragraph_xml([_run_xml(body_labels[i] + " — The quick brown fox jumps over the lazy dog.", FONTS["body"], sz, COLORS["muted"])])],
    ))
    sp += 1

# Uppercase label example
shapes.append(shape_textbox(
    sp, "Eyebrow Example", emu(0.8), emu(4.7), emu(6.0), emu(0.5),
    [paragraph_xml([_run_xml("UPPERCASE LABEL · 0.25em TRACKING", FONTS["body"], 900, COLORS["stone500"], bold=True)])],
))
sp += 1

# Mono numbers example
shapes.append(shape_textbox(
    sp, "Mono Example", emu(7.2), emu(4.7), emu(5.5), emu(0.6),
    [paragraph_xml([_run_xml("SCORE 82", FONTS["mono"], 2400, COLORS["emerald600"], bold=False)])],
))
sp += 1

slides.append(slide_xml(shapes))

# Slide 4: Components
shapes = []
sp = 2
shapes.append(shape_rect(sp, "Background", 0, 0, SLIDE_W, SLIDE_H, fill=(COLORS["bg"], 1.0)))
sp += 1
shapes.append(shape_textbox(
    sp, "Components Title", emu(0.8), emu(0.5), emu(6.5), emu(0.6),
    [paragraph_xml([_run_xml("UI Components", FONTS["display"], 3600, COLORS["ink"])])],
))
sp += 1

# Primary button
shapes.append(shape_textbox(
    sp, "Primary Button", emu(0.8), emu(1.5), emu(2.6), emu(0.6),
    [paragraph_xml([_run_xml("Primary", FONTS["body"], 1400, "FFFFFF", bold=True)], align="c")],
    align="c", valign="ctr",
    fill=(COLORS["accent"], 1.0),
    line=("5F121D", 12700, 0.6),
    round_rect=True,
    margin=0.05,
))
sp += 1

# Ghost button
shapes.append(shape_textbox(
    sp, "Ghost Button", emu(3.6), emu(1.5), emu(2.6), emu(0.6),
    [paragraph_xml([_run_xml("Ghost", FONTS["body"], 1400, COLORS["muted"], bold=True)], align="c")],
    align="c", valign="ctr",
    fill=(COLORS["surface"], 1.0),
    line=(COLORS["ink"], 12700, 0.10),
    round_rect=True,
    margin=0.05,
))
sp += 1

# Chips
shapes.append(shape_textbox(
    sp, "Chip Active", emu(0.8), emu(2.4), emu(2.1), emu(0.45),
    [paragraph_xml([_run_xml("ACTIVE", FONTS["body"], 1100, "FFFFFF", bold=True)], align="c")],
    align="c", valign="ctr",
    fill=(COLORS["accent"], 1.0),
    line=None,
    round_rect=True,
    margin=0.05,
))
sp += 1

shapes.append(shape_textbox(
    sp, "Chip Idle", emu(3.2), emu(2.4), emu(2.1), emu(0.45),
    [paragraph_xml([_run_xml("IDLE", FONTS["body"], 1100, COLORS["muted"], bold=True)], align="c")],
    align="c", valign="ctr",
    fill=(COLORS["surface2"], 1.0),
    line=(COLORS["ink"], 12700, 0.08),
    round_rect=True,
    margin=0.05,
))
sp += 1

# Input field
shapes.append(shape_textbox(
    sp, "Input", emu(0.8), emu(3.2), emu(4.8), emu(0.65),
    [paragraph_xml([_run_xml("Input field", FONTS["body"], 1200, COLORS["muted2"])])],
    align="l", valign="ctr",
    fill=("FAF7F2", 1.0),
    line=(COLORS["ink"], 12700, 0.10),
    round_rect=True,
    margin=0.12,
))
sp += 1

# Text area
shapes.append(shape_textbox(
    sp, "Textarea", emu(0.8), emu(4.0), emu(4.8), emu(1.1),
    [paragraph_xml([_run_xml("Textarea with longer content…", FONTS["body"], 1200, COLORS["muted2"])])],
    align="l", valign="t",
    fill=("FAF7F2", 1.0),
    line=(COLORS["ink"], 12700, 0.10),
    round_rect=True,
    margin=0.12,
))
sp += 1

# Progress bar
track_x, track_y, track_w, track_h = emu(6.2), emu(1.6), emu(4.8), emu(0.18)
shapes.append(shape_rect(sp, "Track", track_x, track_y, track_w, track_h, fill=("EEF2F7", 1.0), line=None, round_rect=True))
sp += 1
shapes.append(shape_rect(sp, "Fill", track_x, track_y, int(track_w*0.65), track_h, fill=(COLORS["accent"], 1.0), line=None, round_rect=True))
sp += 1

# Glass panel example
shapes.append(shape_textbox(
    sp, "Glass Panel", emu(6.2), emu(2.2), emu(5.8), emu(2.2),
    [
        paragraph_xml([_run_xml("Glass Panel", FONTS["display"], 2000, COLORS["ink"])], align="l"),
        paragraph_xml([_run_xml("Use soft borders, warm gradients, and generous padding.", FONTS["body"], 1300, COLORS["muted"])])
    ],
    align="l", valign="t",
    fill=(COLORS["surface"], 0.98),
    line=(COLORS["ink"], 12700, 0.08),
    round_rect=True,
    margin=0.16,
))
sp += 1

slides.append(slide_xml(shapes))

# Slide 5: Layout Example
shapes = []
sp = 2
shapes.append(shape_rect(sp, "Background", 0, 0, SLIDE_W, SLIDE_H, fill=(COLORS["bg"], 1.0)))
sp += 1
shapes.append(shape_textbox(
    sp, "Layout Title", emu(0.8), emu(0.5), emu(6.5), emu(0.6),
    [paragraph_xml([_run_xml("Layout Example", FONTS["display"], 3600, COLORS["ink"])])],
))
sp += 1

# Left column text
shapes.append(shape_textbox(
    sp, "Layout Headline", emu(0.8), emu(1.4), emu(5.6), emu(0.9),
    [paragraph_xml([_run_xml("Simulating Power Dynamics", FONTS["display"], 3200, COLORS["ink"])])],
))
sp += 1

shapes.append(shape_textbox(
    sp, "Layout Body", emu(0.8), emu(2.3), emu(5.6), emu(1.1),
    [paragraph_xml([_run_xml("Use strong hierarchy: serif headline, muted body, and small caps labels.", FONTS["body"], 1500, COLORS["muted"])])],
))
sp += 1

# Right image placeholder
shapes.append(shape_rect(sp, "Image", emu(7.0), emu(1.4), emu(5.5), emu(3.1), fill=(COLORS["surface"], 1.0), line=(COLORS["ink"], 12700, 0.08), round_rect=True, shadow=True))
sp += 1
shapes.append(shape_textbox(
    sp, "Image Label", emu(7.0), emu(2.7), emu(5.5), emu(0.5),
    [paragraph_xml([_run_xml("16:9 Scene Image", FONTS["body"], 1400, COLORS["muted2"])], align="c")],
    align="c", valign="ctr"
))
sp += 1

# Two small cards
shapes.append(shape_textbox(
    sp, "Card A", emu(0.8), emu(3.9), emu(2.6), emu(0.9),
    [paragraph_xml([_run_xml("BRANCHING", FONTS["body"], 900, COLORS["stone500"], bold=True)]),
     paragraph_xml([_run_xml("Fork critical turns.", FONTS["body"], 1200, COLORS["stone700"])])],
    align="l", valign="t",
    fill=(COLORS["surface2"], 1.0),
    line=(COLORS["ink"], 12700, 0.08),
    round_rect=True,
    margin=0.12
))
sp += 1

shapes.append(shape_textbox(
    sp, "Card B", emu(3.7), emu(3.9), emu(2.6), emu(0.9),
    [paragraph_xml([_run_xml("AGENTS", FONTS["body"], 900, COLORS["stone500"], bold=True)]),
     paragraph_xml([_run_xml("Each with evolving motives.", FONTS["body"], 1200, COLORS["stone700"])])],
    align="l", valign="t",
    fill=(COLORS["surface2"], 1.0),
    line=(COLORS["ink"], 12700, 0.08),
    round_rect=True,
    margin=0.12
))
sp += 1

slides.append(slide_xml(shapes))

# Slide 6: Data + Modal
shapes = []
sp = 2
shapes.append(shape_rect(sp, "Background", 0, 0, SLIDE_W, SLIDE_H, fill=(COLORS["bg"], 1.0)))
sp += 1
shapes.append(shape_textbox(
    sp, "Data Title", emu(0.8), emu(0.5), emu(6.5), emu(0.6),
    [paragraph_xml([_run_xml("Data & Modal Patterns", FONTS["display"], 3600, COLORS["ink"])])],
))
sp += 1

# Score card
shapes.append(shape_textbox(
    sp, "Score Card", emu(0.8), emu(1.4), emu(4.4), emu(1.6),
    [
        paragraph_xml([_run_xml("YOUR GOAL", FONTS["body"], 900, COLORS["stone500"], bold=True)]),
        paragraph_xml([_run_xml("82", FONTS["mono"], 3600, COLORS["emerald600"])], align="l"),
    ],
    align="l", valign="t",
    fill=(COLORS["surface2"], 1.0),
    line=(COLORS["ink"], 12700, 0.08),
    round_rect=True,
    margin=0.14
))
sp += 1

# Progress bar under score
track_x, track_y = emu(0.8), emu(3.05)
track_w, track_h = emu(4.4), emu(0.18)
shapes.append(shape_rect(sp, "Track2", track_x, track_y, track_w, track_h, fill=("EEF2F7", 1.0), line=None, round_rect=True))
sp += 1
shapes.append(shape_rect(sp, "Fill2", track_x, track_y, int(track_w*0.82), track_h, fill=(COLORS["accent"], 1.0), line=None, round_rect=True))
sp += 1

# Timeline pill
shapes.append(shape_textbox(
    sp, "Timeline Pill", emu(5.6), emu(1.45), emu(6.8), emu(0.55),
    [paragraph_xml([_run_xml("T12  •  AI Lab announces new model", FONTS["body"], 1200, "FFFFFF", bold=True)], align="l")],
    align="l", valign="ctr",
    fill=(COLORS["stone900"], 1.0),
    line=None,
    round_rect=True,
    margin=0.16
))
sp += 1

# Modal mock
modal_x, modal_y, modal_w, modal_h = emu(5.6), emu(2.2), emu(6.6), emu(4.6)
shapes.append(shape_rect(sp, "Modal", modal_x, modal_y, modal_w, modal_h, fill=(COLORS["surface"], 0.98), line=(COLORS["ink"], 12700, 0.08), round_rect=True, shadow=True))
sp += 1

shapes.append(shape_textbox(
    sp, "Modal Header", modal_x, modal_y, modal_w, emu(0.7),
    [paragraph_xml([_run_xml("Game Analysis", FONTS["display"], 2000, COLORS["ink"])])],
    align="l", valign="ctr",
    fill=(COLORS["surface"], 1.0),
    line=None,
    round_rect=False,
    margin=0.16
))
sp += 1

shapes.append(shape_textbox(
    sp, "Modal Body", modal_x, modal_y + emu(0.8), modal_w, emu(2.4),
    [
        paragraph_xml([_run_xml("Key Turning Points", FONTS["body"], 1200, COLORS["stone500"], bold=True)]),
        paragraph_xml([_run_xml("T05: Lab secures new compute", FONTS["body"], 1200, COLORS["muted"])], bullet=True),
        paragraph_xml([_run_xml("T09: Rival coalition fractures", FONTS["body"], 1200, COLORS["muted"])], bullet=True),
        paragraph_xml([_run_xml("T12: Alignment crisis contained", FONTS["body"], 1200, COLORS["muted"])], bullet=True),
    ],
    align="l", valign="t",
    fill=None,
    line=None,
    margin=0.16
))
sp += 1

# Modal buttons
shapes.append(shape_textbox(
    sp, "Modal Ghost", modal_x + emu(0.4), modal_y + emu(3.6), emu(2.6), emu(0.55),
    [paragraph_xml([_run_xml("Continue", FONTS["body"], 1200, COLORS["muted"], bold=True)], align="c")],
    align="c", valign="ctr",
    fill=(COLORS["surface"], 1.0),
    line=(COLORS["ink"], 12700, 0.10),
    round_rect=True,
    margin=0.05,
))
sp += 1

shapes.append(shape_textbox(
    sp, "Modal Primary", modal_x + emu(3.2), modal_y + emu(3.6), emu(2.6), emu(0.55),
    [paragraph_xml([_run_xml("Play Again", FONTS["body"], 1200, "FFFFFF", bold=True)], align="c")],
    align="c", valign="ctr",
    fill=(COLORS["accent"], 1.0),
    line=("5F121D", 12700, 0.6),
    round_rect=True,
    margin=0.05,
))
sp += 1

slides.append(slide_xml(shapes))

# Build pptx structure
now = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

content_types = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>",
    "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">",
    "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>",
    "<Default Extension=\"xml\" ContentType=\"application/xml\"/>",
    "<Override PartName=\"/ppt/presentation.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml\"/>",
    "<Override PartName=\"/ppt/slideMasters/slideMaster1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml\"/>",
    "<Override PartName=\"/ppt/slideLayouts/slideLayout1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml\"/>",
    "<Override PartName=\"/ppt/theme/theme1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.theme+xml\"/>",
    "<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>",
    "<Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/>",
]
for i in range(1, len(slides) + 1):
    content_types.append(
        f"<Override PartName=\"/ppt/slides/slide{i}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.presentationml.slide+xml\"/>"
    )
content_types.append("</Types>")
content_types_xml = "".join(content_types)

rels_root = (
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"ppt/presentation.xml\"/>"
    "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/>"
    "<Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties\" Target=\"docProps/app.xml\"/>"
    "</Relationships>"
)

presentation_xml = (
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
    "<p:presentation xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" "
    "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" "
    "xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\">"
    "<p:sldMasterIdLst><p:sldMasterId id=\"2147483648\" r:id=\"rId1\"/></p:sldMasterIdLst>"
    "<p:sldIdLst>"
    + "".join([f"<p:sldId id=\"{256+i}\" r:id=\"rId{i+1}\"/>" for i in range(1, len(slides)+1)])
    + "</p:sldIdLst>"
    f"<p:slideSize cx=\"{SLIDE_W}\" cy=\"{SLIDE_H}\" type=\"screen16x9\"/>"
    "<p:notesSz cx=\"6858000\" cy=\"9144000\"/>"
    "</p:presentation>"
)

presentation_rels = (
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster\" Target=\"slideMasters/slideMaster1.xml\"/>"
    + "".join([
        f"<Relationship Id=\"rId{i+1}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide\" Target=\"slides/slide{i}.xml\"/>"
        for i in range(1, len(slides)+1)
    ])
    + "</Relationships>"
)

slide_master_xml = (
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
    "<p:sldMaster xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" "
    "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" "
    "xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\">"
    "<p:cSld>"
    "<p:spTree>"
    "<p:nvGrpSpPr><p:cNvPr id=\"1\" name=\"\"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>"
    "<p:grpSpPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"0\" cy=\"0\"/>"
    "<a:chOff x=\"0\" y=\"0\"/><a:chExt cx=\"0\" cy=\"0\"/></a:xfrm></p:grpSpPr>"
    "</p:spTree>"
    "</p:cSld>"
    "<p:clrMap bg1=\"lt1\" tx1=\"dk1\" bg2=\"lt2\" tx2=\"dk2\" accent1=\"accent1\" accent2=\"accent2\" accent3=\"accent3\" accent4=\"accent4\" accent5=\"accent5\" accent6=\"accent6\" hlink=\"hlink\" folHlink=\"folHlink\"/>"
    "<p:sldLayoutIdLst><p:sldLayoutId id=\"1\" r:id=\"rId1\"/></p:sldLayoutIdLst>"
    "<p:txStyles>"
    "<p:titleStyle><a:lvl1pPr algn=\"l\"/><a:defRPr sz=\"4400\"/></p:titleStyle>"
    "<p:bodyStyle><a:lvl1pPr algn=\"l\"/><a:defRPr sz=\"2000\"/></p:bodyStyle>"
    "<p:otherStyle><a:defRPr sz=\"1600\"/></p:otherStyle>"
    "</p:txStyles>"
    "</p:sldMaster>"
)

slide_master_rels = (
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout\" Target=\"../slideLayouts/slideLayout1.xml\"/>"
    "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme\" Target=\"../theme/theme1.xml\"/>"
    "</Relationships>"
)

slide_layout_xml = (
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
    "<p:sldLayout xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" "
    "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" "
    "xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\" type=\"blank\" preserve=\"1\">"
    "<p:cSld name=\"Blank\">"
    "<p:spTree>"
    "<p:nvGrpSpPr><p:cNvPr id=\"1\" name=\"\"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>"
    "<p:grpSpPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"0\" cy=\"0\"/>"
    "<a:chOff x=\"0\" y=\"0\"/><a:chExt cx=\"0\" cy=\"0\"/></a:xfrm></p:grpSpPr>"
    "</p:spTree>"
    "</p:cSld>"
    "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>"
    "</p:sldLayout>"
)

slide_layout_rels = (
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster\" Target=\"../slideMasters/slideMaster1.xml\"/>"
    "</Relationships>"
)

theme_xml = (
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
    "<a:theme xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" name=\"PowerAI\">"
    "<a:themeElements>"
    "<a:clrScheme name=\"PowerAI\">"
    f"<a:dk1><a:srgbClr val=\"{COLORS['ink']}\"/></a:dk1>"
    f"<a:lt1><a:srgbClr val=\"{COLORS['surface']}\"/></a:lt1>"
    f"<a:dk2><a:srgbClr val=\"{COLORS['ink2']}\"/></a:dk2>"
    f"<a:lt2><a:srgbClr val=\"{COLORS['bg']}\"/></a:lt2>"
    f"<a:accent1><a:srgbClr val=\"{COLORS['accent']}\"/></a:accent1>"
    f"<a:accent2><a:srgbClr val=\"{COLORS['accent2']}\"/></a:accent2>"
    f"<a:accent3><a:srgbClr val=\"{COLORS['accent3']}\"/></a:accent3>"
    f"<a:accent4><a:srgbClr val=\"{COLORS['muted']}\"/></a:accent4>"
    f"<a:accent5><a:srgbClr val=\"{COLORS['muted2']}\"/></a:accent5>"
    f"<a:accent6><a:srgbClr val=\"{COLORS['stone500']}\"/></a:accent6>"
    f"<a:hlink><a:srgbClr val=\"{COLORS['accent']}\"/></a:hlink>"
    f"<a:folHlink><a:srgbClr val=\"{COLORS['accent']}\"/></a:folHlink>"
    "</a:clrScheme>"
    "<a:fontScheme name=\"PowerAI\">"
    f"<a:majorFont><a:latin typeface=\"{FONTS['display']}\"/><a:ea typeface=\"\"/><a:cs typeface=\"\"/></a:majorFont>"
    f"<a:minorFont><a:latin typeface=\"{FONTS['body']}\"/><a:ea typeface=\"\"/><a:cs typeface=\"\"/></a:minorFont>"
    "</a:fontScheme>"
    "<a:fmtScheme name=\"PowerAI\">"
    "<a:fillStyleLst>"
    "<a:solidFill><a:srgbClr val=\"FFFFFF\"/></a:solidFill>"
    "<a:solidFill><a:srgbClr val=\"F7F4EE\"/></a:solidFill>"
    "<a:solidFill><a:srgbClr val=\"EFE9E1\"/></a:solidFill>"
    "</a:fillStyleLst>"
    "<a:lnStyleLst>"
    "<a:ln w=\"12700\"><a:solidFill><a:srgbClr val=\"12151A\"><a:alpha val=\"12000\"/></a:srgbClr></a:solidFill></a:ln>"
    "<a:ln w=\"25400\"><a:solidFill><a:srgbClr val=\"12151A\"><a:alpha val=\"12000\"/></a:srgbClr></a:solidFill></a:ln>"
    "<a:ln w=\"38100\"><a:solidFill><a:srgbClr val=\"12151A\"><a:alpha val=\"12000\"/></a:srgbClr></a:solidFill></a:ln>"
    "</a:lnStyleLst>"
    "<a:effectStyleLst>"
    "<a:effectStyle><a:effectLst/></a:effectStyle>"
    "<a:effectStyle><a:effectLst/></a:effectStyle>"
    "<a:effectStyle><a:effectLst/></a:effectStyle>"
    "</a:effectStyleLst>"
    "<a:bgFillStyleLst>"
    "<a:solidFill><a:srgbClr val=\"F3EFE7\"/></a:solidFill>"
    "<a:solidFill><a:srgbClr val=\"FFFFFF\"/></a:solidFill>"
    "<a:solidFill><a:srgbClr val=\"F7F4EE\"/></a:solidFill>"
    "</a:bgFillStyleLst>"
    "</a:fmtScheme>"
    "</a:themeElements>"
    "</a:theme>"
)

core_xml = (
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
    "<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" "
    "xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" "
    "xmlns:dcmitype=\"http://purl.org/dc/dcmitype/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">"
    "<dc:title>Power & AI Simulator Slide Kit</dc:title>"
    "<dc:creator>Codex</dc:creator>"
    f"<dcterms:created xsi:type=\"dcterms:W3CDTF\">{now}</dcterms:created>"
    f"<dcterms:modified xsi:type=\"dcterms:W3CDTF\">{now}</dcterms:modified>"
    "</cp:coreProperties>"
)

app_xml = (
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
    "<Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\" "
    "xmlns:vt=\"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes\">"
    "<Application>Codex</Application>"
    "<Slides>" + str(len(slides)) + "</Slides>"
    "</Properties>"
)

# slide rels template
slide_rels_template = (
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout\" Target=\"../slideLayouts/slideLayout1.xml\"/>"
    "</Relationships>"
)

# Write pptx
out_path = "Power_AI_Simulator_SlideKit.pptx"
with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types_xml)
    z.writestr("_rels/.rels", rels_root)
    z.writestr("docProps/core.xml", core_xml)
    z.writestr("docProps/app.xml", app_xml)
    z.writestr("ppt/presentation.xml", presentation_xml)
    z.writestr("ppt/_rels/presentation.xml.rels", presentation_rels)
    z.writestr("ppt/slideMasters/slideMaster1.xml", slide_master_xml)
    z.writestr("ppt/slideMasters/_rels/slideMaster1.xml.rels", slide_master_rels)
    z.writestr("ppt/slideLayouts/slideLayout1.xml", slide_layout_xml)
    z.writestr("ppt/slideLayouts/_rels/slideLayout1.xml.rels", slide_layout_rels)
    z.writestr("ppt/theme/theme1.xml", theme_xml)

    for i, s in enumerate(slides, 1):
        z.writestr(f"ppt/slides/slide{i}.xml", s)
        z.writestr(f"ppt/slides/_rels/slide{i}.xml.rels", slide_rels_template)

print(f"Wrote {out_path}")
