import { DomElement } from "../dom"
import { handleShortcut } from "../shortcut";
import { AudioExtentions, VideoExtentions } from "../constants";
import { extname } from "../path";
import { IPC } from "../ipc";

const ipc = new IPC("Playlist")
const List_Item_Padding = 10;

const Dom = {
    playlist: new DomElement("playlist"),
    playlistTitleBar:new DomElement("playlistTitleBar"),
    playlistFooter:new DomElement("playlistFooter"),
    fileList:new DomElement("fileList"),
    fileListContainer:new DomElement("fileListContainer"),
    renameInput:new DomElement<HTMLInputElement>("rename"),
    sortBtn: new DomElement("sort"),
}

const selection:Mp.PlaylistItemSelection ={
    selectedId:"",
    selectedIds:[]
}

const dragState:Mp.PlaylistDragState = {
    dragging: false,
    startElement:undefined,
    targetElement:undefined,
    startIndex: -1,
    working:false,
}

const RenameState = {
    renaming:false,
    data:{
        fileId:"",
        oldName:"",
        newName:""
    }

}
const undoStack:Mp.RenameData[] = []
const redoStack:Mp.RenameData[] = []

let currentElement:HTMLElement | undefined;
let selectedElement:HTMLElement | undefined;
let fileListContainerRect:DOMRect;

const onContextMenu = async (e:MouseEvent) => {

    e.preventDefault()

    await ipc.send("open-context-menu", {target:"PlaylistMenu", x:e.screenX, y:e.screenY})

}

const onKeydown = async (e:KeyboardEvent) => {

    if(RenameState.renaming) return;

    if(e.key === "Enter"){
        return await ipc.send("toggle-play", {})
    }

    if(e.ctrlKey && e.key === "a"){
        return selectAll();
    }

    if(e.ctrlKey && e.key === "z"){
        return undoRename();
    }

    if(e.ctrlKey && e.key === "y"){
        return redoRename();
    }

    if(e.key === "ArrowUp" || e.key === "ArrowDown"){
        e.preventDefault();
        return moveSelection(e.key);
    }

    return handleShortcut("Playlist", e);
}

const onRenameInputKeyDown = (e:KeyboardEvent) => {
    if(RenameState.renaming && e.key === "Enter"){
        endEditFileName();
    }
}

const onClick = async (e:MouseEvent) => {
    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.id === "shuffleBtn"){
        toggleShuffle();
    }

    if(e.target.id === "sort"){
        await ipc.send("open-context-menu", {target:"SortMenu", x:e.screenX, y:e.screenY})
    }

}

const onMouseDown = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.classList.contains("playlist-item")){

        if(e.button === 2 && selection.selectedIds.length > 1){
            if(selection.selectedIds.includes(e.target.id)){
                return;
            }
        }

        toggleSelect(e)

    }else{
        clearSelection();
    }
}

const onDragStart = (e:DragEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    e.stopPropagation();
    dragState.dragging = true;
    dragState.startElement = e.target;
    dragState.startIndex = getChildIndex(e.target)

}

const onDragEnter = (e:DragEvent) => {
    if(dragState.dragging){
        toggleHighlightDropTarget(e);
    }
}

const onDragEnd = (e:DragEvent) => {
    if(dragState.dragging){
        endDragPlaylistItem(e)
    }
}

const onResize = () => {
    fileListContainerRect = Dom.fileListContainer.element.getBoundingClientRect()
}

const onFileDrop = async (files:string[]) => {

    if(dragState.dragging) return;

    const dropItems = files.filter(path => AudioExtentions.includes(extname(path)) || VideoExtentions.includes(extname(path)))

    if(dropItems.length){
        await ipc.send("drop", {files:dropItems, renderer:"Playlist"})
    }
}

