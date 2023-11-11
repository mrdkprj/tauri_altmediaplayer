import {Event} from "@tauri-apps/api/event"
import { LogicalPosition, LogicalSize, appWindow } from '@tauri-apps/api/window'
import { ContextMenuBuilder } from "./builder";
import { IPC } from "../ipc";

const ipc = new IPC(appWindow.label as RendererName)
const windowId = appWindow.label as RendererName;
const menus:{[key in ContextMenuName]:ContextMenuBuilder} = {
    "PlayerMenu": new ContextMenuBuilder("PlayerMenu"),
    "PlaylistMenu": new ContextMenuBuilder("PlaylistMenu"),
    "SortMenu": new ContextMenuBuilder("SortMenu"),
};
let currentBuilder:ContextMenuBuilder | null = null;
let ignore = false;

window.addEventListener("contextmenu", e => e.preventDefault());

const show = async (e: Mp.ContextMenuEvent) => {

    ignore = false;

    await ipc.invoke("clickthru", {ignore, id:windowId})

    if(currentBuilder){
        document.body.removeChild(currentBuilder.menu)
    }
    currentBuilder = menus[e.target];
    document.body.append(currentBuilder.menu)

    console.log(e.x + currentBuilder.size.innerWidth)
    console.log(e.y + currentBuilder.size.innerHeight)
    await appWindow.setSize(new LogicalSize(currentBuilder.size.outerWidth, currentBuilder.size.outerHeight))
    await appWindow.setPosition(new LogicalPosition(e.x, e.y ))
    await appWindow.show()
}

const onMenuItemClick = async (e:Mp.MenuItemClickEvent) => {
    await hide();
    await ipc.send("context-menu-item-click", {contextMenuName:e.contextMenuName, data:e});
}

const build = async (e: Mp.ContextMenuBuildRequest) => {
    e.options.forEach(option => {
        const builder = menus[option.name]
        builder.build(option.menus)
        builder.onClick(onMenuItemClick);
    })

}

const hide = async () => {
    if(currentBuilder){
        document.body.removeChild(currentBuilder.menu)
        currentBuilder = null;
    }

    await appWindow.hide()
}

const onFowardedMouseMove = async (e:Event<Mp.Position>) => {

    if(!ignore) return;

    const {x, y} = e.payload;

    if(document.elementFromPoint(x, y)?.tagName == "DIV"){
        ignore = !ignore;
        await ipc.invoke("clickthru", {ignore, id:windowId})
    }

}

const onMouseMove = async (e:MouseEvent) => {

    if(ignore) return;

    if(document.elementFromPoint(e.clientX, e.clientY)?.tagName !== "DIV"){
        ignore = !ignore;
        await ipc.invoke("clickthru", {ignore, id:windowId})
    }
}

appWindow.listen("tauri://blur", hide)
appWindow.listen<Mp.Position>("nmouse", onFowardedMouseMove)
ipc.receive("build-menu", build)
ipc.receive("popup-context-menu", show);

window.addEventListener("DOMContentLoaded", async () => {
    await ipc.init();
})

window.addEventListener("mousemove", onMouseMove)

