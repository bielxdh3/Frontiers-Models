# Authoring tool: packs downloaded ambientCG CC0 maps into the runtime set
#   albedo.jpg (sRGB), normal.jpg (OpenGL convention), orm.jpg (R=AO, G=roughness, B=metalness)
# at the requested resolution. Source: assets/tex/<id>/{color,normal,rough,ao,metal}.jpg
# Usage: python tools/pack-textures.py <src_root> <dst_root> id:res [id:res ...]
import sys, os
from PIL import Image

src_root, dst_root = sys.argv[1], sys.argv[2]
for spec in sys.argv[3:]:
    aid, res = spec.split(':')
    res = int(res)
    s = os.path.join(src_root, aid)
    d = os.path.join(dst_root, aid)
    os.makedirs(d, exist_ok=True)
    def load(name, mode):
        p = os.path.join(s, name)
        if not os.path.exists(p):
            return None
        im = Image.open(p).convert(mode)
        if im.size != (res, res):
            im = im.resize((res, res), Image.LANCZOS)
        return im
    col = load('color.jpg', 'RGB')
    nor = load('normal.jpg', 'RGB')
    rough = load('rough.jpg', 'L')
    ao = load('ao.jpg', 'L')
    metal = load('metal.jpg', 'L')
    if col is None or nor is None:
        print('missing maps for', aid); continue
    if rough is None: rough = Image.new('L', (res, res), 200)
    if ao is None: ao = Image.new('L', (res, res), 255)
    if metal is None: metal = Image.new('L', (res, res), 0)
    orm = Image.merge('RGB', (ao, rough, metal))
    col.save(os.path.join(d, 'albedo.jpg'), quality=88, optimize=True)
    nor.save(os.path.join(d, 'normal.jpg'), quality=92, optimize=True)
    orm.save(os.path.join(d, 'orm.jpg'), quality=90, optimize=True)
    print(aid, res, 'ok')
