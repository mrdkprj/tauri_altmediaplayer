import {Event} from "@tauri-apps/api/event"
import { LogicalPosition, LogicalSize, appWindow } from '@tauri-apps/api/window'
import { ContextMenu } from "./contextmenu";
import { IPC } from "../ipc";

const ipc = new IPC(appWindow.label as RendererName)
const windowId = appWindow.label as RendererName;
const menus:{[key in ContextMenuName]:ContextMenu} = {
    "PlayerMenu": new ContextMenu("PlayerMenu"),
    "PlaylistMenu": new ContextMenu("PlaylistMenu"),
    "SortMenu": new ContextMenu("SortMenu"),
};
const bound = {
    right:screen.availWidth,
    bottom:screen.availHeight
}

let currentMenu:ContextMenu | null = null;
let ignore = false;

window.addEventListener("contextmenu", e => e.preventDefault());

const getPosition = (menu:ContextMenu, mousePosition:Mp.Position) => {

    const size = menu.size;
    const position = {
        revert:false,
        x:mousePosition.x,
        y:mousePosition.y,
    }

    const right = mousePosition.x + size.outerWidth
    const bottom = mousePosition.y + size.outerHeight

    if(bottom >= bound.bottom) position.y = position.y - size.innerHeight;

    if(right >= bound.right){
        position.x = position.x - size.outerWidth;
        position.revert = true;
    }

    return position;
}

const show = async (e: Mp.ContextMenuEvent) => {

    ignore = false;

    await ipc.invoke("clickthru", {ignore, id:windowId})

    if(currentMenu){
        document.body.removeChild(currentMenu.menu)
    }
    currentMenu = menus[e.target];
    document.body.append(currentMenu.menu)

    const position = getPosition(currentMenu, e);

    currentMenu.show(position.revert);

    await appWindow.setSize(new LogicalSize(currentMenu.size.outerWidth, currentMenu.size.outerHeight))

    await appWindow.setPosition(new LogicalPosition(position.x, position.y ))
    await appWindow.show()
}

const onMenuItemClick = async (e:Mp.MenuItemClickEvent) => {
    await hide();
    await ipc.send("context-menu-item-click", {contextMenuName:e.contextMenuName, data:e});
}

const build = async (e: Mp.ContextMenuBuildRequest) => {
    e.options.forEach(option => {
        const menu = menus[option.name]
        menu.build(option.menus)
        menu.onClick(onMenuItemClick);
    })

}

const hide = async () => {
    if(currentMenu){
        document.body.removeChild(currentMenu.menu)
        currentMenu = null;
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
appWindow.listen<Mp.Position>("WM_MOUSEMOVE", onFowardedMouseMove)
ipc.receive("build-menu", build)
ipc.receive("popup-context-menu", show);

window.addEventListener("DOMContentLoaded", async () => {
    await ipc.init();
})

window.addEventListener("mousemove", onMouseMove)