const removeFromPlaylist = (data:Mp.RemovePlaylistItemResult) => {
    clearSelection();
    const targetNodes = data.removedFileIds.map(id => new DomElement(id).element)
    targetNodes.forEach(node => {
        if(currentElement && node.id === currentElement.id){
            currentElement = undefined;
        }
        Dom.fileList.element.removeChild(node)
    })
}

const toggleHighlightDropTarget = (e:DragEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(!dragState.dragging) return;

    dragState.targetElement?.classList.remove("draghover");

    dragState.targetElement = e.target;

    if(dragState.targetElement.id === dragState.startElement?.id) return;

    dragState.targetElement.classList.add("draghover")

}

const endDragPlaylistItem = async (e:DragEvent) => {

    dropPlaylistItem();
    toggleHighlightDropTarget(e)

    const args = {
        start:dragState.startIndex,
        end:getChildIndex(dragState.startElement),
        currentIndex:getChildIndex(currentElement)
    }

    await ipc.send("change-playlist-order", args);
    await ipc.send("playlist-item-selection-change", {selection})

    dragState.dragging = false;
    dragState.startElement = undefined;
    dragState.startIndex = -1;
    dragState.targetElement = undefined;
}

const dropPlaylistItem = () => {

    if(!dragState.dragging || !dragState.startElement || !dragState.targetElement) return;

    const currentIndex = selection.selectedIds.indexOf(dragState.startElement.id);
    const dropTargetIndex = getChildIndex(dragState.targetElement)
    if(dropTargetIndex > dragState.startIndex){
        dragState.targetElement.parentNode?.insertBefore(dragState.startElement, dragState.targetElement.nextElementSibling);
    }else{
        dragState.targetElement.parentNode?.insertBefore(dragState.startElement, dragState.targetElement);
    }
    selection.selectedIds[currentIndex] = dragState.startElement.id;

    scrollToElement(dragState.startElement)

}

const clearPlaylist = () => {
    selection.selectedId = "";
    selection.selectedIds = []
    currentElement = undefined;
    Dom.fileList.element.innerHTML = "";
}

const clearSelection = async () => {
    selection.selectedIds.forEach(id => new DomElement(id).element.classList.remove("selected"))
    selection.selectedIds.length = 0;
    await ipc.send("playlist-item-selection-change", {selection})
}

const toggleSelect = (e:MouseEvent) => {

    if(e.ctrlKey){
        selectByCtrl(e)
        return;
    }

    if(e.shiftKey){
        selectByShift(e);
        return
    }

    selectByClick(e);

}

const select = async (target:HTMLElement | string) => {

    clearSelection();

    const targetElement = typeof target === "string" ? new DomElement(target).element : target;

    selectedElement = targetElement;

    selection.selectedIds.push(selectedElement.id)
    selection.selectedId = selectedElement.id;

    selectedElement.classList.add("selected")

    scrollToElement(selectedElement)

    await ipc.send("playlist-item-selection-change", {selection})
}

const selectByClick = (e:MouseEvent) => {
    select(e.target as HTMLElement);
}

const selectByShift = async (e:MouseEvent) => {

    clearSelection();

    const range = [];

    if(selectedElement){
        range.push(getChildIndex(selectedElement));
    }else{
        range.push(0);
    }

    range.push(getChildIndex(e.target as HTMLElement));

    range.sort((a,b) => a - b);

    for(let i = range[0]; i <= range[1]; i++){
        selection.selectedIds.push(Dom.fileList.element.children[i].id);
        Dom.fileList.element.children[i].classList.add("selected")
    }

    await ipc.send("playlist-item-selection-change", {selection})
}

const selectByCtrl = async (e:MouseEvent) => {

    if(!selectedElement){
        selectByClick(e);
        return;
    }

    const target = (e.target as HTMLElement);
    selection.selectedIds.push(target.id)

    target.classList.add("selected")

    await ipc.send("playlist-item-selection-change", {selection})
}

