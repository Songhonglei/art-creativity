import { useLayoutEffect, useState } from 'react';
import { RECOVERY } from '../game/recovery';

/** Only foreground time counts; battle time is frozen during the death sequence. */
export function useDeathFeedback(dead: boolean, ready: boolean) {
  const [complete, setComplete] = useState(false);
  useLayoutEffect(() => {
    setComplete(false);
    if (!dead || !ready) return;
    let remaining = RECOVERY.deathSeconds * 1000, started = performance.now(), timer = 0;
    const start = () => { started = performance.now(); timer = window.setTimeout(() => setComplete(true), Math.max(0, remaining)); };
    const visibility = () => {
      if (document.hidden) { remaining -= performance.now() - started; window.clearTimeout(timer); }
      else start();
    };
    document.addEventListener('visibilitychange', visibility);
    if (!document.hidden) start();
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [dead, ready]);
  return complete;
}

export function RecoveryEffects({ dead, complete, reviving, protection }: { dead: boolean; complete: boolean; reviving: boolean; protection: number }) {
  return <>
    {dead && <div className="death-veil" aria-hidden="true">{!complete && <div className="death-caption"><span className="death-rule"/><span>暂时倒下了</span><span className="death-rule"/></div>}</div>}
    {reviving && <div className="revive-transition" role="status" aria-label="正在恢复"/>}
    {!dead && !reviving && protection > 0 && <div className="recovery-protection" role="status"><span className="protection-sigil">安</span><span>已恢复<small>短暂保护</small></span><i style={{ transform: `scaleX(${Math.min(1, protection / RECOVERY.protectionSeconds)})` }}/></div>}
  </>;
}
