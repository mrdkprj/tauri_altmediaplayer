import {listen, emit, Event, EventName} from "@tauri-apps/api/event"
import { invoke } from "@tauri-apps/api/tauri";

export class IPCBase{

    invoke = async <K extends keyof TauriCommandMap>(channel:K, data:TauriCommandMap[K]["Request"]): Promise<TauriCommandMap[K]["Response"]> => {
        return await invoke<TauriCommandMap[K]["Response"]>(channel, data);
    }

}

export class IPC extends IPCBase {

    label:RendererName;

    constructor(label:RendererName){
        super();
        this.label = label;
    }

    async init(){
        await this.receive("after-change-theme", () => {})
    }

    private changeTheme = (them:Mp.Theme) => {
        if(them === "Dark"){
            document.documentElement.removeAttribute("light")
        }else{
            document.documentElement.removeAttribute("dark")
        }
        document.documentElement.setAttribute(them, "")
    }

    private listener = <K extends keyof RendererChannelEventMap>(e:Event<MainEvent<K>>, handler: (e: RendererChannelEventMap[K]) => void) => {

        if(e.event === "after-change-theme"){
            return this.changeTheme((e.payload.data as Mp.ChangeThemeEvent).theme);
        }

        if(e.payload.target === this.label){
            return handler(e.payload.data)
        }

    }

    private tauriListener = <T>(e:Event<T>, handler:(e:T) => void) => {

        if(e.windowLabel === this.label){
            handler(e.payload)
        }
    }

    receive = async <K extends keyof RendererChannelEventMap>(channel:K, handler: (e: RendererChannelEventMap[K]) => void) => {
        await listen<MainEvent<K>>(channel, e => this.listener(e, handler));
    }

    receiveTauri = async <T>(event: EventName, handler: (e:T) => void) => {
        await listen<T>(event, e => this.tauriListener(e, handler))
    }

    private sender = async <K extends keyof MainChannelEventMap>(channel: K, data: MainChannelEventMap[K]) => {
        await emit(channel, {data, source:this.label})
    }

    send = async <K extends keyof MainChannelEventMap>(channel: K, data: MainChannelEventMap[K]) => {
        await this.sender(channel, data)
    }

}

export class IPCMain extends IPCBase {

    private listener = <K extends keyof MainChannelEventMap>(e:Event<RendererEvent<K>>, handler: (e: MainChannelEventMap[K]) => void) => {

        if(e.payload.source) {
            handler(e.payload.data)
        }
    }

    async receive<K extends keyof MainChannelEventMap>(channel:K, handler: (data: MainChannelEventMap[K]) => void){
        return await listen<RendererEvent<K>>(channel, e => this.listener(e, handler));
    }

    send = async <K extends keyof RendererChannelEventMap>(rendererName:RendererName, channel:K, data:RendererChannelEventMap[K]) => {
        await emit(channel, {data, target:rendererName});
    }

}