const selectAll = async () => {

    clearSelection();

    Array.from(Dom.fileList.element.children).forEach((node,_index) => {
        node.classList.add("selected")
        selection.selectedIds.push(node.id);
    })

    await ipc.send("playlist-item-selection-change", {selection})

}

const moveSelection = (key:string) => {

    if(!Dom.fileList.element.children.length) return;

    const currentId = selection.selectedId ? selection.selectedId : Dom.fileList.element.children[0].id

    const findNext = (key:string, element:Element):Element | null => {

        const nextElement = key === "ArrowDown" ? element.nextElementSibling : element.previousElementSibling

        if(!nextElement) return null;

        if(nextElement.classList.contains("separator")){
            return findNext(key, nextElement);
        }

        return nextElement;
    }

    const nextElement = findNext(key, new DomElement(currentId).element)

    if(!nextElement) return;

    clearSelection();
    select(nextElement.id)
}

const onFileListItemClicked = async (e:MouseEvent) => {
    const index = getChildIndex(e.target as HTMLElement);
    await ipc.send("load-file", {index, isAbsolute:true});
}

function getChildIndex(node:HTMLElement | undefined) {
    if(!node) return -1;

    return Array.prototype.indexOf.call(Dom.fileList.element.childNodes, node);
}

const scrollToElement = (element:HTMLElement | undefined) => {

    if(!element) return;

    const rect = element.getBoundingClientRect();
    if(rect.top <= fileListContainerRect.top){
        element.scrollIntoView(true)
    }

    if(rect.bottom > fileListContainerRect.height + fileListContainerRect.top + 5){
        element.scrollIntoView(false)
    }

}

const changeCurrent = (data:Mp.FileLoadEvent) => {

    if(currentElement){
        currentElement.classList.remove("current");
    }

    if(data.currentFile.id){
        currentElement = new DomElement(data.currentFile.id).element;
        currentElement.classList.add("current");
        select(data.currentFile.id)
    }
}

const requestRename = async (id:string, name:string) => {
    preventRenameBlur(true)
    await ipc.send("rename-file", {id, name})
}

const onRename = (data:Mp.RenameResult) => {

    if(!selectedElement) return;

    if(selectedElement.id !== data.file.id){
        select(data.file.id);
    }

    if(data.error && RenameState.renaming){
        undoStack.pop();
        startEditFileName();
        return;
    }

    const fileName = data.file.name

    selectedElement.textContent = fileName
    selectedElement.title = fileName

    hideRenameField();

}

const undoRename = () => {

    const stack = undoStack.pop();

    if(!stack) return;

    redoStack.push(stack);

    select(stack.fileId)

    requestRename(stack.fileId, stack.oldName)

}

const redoRename = () => {

    const stack = redoStack.pop();

    if(!stack) return;

    undoStack.push(stack);

    select(stack.fileId)

    requestRename(stack.fileId, stack.newName)

}

const startEditFileName = () => {

    if(!selectedElement) return;

    const fileName = selectedElement.textContent ?? "";

    RenameState.renaming = true;
    RenameState.data.fileId = selectedElement.id;
    RenameState.data.oldName = fileName;

    const rect = selectedElement.getBoundingClientRect();
    Dom.renameInput.element.style.top = rect.top + "px"
    Dom.renameInput.element.style.left = rect.left + "px"
    Dom.renameInput.element.style.width = selectedElement.offsetWidth - List_Item_Padding + "px";
    Dom.renameInput.element.style.height = selectedElement.offsetHeight - List_Item_Padding + "px";
    Dom.renameInput.element.value = fileName;
    Dom.renameInput.element.style.display = "block"
    selectFileName(fileName);

    preventRenameBlur(false);
}

const selectFileName = (fileName:string) => {
    Dom.renameInput.element.focus();
    Dom.renameInput.element.setSelectionRange(0, fileName.lastIndexOf("."));
}

