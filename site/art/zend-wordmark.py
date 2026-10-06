# Builds the zend wordmark: z, n and d traced from the Trnznd master logo (site/art/source), plus a constructed e.
# Needs skia-pathops and fonttools; reads word.d (traced t r n z) and traced.json (n, d) from the working folder.
import re, json, math, pathops
from fontTools.svgLib.path import parse_path
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

word = open('word.d').read(); subs = re.findall(r'M[^M]*', word)
Z = subs[3]; tr = json.load(open('traced.json'))

def P(d, t=(1,0,0,1,0,0)):
    p = pathops.Path(); parse_path(d, TransformPen(p.getPen(), t)); return p
def ellipse(cx, cy, rx, ry, n=180):
    p = pathops.Path(); pen = p.getPen()
    for i in range(n):
        a = 2*math.pi*i/n; pt = (cx+rx*math.cos(a), cy+ry*math.sin(a))
        pen.moveTo(pt) if i == 0 else pen.lineTo(pt)
    pen.closePath(); return p
def poly(pts):
    p = pathops.Path(); pen = p.getPen(); pen.moveTo(pts[0]); [pen.lineTo(q) for q in pts[1:]]; pen.closePath(); return p
def svgd(p):
    pen = SVGPathPen(None, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.')); p.draw(pen); return pen.getCommands()
U, I, D = pathops.PathOp.UNION, pathops.PathOp.INTERSECTION, pathops.PathOp.DIFFERENCE

# measurements from the d in the master logo
R, RIX, RIY, CY = 113.5, 57.0, 59.5, 361.5
BAR_T, BAR_B = 331.0, 383.0          # crossbar, ~52 thick, a touch above centre
CUT = math.radians(38)               # lower terminal cut angle

def e_at(cx):
    ring = pathops.op(ellipse(cx, CY, R, R), ellipse(cx, CY, RIX, RIY), D)
    far = 400
    wedge = poly([(cx, CY), (cx+far, CY), (cx+far, CY+far*math.tan(CUT))])
    ring = pathops.op(ring, wedge, D)
    bar = pathops.op(poly([(cx-R, BAR_T), (cx+R, BAR_T), (cx+R, BAR_B), (cx-R, BAR_B)]), ellipse(cx, CY, R, R), I)
    return pathops.op(ring, bar, U)

z_dx = 800 - 1357
z_right = 1536 + z_dx
e_cx = z_right + 22 + R
n_dx = (e_cx + R + 24) - 1563
parts = [P(Z, (1,0,0,1,z_dx,0)), e_at(e_cx), P(tr['n2'], (1,0,0,1,n_dx,0)), P(tr['d'], (1,0,0,1,n_dx,0))]
out = ''.join(svgd(p) for p in parts)
right = 1973 + n_dx
open('zend-word.d', 'w').write(out)
print('word right edge', right, 'e centre', e_cx)
