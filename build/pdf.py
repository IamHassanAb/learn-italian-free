# -*- coding: utf-8 -*-
"""Render every bundle with output: pdf into dist/pdf/. Usage: python build/pdf.py [bundle-id ...]"""
import os, sys, math
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content import Content, ROOT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

def _register_fonts():
    """Find a Unicode TTF family (needs accents and arrows). Set ITALIAN_FONT_DIR to a folder with regular.ttf, bold.ttf, italic.ttf to override."""
    families = [
        (os.environ.get("ITALIAN_FONT_DIR", ""), "regular.ttf", "bold.ttf", "italic.ttf"),
        (r"C:\Windows\Fonts", "arial.ttf", "arialbd.ttf", "ariali.ttf"),
        ("/System/Library/Fonts/Supplemental", "Arial.ttf", "Arial Bold.ttf", "Arial Italic.ttf"),
        ("/Library/Fonts", "Arial.ttf", "Arial Bold.ttf", "Arial Italic.ttf"),
        ("/usr/share/fonts/truetype/liberation", "LiberationSans-Regular.ttf", "LiberationSans-Bold.ttf", "LiberationSans-Italic.ttf"),
        ("/usr/share/fonts/truetype/dejavu", "DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSans-Oblique.ttf"),
    ]
    for folder, r, b, i in families:
        paths = [os.path.join(folder, f) for f in (r, b, i)]
        if folder and all(os.path.exists(p) for p in paths):
            for name, path in zip(("Body", "Body-B", "Body-I"), paths):
                pdfmetrics.registerFont(TTFont(name, path))
            pdfmetrics.registerFontFamily("Body", normal="Body", bold="Body-B", italic="Body-I", boldItalic="Body-B")
            return
    sys.exit("No suitable font found. Install Liberation Sans or DejaVu Sans, or set ITALIAN_FONT_DIR to a folder with regular.ttf, bold.ttf and italic.ttf.")
_register_fonts()

GREEN = colors.HexColor("#1f6f4a")
S = {
    "title": ParagraphStyle("t", fontName="Body-B", fontSize=22, leading=27, textColor=GREEN, spaceAfter=6),
    "sub": ParagraphStyle("s", fontName="Body-I", fontSize=10.5, leading=14, textColor=colors.HexColor("#555555"), spaceAfter=12),
    "h1": ParagraphStyle("h1", fontName="Body-B", fontSize=15, leading=19, textColor=GREEN, spaceBefore=14, spaceAfter=6),
    "h2": ParagraphStyle("h2", fontName="Body-B", fontSize=11.5, leading=15, spaceBefore=8, spaceAfter=3),
    "p": ParagraphStyle("p", fontName="Body", fontSize=10, leading=14, spaceAfter=4),
    "it": ParagraphStyle("it", fontName="Body", fontSize=10.5, leading=15, leftIndent=10, spaceAfter=2),
    "b": ParagraphStyle("b", fontName="Body", fontSize=10, leading=14, leftIndent=14, bulletIndent=4, spaceAfter=2),
    "small": ParagraphStyle("sm", fontName="Body", fontSize=8.5, leading=11, textColor=colors.HexColor("#666666")),
}
W = 17 * cm

def widths(rows):
    n = max(len(r) for r in rows)
    w, floor = [], []
    for c in range(n):
        cells = [str(r[c]) for r in rows if c < len(r)]
        avg = sum(len(x) for x in cells) / max(1, len(cells))
        w.append(max(8, min(55, avg)))
        longest_word = max((len(x) for cell in cells for x in cell.replace("**", "").split()), default=1)
        floor.append(longest_word * 0.25 * cm + 0.9 * cm)       # never narrower than the longest word
    tot = sum(w)
    out = [max(W * x / tot, f) for x, f in zip(w, floor)]
    scale = W / sum(out)
    return [x * scale for x in out]

