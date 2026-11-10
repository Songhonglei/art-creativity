"""Browser acceptance against the local Vite dev server; no real user saves are used."""
import json
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5185/?qa'
OUT = Path(__file__).resolve().parents[1] / 'docs/evidence/recovery-v0.9.5'
OUT.mkdir(parents=True, exist_ok=True)
results = {}


def defeat(page, rich=False):
    page.evaluate('''(rich) => {
      const e=window.__nightwatch,s=e.simulation;
      s.progress.parts=rich?12:2;s.progress.cash=rich?2400:350;
      s.player.invulnerable=0;s.rescueAvailable=false;
      s.tracked=3;s.questPhase='hunting';s.mainCombat=true;
      s.monster.health=27;s.monster.enraged=true;
      const site={x:s.monster.x,z:s.monster.z};
      window.__originalQa.placePlayer(site.x,site.z+4);
      s.player.facing=Math.PI;s.resources[0].collected=true;
      window.__timing={start:performance.now(),cardAt:null,events:[]};
      const old=s.event;s.event=(event)=>{window.__timing.events.push(event.type);old(event)};
      const observer=new MutationObserver(()=>{
        if(document.querySelector('.recovery-card')&&!window.__timing.cardAt){window.__timing.cardAt=performance.now();observer.disconnect()}
      });observer.observe(document.getElementById('root'),{subtree:true,childList:true});
      s.hurt(1000,s.monster);e.publish();
      window.__deathFrozen={time:s.time,weather:s.weatherTime,petCooldown:s.petCooldown};
    }''', rich)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--enable-unsafe-swiftshader','--use-angle=swiftshader'])
    context = browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
    context.add_init_script("localStorage.setItem('nightwatch-settings',JSON.stringify({quality:'low',sound:false,volume:0}))")
    page = context.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(URL,wait_until='networkidle')
    page.wait_for_function('!!window.__nightwatch')
    page.locator('.nightwatch-start .primary-button').click()
    page.evaluate('cancelAnimationFrame(window.__nightwatch.raf)')
    page.clock.install(time=0)
    page.clock.pause_at(0)
    page.evaluate('window.__nightwatch.lastTime=0;window.__nightwatch.raf=requestAnimationFrame(window.__nightwatch.loop)')
    defeat(page)
    page.locator('.is-fallen').wait_for(state='attached')
    page.clock.run_for(1400)
    pose=page.evaluate("({z:window.__nightwatch.hunter.root.getObjectByName('hunterBody').rotation.z,elapsed:window.__nightwatch.deathElapsed})")
    assert abs(pose['z']+1.42)<.01,pose
    results['death_pose']=pose
    assert page.locator('.recovery-card').count()==0,'Recovery card appeared before 1.5 seconds'
    page.screenshot(path=str(OUT/'desktop-falling.png'),animations='disabled')
    page.keyboard.press('m')
    assert page.locator('.modal-panel').count()==0,'Map bypassed death feedback'
    page.clock.run_for(150)
    page.locator('.recovery-card').wait_for()
    results['death_timing_clock']='Playwright foreground clock; excludes rendering stalls'
    results['death_timing_ms']=page.evaluate('window.__timing.cardAt-window.__timing.start')
    assert 1490 <= results['death_timing_ms'] <= 1550,results['death_timing_ms']
    page.clock.resume()
    print('Timing passed:',results['death_timing_ms'],flush=True)
    assert page.evaluate('''()=>{const s=window.__nightwatch.simulation,b=window.__deathFrozen;return s.time===b.time&&s.weatherTime===b.weather&&s.petCooldown===b.petCooldown}''')
    assert page.get_by_role('button',name='回大排档',exact=True).count()==0
    assert page.get_by_role('button',name='去强化',exact=True).count()==0
    assert page.locator('[data-recovery-retry]').evaluate('(b)=>b===document.activeElement')
    for _ in range(5):
        page.keyboard.press('Tab')
        assert page.evaluate('document.querySelector(".recovery-card").contains(document.activeElement)')
    page.wait_for_timeout(300)
    print('Card layout',page.locator('.recovery-card').evaluate('(e)=>({rect:e.getBoundingClientRect().toJSON(),opacity:getComputedStyle(e).opacity,z:getComputedStyle(e.parentElement).zIndex})'),flush=True)
    page.screenshot(path=str(OUT/'desktop-recovery.png'))
    results['frozen_and_focus']=True
    before=page.evaluate('''()=>{const s=window.__nightwatch.simulation;return {cash:s.progress.cash,parts:s.progress.parts,pets:JSON.stringify(s.progress.pets),cd:s.petCooldown}}''')
    page.locator('[data-recovery-retry]').evaluate('(b)=>{b.click();b.click()}')
    page.wait_for_function('!window.__nightwatch.simulation.dead && !document.querySelector(".revive-transition")')
    page.keyboard.down('w')
    page.wait_for_timeout(100)
    page.keyboard.up('w')
    state=page.evaluate('''()=>{const e=window.__nightwatch,s=e.simulation;e.setPaused(true);return {hp:s.player.health,max:s.maxHealth,tracked:s.tracked,collected:s.resources[0].collected,full:s.monster.health===s.monster.maxHealth,enraged:s.monster.enraged,protection:s.recoveryProtection,cash:s.progress.cash,parts:s.progress.parts,pets:JSON.stringify(s.progress.pets),cd:s.petCooldown,events:window.__timing.events,moving:s.player.moving,point:{x:s.player.x,z:s.player.z},boxes:s.boxColliders.filter(b=>Math.abs(b.x-s.player.x)<b.halfWidth+.34&&Math.abs(b.z-s.player.z)<b.halfDepth+.34).length}}''')
    assert state['hp']==state['max'] and state['tracked']==3 and state['collected'] and state['full'] and not state['enraged']
    assert state['cash']==before['cash'] and state['parts']==before['parts'] and state['pets']==before['pets']
    assert state['events'].count('revive')==1 and state['protection']>0 and state['boxes']==0,state
    page.screenshot(path=str(OUT/'desktop-revived.png'))
    results['retry']=state
    print('Retry passed',flush=True)
    # Rich recovery and contextual upgrade; opening/closing must not replay the death delay.
    defeat(page,rich=True)
    page.get_by_role('button',name='去强化',exact=True).wait_for()
    page.get_by_role('button',name='去强化',exact=True).click()
    page.get_by_role('button',name=re.compile('提升侠义等级')).click()
    page.get_by_role('button',name='关闭菜单',exact=True).click()
    assert page.locator('.recovery-card').is_visible()
    page.get_by_role('button',name='去强化',exact=True).click()
    page.get_by_role('button',name='再试一次',exact=True).click()
    page.wait_for_function('!window.__nightwatch.simulation.dead && !document.querySelector(".revive-transition")')
    assert page.evaluate('window.__nightwatch.simulation.progress.level')==2
    results['upgrade_and_return']=True
    print('Upgrade passed',flush=True)
    # Refresh must not grant another heal, extra rescue, or rewards.
    page.evaluate('''async()=>{const e=window.__nightwatch,s=e.simulation;e.setPaused(true);s.player.health=47;s.rescueAvailable=false;s.petCooldown=11;s.persist();await s.pendingSave}''')
    page.reload(wait_until='networkidle');page.wait_for_function('!!window.__nightwatch')
    assert page.evaluate('window.__nightwatch.simulation.player.health')==47
    assert not page.evaluate('window.__nightwatch.simulation.rescueAvailable')
    assert page.evaluate('window.__nightwatch.simulation.petCooldown')==11,page.evaluate('window.__nightwatch.simulation.petCooldown')
    page.locator('.nightwatch-start .primary-button').click()
    results['reload_no_free_refill']=True
    # Actual mobile-width layout and keyboard-driven reduced-motion setting.
    page.set_viewport_size({'width':375,'height':812})
    page.emulate_media(reduced_motion='reduce')
    defeat(page,rich=True)
    page.locator('.recovery-card').wait_for()
    page.locator('.recovery-details summary').click()
    page.screenshot(path=str(OUT/'mobile-recovery.png'))
    metrics=page.evaluate('''()=>{const card=document.querySelector('.recovery-card'),r=card.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...card.querySelectorAll('button')].map(b=>({text:b.textContent,h:b.getBoundingClientRect().height})),animation:getComputedStyle(card).animationName,reduced:matchMedia('(prefers-reduced-motion:reduce)').matches}}''')
    assert not metrics['overflow'] and metrics['left']>=0 and metrics['right']<=375,metrics
    assert all(b['h']>=44 for b in metrics['buttons']),metrics
    assert metrics['animation']=='none',metrics
    page.set_viewport_size({'width':768,'height':1024})
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    page.screenshot(path=str(OUT/'tablet-recovery.png'))
    results['tablet']=True
    results['mobile']=metrics
    print('Mobile passed',flush=True)
    page.set_viewport_size({'width':812,'height':375})
    page.screenshot(path=str(OUT/'mobile-landscape.png'))
    assert page.locator('[data-recovery-retry]').is_visible()
    results['landscape']=True
    page.set_viewport_size({'width':375,'height':812})
    page.evaluate('''()=>{window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException('test quota','QuotaExceededError')};window.__nightwatch.simulation.persist();window.__nightwatch.publish()}''')
    page.get_by_role('button',name='重试保存',exact=True).wait_for()
    page.screenshot(path=str(OUT/'mobile-save-failed.png'))
    page.evaluate('()=>{Storage.prototype.setItem=window.__originalSetItem}')
    page.get_by_role('button',name='重试保存',exact=True).click()
    page.wait_for_function('window.__nightwatch.simulation.saveStatus==="saved"')
    results['save_failure_and_retry']=True
    # Death checkpoints refresh back to recovery, not a welcome screen or an automatic revival.
    page.reload(wait_until='networkidle');page.wait_for_function('!!window.__nightwatch')
    page.locator('.recovery-card').wait_for()
    assert page.locator('.nightwatch-start').count()==0
    results['death_reload']=True
    (OUT/'offline-fixture.json').write_text(page.evaluate("localStorage.getItem('shanghai-night-watch-v1')"))
    results['page_errors']=errors
    assert not errors,errors
    browser.close()
(OUT/'browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False,indent=2))
