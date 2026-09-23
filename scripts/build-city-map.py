"""Rebuild the simplified illustrated base from the committed OSM source.
python3 scripts/build-city-map.py
Water and selected main roads retain geography; building clusters are illustrations.
"""
import json, math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'public/maps/astana-source.json').read_text())['features']
def area(p):return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(p,p[1:]+p[:1])))/2
def simplify(p,epsilon=1.4):
 if len(p)<3:return p
 a,b=p[0],p[-1];vx,vy=b[0]-a[0],b[1]-a[1];length=vx*vx+vy*vy
 distances=[]
 for x,y in p[1:-1]:
  t=max(0,min(1,((x-a[0])*vx+(y-a[1])*vy)/length)) if length else 0
  distances.append(math.hypot(x-a[0]-vx*t,y-a[1]-vy*t))
 largest=max(distances);i=distances.index(largest)+1
 return simplify(p[:i+1],epsilon)[:-1]+simplify(p[i:],epsilon) if largest>epsilon else [a,b]
def path(p,closed=True):return 'M'+'L'.join(f'{x:.1f},{y:.1f}' for x,y in simplify(p))+('Z' if closed else '')
def draw(d,fill,stroke='none',w=1):return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'
svg=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 850"><title>Иллюстрированная Астана: Есиль, основные дороги и условные кварталы</title><defs><clipPath id="crop"><rect width="1200" height="850" rx="24"/></clipPath></defs><g clip-path="url(#crop)"><rect width="1200" height="850" fill="#f0eee6"/>']
for f in data:
 if f['kind']=='park' and area(f['p'])>190:svg.append(draw(path(f['p']),'#d7dfc0','#ced8b6',2))
for f in data:
 if f['kind']=='water' and area(f['p'])>160:svg.append(draw(path(f['p']),'#a7d5e5','#cae4e8',5))
for f in data:
 if f['kind']=='river' and f['name']=='Ишим':svg.append(draw(path(f['p'],False),'none','#a7d5e5',13))
road_names=['қабанбай','тұран','мәңгілік','тәуелсіздік','республика','сарыарқа','сығанақ','сарайшық','кенесары','абая','кабанбай','туран']
roads=[f for f in data if f['kind']=='road' and any(s in f['name'].lower() for s in road_names)]
for color,width in [('#d8d4c9',9),('#fffefa',6)]:
 for f in roads:svg.append(draw(path(f['p'],False),'none',color,width))
# Deliberately sparse illustrated neighbourhoods; they do not represent individual addresses.
clusters=[(190,145,5),(360,125,4),(280,255,4),(630,100,4),(840,145,4),(980,220,4),(810,330,4),(1030,415,4),(930,500,3),(270,405,4),(160,550,3),(330,640,3),(640,580,4),(755,670,4),(920,725,3),(480,640,3)]
for ci,(cx,cy,count) in enumerate(clusters):
 for i in range(count):
  x=cx+(i%3)*31;y=cy+(i//3)*30+(i%3)*6;h=17+((ci+i)%4)*9
  svg.append(f'<g transform="translate({x} {y})">')
  svg.append(draw('M-14 4L20 15 36 5 0-5Z','#41587822'))
  svg.append(draw(f'M-12 0L5 7V{7-h}L-12 {-h}Z','#aebdcc'))
  svg.append(draw(f'M5 7L25 -3V{-3-h}L5 {7-h}Z',['#d3dfeb','#d6d3c4','#b9cedd'][ci%3]))
  svg.append(draw(f'M-12 {-h}L8 {-10-h}L25 {-3-h}L5 {7-h}Z','#fdfbf4','#bbc7d0',.6))
  for level in range(1,int(h/9)):
   yy=5-level*9;svg.append(draw(f'M9 {yy}l4-2v-4l-4 2zM17 {yy-4}l4-2v-4l-4 2z','#7295b1'))
  svg.append('</g>')
 # A few small trees alongside each neighbourhood.
 for j in range(2):
  x=cx-22+j*23;y=cy+24
  svg.append(f'<g transform="translate({x} {y})"><ellipse cy="3" rx="7" ry="3" fill="#40534d20"/><path d="M0 2V-9" stroke="#9a9f83" stroke-width="2"/><path d="M0-24L-7-10 0-5 7-10Z" fill="#94b09a"/><path d="M0-24V-5L7-10Z" fill="#7d9d8b"/></g>')
svg.append('</g></svg>');out=root/'public/maps/astana.svg';out.write_text(''.join(svg));print(f'Simplified map: {len(roads)} road segments, {sum(c[2] for c in clusters)} illustrative buildings, {out.stat().st_size} bytes')
