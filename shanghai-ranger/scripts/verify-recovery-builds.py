"""Verify the actual production H5 and offline IIFE, using synthetic acceptance saves."""
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

OUT=Path(__file__).resolve().parents[1]/'docs/evidence/recovery-v0.9.5'
fixture=json.loads((OUT/'offline-fixture.json').read_text())
assert fixture['version']==3 and fixture['patrol']['dead']
results={}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--enable-unsafe-swiftshader','--use-angle=swiftshader'])
 for label,port,mobile in [('h5',5187,False),('offline',5186,True)]:
  ctx=browser.new_context(viewport={'width':375,'height':812} if mobile else {'width':1100,'height':760},device_scale_factor=1,has_touch=mobile,is_mobile=mobile,reduced_motion='no-preference')
  settings={'quality':'low','sound':False,'volume':0,'reducedMotion':mobile}
  ctx.add_init_script("localStorage.setItem('shanghai-night-watch-v1',"+json.dumps(json.dumps(fixture,ensure_ascii=False))+ ");localStorage.setItem('nightwatch-settings',"+json.dumps(json.dumps(settings))+ ");")
  page=ctx.new_page();errors=[];failed=[];external=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.on('response',lambda r:failed.append([r.status,r.url]) if r.status>=400 else None)
  def route(r):
   if urlparse(r.request.url).hostname not in ('localhost','127.0.0.1',None):
    external.append(r.request.url);r.abort()
   else:r.continue_()
  page.route('**/*',route)
  page.goto(f'http://localhost:{port}/?qa',wait_until='networkidle')
  page.wait_for_function('!!window.__originalQa')
  page.locator('.recovery-card').wait_for()
  assert page.locator('meta[name="application-version"]').get_attribute('content')=='0.9.5'
  assert '0.9.5' in page.locator('.solo-label').inner_text()
  assert page.locator('.nightwatch-start').count()==0
  before=page.evaluate('window.__originalQa.snapshot')
  if mobile:
   assert 'reduced-motion' in page.locator('.game-shell').get_attribute('class')
   page.get_by_role('button',name='再试一次',exact=True).tap()
  else:page.get_by_role('button',name='再试一次',exact=True).click()
  page.wait_for_function('!window.__originalQa.snapshot.dead && !document.querySelector(".revive-transition")')
  page.evaluate('window.__originalQa.freeze()')
  after=page.evaluate('window.__originalQa.snapshot')
  assert after['health']==after['maxHealth'] and after['stamina']==100
  assert after['tracked']==before['tracked'] and after['progress']['cash']==before['progress']['cash']
  assert after['monsterHealth']==after['monsterMaxHealth']
  assert after['rescueAvailable'] and after['potions']>=5
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  audio=page.evaluate('window.__originalQa.audio')
  assert audio['context']=='locked' and not audio['outputConnected'] and audio['scoreVoices']==0,audio
  page.screenshot(path=str(OUT/f'{label}-production-revived.png'))
  results[label]={'version':'0.9.5','touch':mobile,'game_reduced_motion':mobile,'health':after['health'],'tracked':after['tracked'],'save_status':after['saveStatus'],'audio':audio,'page_errors':errors,'failed_requests':failed,'external_requests':external}
  assert not errors and not failed and not external,results[label]
  print(label,'passed',flush=True)
  ctx.close()
 browser.close()
(OUT/'production-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False,indent=2))
