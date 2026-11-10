/** Public Storage API contract checked against the container docs on 2026-11-10. */
interface LaunchOptions { miniToolEnv?: { buildVersion?: number | string } }
export interface MiniToolHost {
  launchOptions?: LaunchOptions;
  miniTool?: {
    getLaunchOptions?: () => Promise<LaunchOptions>;
    getStorage?: (options: { key: string }) => Promise<{ data: string | null }>;
    setStorage?: (options: { key: string; data: string }) => Promise<unknown>;
  };
}
export interface GameStorage { label: string; get(key: string): Promise<string | null>; set(key: string, value: string): void | Promise<void> }
export async function createGameStorage(host?: MiniToolHost, browser?: Pick<Storage,'getItem'|'setItem'>): Promise<GameStorage> {
  let build=Number(host?.launchOptions?.miniToolEnv?.buildVersion)||0;
  if(!build&&typeof host?.miniTool?.getLaunchOptions==='function') {
    try { build=Number((await host.miniTool.getLaunchOptions()).miniToolEnv?.buildVersion)||0; } catch { build=0; }
  }
  const api=host?.miniTool;
  if(Math.floor(build/1000)>=9460&&typeof api?.getStorage==='function'&&typeof api.setStorage==='function') {
    const queues=new Map<string,Promise<void>>();
    return {
      label:'小工具本地缓存',
      async get(key) {
        let result:{data:string|null};
        try { result=await api.getStorage!({key}); } catch { throw Error('本地存档暂时读不到，请重新加载后重试。原存档未覆盖。'); }
        if(typeof result?.data==='string')return result.data;
        if(result?.data!==null)throw Error('本地存档返回异常，请重新加载后重试。原存档未覆盖。');
        // An empty native slot can import the old browser save once. Never mask a native read failure.
        try{return browser?.getItem(key)??null;}catch{return null;}
      },
      set(key,data) {
        // Serialize immutable payloads so a slow earlier acknowledgement cannot overwrite a later choice.
        const request=(queues.get(key)??Promise.resolve()).then(async()=>{await api.setStorage!({key,data});});
        queues.set(key,request.catch(()=>{}));return request;
      },
    };
  }
  return {
    label:'本机浏览器',
    async get(key){try{if(!browser)throw Error('Storage unavailable');return browser.getItem(key);}catch{throw Error('本地存档暂时读不到，请检查存储权限后重新加载。原存档未覆盖。');}},
    set(key,value){if(!browser)throw Error('Storage unavailable');browser.setItem(key,value);},
  };
}