const preventRenameBlur = (disable:boolean) => {

    if(disable){
        Dom.renameInput.element.removeEventListener("blur", endEditFileName);
    }else{
        Dom.renameInput.element.addEventListener("blur", endEditFileName);
    }

}

const endEditFileName = () => {

    if(RenameState.data.oldName === Dom.renameInput.element.value){
        hideRenameField();
    }else{
        RenameState.data.newName = Dom.renameInput.element.value;
        undoStack.push({...RenameState.data})
        requestRename(RenameState.data.fileId, RenameState.data.newName);
    }

}

const hideRenameField = () => {
    RenameState.renaming = false;
    Dom.renameInput.element.style.display = "none"
}

const onReset = () => {
    currentElement = undefined;
    selectedElement = undefined;
    clearPlaylist();
}

const toggleShuffle = async () => {

    if(Dom.playlistFooter.element.classList.contains("shuffle")){
        Dom.playlistFooter.element.classList.remove("shuffle")
    }else{
        Dom.playlistFooter.element.classList.add("shuffle")
    }

    await ipc.send("toggle-shuffle", {})
}

const createListItem = (file:Mp.MediaFile) => {

    const item = document.createElement("div");
    item.title = file.name
    item.id = file.id;
    item.textContent = file.name
    item.draggable = true;
    item.classList.add("playlist-item")
    item.addEventListener("dblclick", onFileListItemClicked);
    item.addEventListener("dragstart", onDragStart)
    item.addEventListener("dragenter", onDragEnter)
    item.addEventListener("dragend", onDragEnd)
    return item
}


const addToPlaylist = (data:Mp.PlaylistChangeEvent) => {

    if(data.clearPlaylist){
        clearPlaylist();
    }

    if(!data.files.length) return;

    const fragment = document.createDocumentFragment();

    let key = ""

    data.files.forEach(file => {

        const item = createListItem(file);

        if(file.dir != key){
            key = file.dir;
        }

        if(file.id === currentElement?.id){
            item.classList.add("current")
            currentElement = item;
        }

        fragment.appendChild(item);

    });

    Dom.fileList.element.appendChild(fragment)

    if(currentElement){
        select(currentElement);
    }

}

const applySortType = (config:Mp.SortType) => {

    Dom.sortBtn.element.setAttribute("data-sort", config.order)

    Dom.fileList.element.classList.remove("group-by")
    if(config.groupBy){
        Dom.fileList.element.classList.add("group-by")
    }

}

const prepare = async (e:Mp.ReadyEvent) => {
    applySortType(e.config.sort)
}

ipc.receive("after-ready", prepare);
ipc.receive("after-sort-type-change", applySortType)
ipc.receive("after-playlist-change", addToPlaylist)
ipc.receive("after-file-load", changeCurrent)
ipc.receive("after-remove-playlist", removeFromPlaylist)
ipc.receive("after-rename", onRename);
ipc.receive("after-start-rename", startEditFileName)
ipc.receive("after-restart", onReset)
ipc.receive("after-clear-playlist", clearPlaylist)
ipc.receiveTauri<string[]>("tauri://file-drop", onFileDrop)

window.addEventListener("DOMContentLoaded", async () => {

    Dom.fileListContainer.element.addEventListener("mousedown", onMouseDown)
    fileListContainerRect = Dom.fileListContainer.element.getBoundingClientRect();
    Dom.renameInput.element.addEventListener("blur", endEditFileName)
    Dom.renameInput.element.addEventListener("keydown", onRenameInputKeyDown)

    new DomElement("closePlaylistBtn").element.addEventListener("click", async () => await ipc.send("close-playlist", {}))

    window.addEventListener("resize", onResize)

    await ipc.init();

})

window.addEventListener("contextmenu", onContextMenu)

window.addEventListener("keydown",onKeydown)
document.addEventListener("click", onClick)
document.addEventListener("dragover", e => e.preventDefault())

export {}