class Renderer:
    def __init__(self, content): self.c = content
    def P(self, text, style="p"): return Paragraph(self.c.inline(text), S[style])
    def table(self, rows, header):
        data = [[Paragraph(self.c.inline(x), S["p"]) for x in r] for r in rows]
        t = Table(data, colWidths=widths(rows), repeatRows=1 if header else 0)
        st = [("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#bbbbbb")), ("VALIGN", (0, 0), (-1, -1), "TOP")]
        if header: st.append(("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e3f1ea")))
        t.setStyle(TableStyle(st)); return t
    def lines(self, n): return [Paragraph("_" * 95, S["small"]) for _ in range(n)]

    def part(self, p):
        out, t = [], p["type"]
        if p.get("title") and t != "writing-task": out.append(self.P(p["title"], "h2"))
        if t == "text":
            out.append(self.P(p["text"], "small" if p.get("small") else "p"))
        elif t == "bullets":
            out += [Paragraph(self.c.inline(i), S["b"], bulletText="\u2022") for i in p["items"]]
        elif t == "dialogue":
            out += [self.P(l, "it") for l in p["lines"]]
        elif t == "table":
            cols = p.get("columns"); rows = ([cols] if cols else []) + p["rows"]
            out.append(self.table(rows, bool(cols) and p.get("header", True)))
        elif t == "vocab":
            hdr = p.get("header", True)
            def disp(i):
                a = i.get("art"); return (a + ("" if a.endswith("'") else " ") + i["it"]) if a else i["it"]
            def forms(i):
                f = i.get("forms")
                if not f: return ""
                u = []
                for k in ("m", "f", "mp", "fp"):
                    if f.get(k) and f[k] not in u: u.append(f[k])
                return "never changes" if len(u) == 1 else " · ".join(u)
            hasf = any("forms" in i for i in p["items"])
            rows = ([["Italiano", "English"] + (["Forms"] if hasf else [])] if hdr else []) + [[disp(i), i["en"]] + ([forms(i)] if hasf else []) for i in p["items"]]
            out.append(self.table(rows, hdr))
        elif t == "phrases":
            ex = any(i.get("example") for i in p["items"])
            rows = [["Phrase", "English", "Example"] if ex else ["Phrase", "English"]] + [[i["it"], i["en"], i.get("example", "")] if ex else [i["it"], i["en"]] for i in p["items"]]
            out.append(self.table(rows, True))
        elif t == "template":
            out.append(self.table([p["columns"]] + [[""] * len(p["columns"])] * p["blank_rows"], True))
        elif t == "writing-task":
            out.append(self.P(p["title"], "h2")); out.append(self.P(p["prompt"]))
            out += self.lines(p.get("blank_lines", 4))
            out.append(self.P("**Modello:** *%s*" % p["model"], "small"))
        if p.get("blank_lines") and t not in ("writing-task",): out += self.lines(p["blank_lines"])
        return out

    def module(self, m, number=None):
        out = []
        if m.get("show_title", True):
            title = ("%d. %s" % (number, m["title"])) if number else m["title"]
            out.append(self.P(title, "h1"))
        parts, i = m["_parts"], 0
        while i < len(parts):
            p = parts[i]
            if p["type"] == "lookup-row":
                rows = []
                while i < len(parts) and parts[i]["type"] == "lookup-row":
                    rows.append([parts[i]["when"], parts[i]["answer"]]); i += 1
                cols = m.get("lookup_columns")
                out.append(self.table(([cols] if cols else []) + rows, bool(cols)))
                continue
            out += self.part(p); i += 1
        return out

    def bundle(self, b, outdir):
        story, n = [self.P(b["title"], "title"), self.P(b["subtitle"], "sub")], 0
        for e in b["modules"]:
            e = e if isinstance(e, dict) else {"id": e}
            if e.get("page_break"): story.append(PageBreak())
            num = None
            if e.get("number"): n += 1; num = n
            story += self.module(self.c.modules[e["id"]], num)
        os.makedirs(outdir, exist_ok=True)
        path = os.path.join(outdir, b["filename"])
        def foot(cv, d):
            cv.saveState(); cv.setFont("Body", 8); cv.setFillColor(colors.grey)
            cv.drawString(2*cm, 1.2*cm, "Italian practice pack \u00b7 " + b["title"]); cv.drawRightString(A4[0]-2*cm, 1.2*cm, str(d.page)); cv.restoreState()
        SimpleDocTemplate(path, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm, topMargin=1.8*cm, bottomMargin=2*cm,
                          title=b["title"], author="Italian study pack").build(story, onFirstPage=foot, onLaterPages=foot)
        return path

def main(only):
    c = Content()
    if c.problems:
        print("Content has problems; run build/lint.py first:"); [print("  -", p) for p in c.problems]; sys.exit(1)
    r, out = Renderer(c), os.path.join(ROOT, "dist", "pdf")
    for bid, b in sorted(c.bundles.items()):
        if b.get("output") != "pdf" or (only and bid not in only): continue
        print("built", r.bundle(b, out))

if __name__ == "__main__":
    main(sys.argv[1:])
