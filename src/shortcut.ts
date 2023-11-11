import { IPC } from "./ipc";

const ipc = new IPC("Player");

export const handleShortcut = async (renderer:RendererName, e:KeyboardEvent) => {

    if(renderer === "Player"){
        await handlePlayerShortcut(e);
    }

    if(renderer === "Playlist"){
        await handlePlaylistShortcut(e);
    }

}

const handlePlayerShortcut = async (e:KeyboardEvent) => {
    if(e.key === "F11"){
        e.preventDefault();
        return await ipc.send("shortcut", {renderer:"Player", menu:"ToggleFullscreen"})
    }

    if(e.ctrlKey && e.key === "s"){
        return await ipc.send("shortcut", {renderer:"Player", menu:"Capture"})
    }

    if(e.ctrlKey && e.key === "p"){
        return await ipc.send("shortcut", {renderer:"Player", menu:"TogglePlaylistWindow"})
    }

}

const handlePlaylistShortcut = async (e:KeyboardEvent) => {


    if(e.key === "Delete"){
        return await ipc.send("shortcut", {renderer:"Playlist", menu:"Remove"})
    }

    if(e.shiftKey && e.key === "Delete"){
        return await ipc.send("shortcut", {renderer:"Playlist", menu:"Trash"})
    }

    if(e.ctrlKey && e.shiftKey && e.key === "C"){
        return await ipc.send("shortcut", {renderer:"Playlist", menu:"CopyFullpath"})
    }

    if(e.ctrlKey && e.key === "c"){
        return await ipc.send("shortcut", {renderer:"Playlist", menu:"CopyFileName"})
    }

    if(e.ctrlKey && e.key === "r"){
        e.preventDefault();
        return await ipc.send("shortcut", {renderer:"Playlist", menu:"Reveal"})
    }

    if(e.key == "F2"){
        return await ipc.send("shortcut", {renderer:"Playlist", menu:"Rename"})
    }
}