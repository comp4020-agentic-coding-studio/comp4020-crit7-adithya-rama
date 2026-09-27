import urllib.request,urllib.parse,json,time,hashlib,pathlib,re
from html.parser import HTMLParser
from catalogue_validation import validate_rows
ROOT=pathlib.Path(__file__).resolve().parent.parent
CACHE=ROOT/'.data/source-cache';CACHE.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'data';OUT.mkdir(exist_ok=True)
BASE='https://programsandcourses.anu.edu.au'
class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[];self.skip=0
 def handle_starttag(self,t,a):
  if t in ('script','style'):self.skip+=1
  if t in ('p','li','h1','h2','h3','div','br','tr'):self.parts.append('\n')
 def handle_endtag(self,t):
  if t in ('script','style'):self.skip=max(0,self.skip-1)
 def handle_data(self,d):
  if not self.skip:self.parts.append(d)
def get(url):
 p=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.json')
 if p.exists():return json.loads(p.read_text())
 for a in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'ANU student course-planner prototype'}),timeout=45) as r:raw=r.read().decode('utf-8-sig')
   s={'url':url,'retrievedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'hash':hashlib.sha256(raw.encode()).hexdigest(),'body':raw}
   p.write_text(json.dumps(s));time.sleep(.15);return s
  except Exception:
   if a==2:raise
   time.sleep(2*(a+1))
def page(url):
 s=get(url);p=Text();p.feed(s['body']);t=re.sub(r'[ \t\r\f\v]+',' ',''.join(p.parts));t=re.sub(r'\n\s*\n+','\n',t)
 return {**{k:v for k,v in s.items() if k!='body'},'text':t.strip(),'reviewStatus':'source-captured'}
ends={'program-undergraduate':'ProgramSearch/GetProgramsUnderGraduate','program-postgraduate':'ProgramSearch/GetProgramsPostGraduate','program-research':'ProgramSearch/GetProgramsResearch','program-nonaward':'ProgramSearch/GetProgramsNonAward','course':'CourseSearch/GetCourses','major':'MajorSearch/GetMajors','minor':'MinorSearch/GetMinors','specialisation':'SpecialisationSearch/GetSpecialisations'}
items=[];manifest=[]
for y in (2025,2026,2027):
 for kind,endpoint in ends.items():
  n=0;rows=[];seen=set()
  while True:
   url=BASE+'/data/'+endpoint+'?'+urllib.parse.urlencode({'SelectedYear':y,'PageIndex':n,'PageSize':500,'ShowAll':'true'})
   s=get(url);r=json.loads(s['body']);batch=r['Items']
   rows=validate_rows(batch,y,kind)
   manifest.append({k:v for k,v in s.items() if k!='body'})
   manifest[-1]['reportedTotal']=r['TotalCount'];manifest[-1]['returnedCount']=len(rows)
   break
  # Public API counts are inconsistent with ShowAll; retain both counts for review.
  for row in rows:
   c=row.get('AcademicPlanCode') or row.get('CourseCode') or row.get('SubPlanCode');k='program' if kind.startswith('program') else kind
   name=row.get('ProgramName') or row.get('Name') or row.get('Title') or row.get('SubPlanName')
   if not name:raise ValueError('Missing name '+str(row))
   items.append({'id':f'{y}:{k}:{c.upper()}','year':y,'kind':k,'code':c.upper(),'name':name,'career':row.get('Career') or row.get('AcademicCareer') or '', 'units':row.get('Units') or 0,'sessions':row.get('Session') or '', 'mode':row.get('ModeOfDelivery') or '', 'url':f'{BASE}/{y}/{k}/{c}'})
  print(y,kind,len(rows),flush=True)
(OUT/'catalogue.json').write_text(json.dumps({'release':'anu-2026-09-27-v1','retrievedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'items':items,'sources':manifest},ensure_ascii=False,separators=(',',':')))
sources=[]
for y in (2025,2026):
 u=f'{BASE}/{y}/program/7706XMCOMP';sources.append(page(u))
 links=set(re.findall(r'href=["\']([^"\']*/specialisation/[^"\']+)["\']',get(u)['body'],re.I))
 for link in sorted(links):
  link=urllib.parse.urljoin(BASE,link);link=re.sub(r'/(20\d\d)/specialisation/',f'/{y}/specialisation/',link)
  if not re.search(r'/20\d\d/specialisation/',link):link=link.replace('/specialisation/',f'/{y}/specialisation/')
  sources.append(page(link));print('source',link,flush=True)
sources.append(page('https://systems.anu.edu.au/students/continuing/substitutions/computing-course-substitutions/'))
(OUT/'sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2))
codes={'COMP8020'}
for s in sources[:-1]:codes.update(re.findall(r'\b(?:COMP|ENGN|MATH|STAT|MGMT|INFS|LAWS|REGN)\d{4}\b',s['text']))
details=[]
for y in (2025,2026,2027):
 for c in sorted(codes):
  try:details.append(page(f'{BASE}/{y}/course/{c}'));print('course',y,c,flush=True)
  except Exception as e:print('unavailable',y,c,str(e),flush=True)
(OUT/'course-sources.json').write_text(json.dumps(details,ensure_ascii=False,separators=(',',':')))
print('Finished',len(items),len(sources),len(details),flush=True)
