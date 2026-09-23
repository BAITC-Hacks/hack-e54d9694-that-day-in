"""Build the offline stylized map: python3 scripts/build-city-map.py [Overpass JSON].
The committed compact source and resulting geography are OSM-derived / ODbL 1.0.
Raw query and attribution are documented in docs/map.md. No runtime map service.
"""
import json,sys,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'public/maps';out.mkdir(exist_ok=True)
def project(p):return [round((p['lon']-71.35)*6900+20,1),round((51.205-p['lat'])*6350+20,1)]
def area(p):return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(p,p[1:]+p[:1])))/2
if len(sys.argv)>1:
    raw=json.load(open(sys.argv[1]));features=[]
    for e in raw['elements']:
        t=e.get('tags',{});g=e.get('geometry',[])
        if not g:continue
        pts=[project(p) for p in g]
        if 'building' in t:
            if area(pts)<6 or t['building'] in ['garage','garages','shed','roof']:continue
            kind='building'
        elif t.get('natural')=='water':kind='water'
        elif t.get('waterway')=='river':kind='river'
        elif t.get('leisure')=='park':kind='park'
        elif 'highway' in t:kind='street' if t['highway']=='residential' else 'road'
        else:continue
        features.append({'id':e['id'],'kind':kind,'p':pts,'name':t.get('name:ru',t.get('name','')),'levels':min(12,float(t.get('building:levels','4').split(';')[0]) if t.get('building:levels','4').split(';')[0].isdigit() else 4)})
    source={'attribution':'© OpenStreetMap contributors','license':'https://opendatacommons.org/licenses/odbl/1-0/','snapshot':'2026-09-23','bbox':[71.35,51.09,71.515,51.205],'projection':'x=(lon-71.35)*6900+20; y=(51.205-lat)*6350+20','features':features}
    (out/'astana-source.json').write_text(json.dumps(source,ensure_ascii=False,separators=(',',':')))
else:source=json.loads((out/'astana-source.json').read_text())
features=source['features']
def path(p,closed=True):return 'M'+'L'.join(f'{x:.1f},{y:.1f}' for x,y in p)+('Z' if closed else '')
def paths(kind):return ' '.join(path(f['p'],kind not in ['road','street','river']) for f in features if f['kind']==kind)
s=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 850"><title>Астана — стилизованная география OpenStreetMap</title><defs><clipPath id="crop"><rect width="1200" height="850"/></clipPath></defs><g clip-path="url(#crop)">']
s += ['<rect width="1200" height="850" fill="#e8eedb"/>']
s += [f'<path d="{paths("park")}" fill="#bad29c" stroke="#adc78f" stroke-width="2"/>']
s += [f'<path d="{paths("water")}" fill="#87c9d7" stroke="#c4e3de" stroke-width="3"/>',f'<path d="{paths("river")}" fill="none" stroke="#91cdd8" stroke-width="10" stroke-linecap="round"/>']
for k,w in [('street',2),('road',5)]:
    p=paths(k);s += [f'<path d="{p}" fill="none" stroke="#cbd1bc" stroke-width="{w+2}" stroke-linecap="round" stroke-linejoin="round"/>',f'<path d="{p}" fill="none" stroke="#faf9ec" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>']
bs=sorted((f for f in features if f['kind']=='building'),key=lambda f:sum(y for x,y in f['p'])/len(f['p']))
shadows=[];walls=[];roofs=[[],[],[]]
for i,f in enumerate(bs):
    p=f['p'];h=min(12,2+f['levels']*.8)
    shadows.append(path([[x+3,y+2] for x,y in p]));pass
    for a,b in zip(p,p[1:]):walls.append(path([a,b,[b[0],round(b[1]-h,1)],[a[0],round(a[1]-h,1)]]))
    roofs[i%3].append(path([[x,round(y-h,1)] for x,y in p]))
s.append(f'<path d="{" ".join(shadows)}" fill="#607e76" opacity=".15"/>')
s.append(f'<path d="{" ".join(walls)}" fill="#92aaa8" stroke="#8ea4a1" stroke-width=".25"/>')
for roof,color in zip(roofs,['#faf9ee','#d7e7df','#e8e9d8']):s.append(f'<path d="{" ".join(roof)}" fill="{color}" stroke="#a8bbb1" stroke-width=".35"/>')
s.append('</g></svg>');(out/'astana.svg').write_text(''.join(s))
print('Map features:',len(features),'buildings:',len(bs),'SVG bytes:',(out/'astana.svg').stat().st_size)
