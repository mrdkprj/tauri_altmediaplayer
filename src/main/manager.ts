import * as dialog from "@tauri-apps/api/dialog"
import * as fs from "@tauri-apps/api/fs";
import { relaunch } from '@tauri-apps/api/process';
import { PhysicalPosition, PhysicalSize, WebviewWindow } from '@tauri-apps/api/window'
import { writeText } from '@tauri-apps/api/clipboard';
import { Command } from '@tauri-apps/api/shell'
import Util, {EmptyFile} from "./util";
import Config from "./config";
import Helper from "./helper";
import { AudioExtentions, AudioFormats, VideoFormats } from "../constants";
import * as path from "../path"
import { IPCMain } from "../ipc";

const ipc = new IPCMain();
const util = new Util();
const config = new Config();
const helper = new Helper();

(async() => {
    await config.build();
})()

const playlistFiles:Mp.MediaFile[] = []

let mediaPlayStatus:Mp.PlayStatus;
let doShuffle = false;
let currentIndex = -1;
const playlistSelection:Mp.PlaylistItemSelection = {selectedId:"", selectedIds:[]};
let randomIndices:number[] = [];

const Renderers:Renderer = {
    Player:null,
    Playlist:null,
    Convert:null,
    ContextMenu:null,
}

const showErrorMessage = async (ex:any) => {
    if(ex.message){
        await dialog.message(ex.message)
    }else{
        await dialog.message(ex)
    }
}

const onPlayerReady = async () => {

    Renderers.Player = WebviewWindow.getByLabel("Player")
    Renderers.Playlist = await helper.createPlaylist();
    Renderers.ContextMenu = await helper.createContextMenu();

    await Renderers.ContextMenu?.hide();

    await changeTheme(config.data.theme);

    await Renderers.Player?.setSize(new PhysicalSize(config.data.bounds.size.width, config.data.bounds.size.height))
    await Renderers.Player?.setPosition(new PhysicalPosition(config.data.bounds.position.x, config.data.bounds.position.y))
    await Renderers.Player?.show();

    if(config.data.isMaximized){
        await Renderers.Player?.maximize();
    }

    await Renderers.Playlist?.setSize(new PhysicalSize(config.data.playlistBounds.size.width, config.data.playlistBounds.size.height))
    await Renderers.Playlist?.setPosition(new PhysicalPosition(config.data.playlistBounds.position.x, config.data.playlistBounds.position.y))

    if(config.data.playlistVisible){
        await Renderers.Playlist?.show();
    }

    await ipc.send("Player", "after-ready", {config:config.data});
    await ipc.send("Playlist", "after-ready", {config:config.data});

    const buildMenuOptions:Mp.ContextMenuBuildOption[] = [
        {"name":"PlayerMenu", menus:helper.getPlayerContextMenu(config.data)},
        {"name":"PlaylistMenu", menus:helper.getPlaylistContextMenu()},
        {"name":"SortMenu", menus:helper.getPlaylistSortContextMenu(config.data)},
    ]

    await ipc.send("ContextMenu", "build-menu", {options:buildMenuOptions})

    await changeTheme(config.data.theme);

    await togglePlay();

    await initPlaylist(util.extractFilesFromArgv())

}

const loadMediaFile = async (autoPlay:boolean) => {
    const currentFile = getCurrentFile();
    await ipc.send("Player", "after-file-load", {currentFile, autoPlay})
    await ipc.send("Playlist", "after-file-load", {currentFile, autoPlay})
}

const initPlaylist = async (fullPaths:string[]) => {

    await reset();

    const files = await Promise.all(fullPaths.map(async fullPath => await util.toFile(fullPath)))
    files.forEach(file => playlistFiles.push(file))

    if(!playlistFiles.length) return;

    currentIndex = 0;

    await ipc.send("Playlist", "after-playlist-change", {files:playlistFiles, clearPlaylist:true})

    sortPlayList();

    shuffleList();

    await loadMediaFile(true);

}

const addToPlaylist = async (fullPaths:string[]) => {

    const newFiles = await Promise.all(fullPaths.filter(fullPath => playlistFiles.findIndex(file => file.fullPath == fullPath) < 0).map( async fullPath => await util.toFile(fullPath)));

    playlistFiles.push(...newFiles)

    await ipc.send("Playlist", "after-playlist-change", {files:newFiles, clearPlaylist:false})

    sortPlayList();

    shuffleList();

    if(playlistFiles.length && currentIndex < 0){
        currentIndex = 0;
        await loadMediaFile(false);
    }

}

const getCurrentFile = () => {

    if(currentIndex < 0) return EmptyFile;

    if(!playlistFiles.length) return EmptyFile;

    return playlistFiles[currentIndex];

}

const reset = async () => {
    playlistFiles.length = 0;
    randomIndices.length = 0;
    currentIndex = -1;
    await ipc.send("Playlist", "after-clear-playlist", {})
}

const playerContextMenuCallback = async (menu:Mp.PlayerContextMenuType, args?:Mp.SubMenuName) => {
    switch(menu){
        case "PlaybackSpeed":
            changePlaybackSpeed(Number(args));
            break;
        case "SeekSpeed":
            changeSeekSpeed(Number(args));
            break;
        case "TogglePlaylistWindow":
            togglePlaylistWindow();
            break;
        case "FitToWindow":
            changeSizeMode();
            break;
        case "PictureInPicture":
            await ipc.send("Player", "after-picture-in-picture", {});
            break;
        case "ToggleFullscreen":
            await ipc.send("Player", "after-toggle-fullscreen", {})
            break;
        case "Theme":
            changeTheme(args as Mp.Theme);
            break;
        case "Capture":
            await ipc.send("Player", "after-capture-media", {});
            break;
    }
}

const playlistContextMenuCallback = async (menu:Mp.PlaylistContextMenuType, args?:Mp.SubMenuName) => {

    switch(menu){
        case "Remove":
            removeFromPlaylist(playlistSelection.selectedIds);
            break;
        case "RemoveAll":
            clearPlaylist();
            break;
        case "Trash":
            requestReleaseFile(playlistSelection.selectedIds);
            break;
        case "CopyFileName":
            copyFileNameToClipboard(false);
            break;
        case "CopyFullpath":
            copyFileNameToClipboard(true);
            break;
        case "Reveal":
            reveal();
            break;
        case "Metadata":
            displayMetadata();
            break;
        case "Convert":
            openConvertDialog();
            break;
        case "Sort":
            changeSortOrder(args as Mp.SortOrder);
            break;
        case "Rename":
            await ipc.send("Playlist", "after-start-rename", {})
            break;
        case "LoadList":
            loadPlaylistFile();
            break;
        case "SaveList":
            savePlaylistFile();
            break;
        case "GroupBy":
            toggleGroupBy();
            break;
    }
}

const changeSizeMode = () => {
    config.data.video.fitToWindow = !config.data.video.fitToWindow
    ipc.send("Player", "after-change-display-mode", {config:config.data})
}

const changeTheme = async (theme:Mp.Theme) => {
    config.data.theme = theme;
    await ipc.send("Player", "after-change-theme", {theme})
}

const toggleMaximize = async () => {

    if(!Renderers.Player) return;

    const maximized = await Renderers.Player.isMaximized();

    if(maximized){
        await Renderers.Player.unmaximize();
        await Renderers.Player.setSize(new PhysicalSize(config.data.bounds.size.width, config.data.bounds.size.height))
        await Renderers.Player.setPosition(new PhysicalPosition(config.data.bounds.position.x, config.data.bounds.position.y))
    }else{
        const {width, height} = await Renderers.Player.innerSize()
        config.data.bounds.size = {width, height}
        const {x, y} = await Renderers.Player.innerPosition();
        config.data.bounds.position = {x, y}
        await Renderers.Player.maximize();
    }
}

const saveConfig = async (data:Mp.MediaState) => {

    if(!Renderers.Player || !Renderers.Playlist) return;

    try{
        config.data.isMaximized = await Renderers.Player.isMaximized();
        const {width, height} = await Renderers.Playlist.innerSize()
        config.data.playlistBounds.size = {width, height}
        const {x, y} = await Renderers.Playlist.innerPosition();
        config.data.playlistBounds.position = {x, y}
        config.data.audio.volume = data.videoVolume;
        config.data.audio.ampLevel = data.ampLevel;
        config.data.video.fitToWindow = data.fitToWindow;
        config.data.audio.mute = data.mute;

        await config.save();
    }catch(ex){
        return showErrorMessage(ex);
    }
}

const closeWindow = async (data:Mp.CloseRequest) => {
    await saveConfig(data.mediaState);
    Renderers.Player?.close();
}

const shuffleList = () => {

    if(!doShuffle) return;

    const target = new Array(playlistFiles.length).fill(undefined).map((_v, i) => i).filter(i => i !== currentIndex);
    randomIndices = util.shuffle(target)

}

const getRandomIndex = (value:number) => {

    if(value > 0){
        randomIndices.unshift(currentIndex);
        return randomIndices.pop() as number;
    }

    randomIndices.push(currentIndex);
    return randomIndices.shift() as number;

}

const changeIndex = (index:number) => {

    let nextIndex = doShuffle ? getRandomIndex(index) : currentIndex + index;

    if(nextIndex >= playlistFiles.length){
        nextIndex = 0;
    }

    if(nextIndex < 0){
        nextIndex = playlistFiles.length - 1
    }

    currentIndex = nextIndex;

    loadMediaFile(false);
}

const selectFile = (index:number) => {
    currentIndex = index;
    loadMediaFile(true);
}

const changePlayStatus = (data:Mp.ChangePlayStatusRequest) => {

    mediaPlayStatus = data.status;

    // Renderers.Player?.setThumbarButtons([])

    // if(mediaPlayStatus == "playing"){
    //     Renderers.Player?.setThumbarButtons(thumButtons[1])
    // }else{
    //     Renderers.Player?.setThumbarButtons(thumButtons[0])
    // }

}

const togglePlay = async () => {
    await ipc.send("Player", "after-toggle-play", {})
}

const dropFiles = (data:Mp.DropRequest) => {

    if(data.renderer === "Playlist"){
        addToPlaylist(data.files)
    }

    if(data.renderer === "Player"){
        initPlaylist(data.files)
    }

}

const changePlaylistItemOrder = (data:Mp.ChangePlaylistOrderRequet) => {

    if(data.start === data.end) return;

    const replacing = playlistFiles.splice(data.start, 1)[0];
    playlistFiles.splice(data.end, 0, replacing)

    currentIndex = data.currentIndex;
}

const clearPlaylist = () => {

    reset();
    loadMediaFile(false);

}

const removeFromPlaylist = (selectedIds:string[]) => {

    if(!selectedIds.length) return;

    const removeIndices = playlistFiles.filter(file => selectedIds.includes(file.id)).map(file => playlistFiles.indexOf(file))
    const isCurrentFileRemoved = removeIndices.includes(currentIndex);

    const newFiles = playlistFiles.filter((_,index) => !removeIndices.includes(index));
    playlistFiles.length = 0;
    playlistFiles.push(...newFiles)

    ipc.send("Playlist", "after-remove-playlist", {removedFileIds:selectedIds})

    currentIndex = getIndexAfterRemove(removeIndices)

    if(isCurrentFileRemoved){
        loadMediaFile(false);
    }

}

const getIndexAfterRemove = (removeIndices:number[]) => {

    if(removeIndices.includes(currentIndex)){

        if(!playlistFiles.length) return -1;

        const nextIndex = removeIndices[0]

        if(nextIndex >= playlistFiles.length){
            return playlistFiles.length - 1
        }

        return nextIndex;
    }

    if(removeIndices[0] < currentIndex){
        return currentIndex - removeIndices.length
    }

    return currentIndex

}

const requestReleaseFile = (selectedIds:string[]) => {

    if(!selectedIds.length) return;

    ipc.send("Player", "after-release-file", {fileIds:selectedIds})

}

const deleteFile = async (data:Mp.ReleaseFileRequest) => {

    if(!data.fileIds.length) return;

    try{

        const targetFilePaths = playlistFiles.filter(file => data.fileIds.includes(file.id)).map(file => file.fullPath);

        if(!targetFilePaths.length) return;

        await Promise.all(targetFilePaths.map(async item => await fs.removeFile(item)))

        removeFromPlaylist(data.fileIds);

    }catch(ex){
        showErrorMessage(ex);
    }
}

const reveal = async () => {

    if(!playlistSelection.selectedId) return;

    const file = playlistFiles.find(file => file.id == playlistSelection.selectedId)

    if(!file) return;

    const command = new Command("run-explorer", ["/e,/select,", file.fullPath])
    await command.spawn()
}

const copyFileNameToClipboard = async (fullPath:boolean) => {

    if(!playlistSelection.selectedId) return;

    const file = playlistFiles.find(file => file.id == playlistSelection.selectedId)

    if(!file) return;

    await writeText(fullPath ? file.fullPath : file.name);

}

const toggleGroupBy = () => {
    console.log("here")
    config.data.sort.groupBy = !config.data.sort.groupBy
    sortPlayList();
}

const changeSortOrder = (sortOrder:Mp.SortOrder) => {
    config.data.sort.order = sortOrder;
    sortPlayList();
}

const sortPlayList = () => {

    ipc.send("Playlist", "after-sort-type-change", config.data.sort)

    const currentFileId = getCurrentFile().id;

    if(!playlistFiles.length) return;

    if(config.data.sort.groupBy){
        util.sortByGroup(playlistFiles, config.data.sort.order)
    }else{
        util.sort(playlistFiles, config.data.sort.order)
    }

    const sortedIds = playlistFiles.map(file => file.id);

    if(currentFileId){
        currentIndex = sortedIds.findIndex(id => id === currentFileId);
    }

    ipc.send("Playlist", "after-playlist-change", {files:playlistFiles, clearPlaylist:true})

}

const displayMetadata = async () => {

    // const file = playlistFiles.find(file => file.id == playlistSelection.selectedId)
    // if(!file || !Renderers.Player) return;

    // const metadata = await util.getMediaMetadata(file.fullPath)
    // const metadataString = JSON.stringify(metadata, undefined, 2);
    // const result = await dialog.showMessageBox(Renderers.Player, {type:"info", message:metadataString,  buttons:["Copy", "OK"], noLink:true})
    // if(result.response === 0){
    //     clipboard.writeText(metadataString);
    // }
}

const togglePlaylistWindow = () => {

    config.data.playlistVisible = !config.data.playlistVisible;
    if(config.data.playlistVisible){
        Renderers.Playlist?.show();
    }else{
        Renderers.Playlist?.hide();
    }

}

const openConvertDialog = () => {
    const file = playlistFiles.find(file => file.id == playlistSelection.selectedId) ?? EmptyFile
    ipc.send("Convert", "after-open-convert", {file})
    Renderers.Convert?.show();
}

const openConvertSourceFileDialog = async (e:Mp.OpenFileDialogRequest) => {

    if(!Renderers.Convert) return;

    const fullPath = await dialog.open({
        title: "Select file to convert",
        defaultPath: e.fullPath,
        multiple:false,
        filters: [
            { name: "Media File", extensions: VideoFormats.concat(AudioFormats) },
        ],
    })

    if(!fullPath || typeof fullPath !== "string") return;

    const file = await util.toFile(fullPath);
    await ipc.send("Convert", "after-sourcefile-select", {file})

}

const changePlaybackSpeed = (playbackSpeed:number) => {
    ipc.send("Player", "after-change-playback-speed", {playbackSpeed})
}

const changeSeekSpeed = (seekSpeed:number) => {
    ipc.send("Player", "after-change-seek-speed", {seekSpeed});
}

const hideConvertDialog = () => Renderers.Convert?.hide();

const saveCapture = async (data:Mp.CaptureEvent) => {

    const file = getCurrentFile();

    if(!file.id || AudioExtentions.includes(file.extension)) return;

    if(!Renderers.Player) return;

    const defaultPath = await path.join(config.data.path.captureDestDir, `${getCurrentFile().name}-${data.timestamp}.jpeg`)
    const savePath = await dialog.save({
        defaultPath,
        filters: [
            { name: "Image", extensions: ["jpeg", "jpg"] },
        ],
    })

    if(!savePath) return;

    config.data.path.captureDestDir = path.dirname(savePath);

    await fs.writeFile(savePath, atob(data.data));
    //fs.writeFileSync(savePath, data.data, "base64")
}

const startConvert = async (_data:Mp.ConvertRequest) => {

    // if(!Renderers.Convert) return endConvert();

    // const file = await util.toFile(data.sourcePath);

    // if(!util.exists(file.fullPath)) return endConvert();

    // const extension = data.convertFormat.toLocaleLowerCase();
    // const fileName =  file.name.replace(path.extname(file.name), "")

    // const selectedPath = dialog.showSaveDialogSync(Renderers.Convert, {
    //     defaultPath: path.join(config.data.path.convertDestDir, `${fileName}.${extension}`),
    //     filters: [
    //         {
    //             name:data.convertFormat === "MP4" ? "Video" : "Audio",
    //             extensions: [extension]
    //         },
    //     ],
    // })

    // if(!selectedPath) return endConvert()

    // config.data.path.convertDestDir = path.dirname(selectedPath)

    // const shouldReplace = getCurrentFile().fullPath === selectedPath

    // const timestamp = String(new Date().getTime());
    // const savePath = shouldReplace ? path.join(path.dirname(selectedPath), path.basename(selectedPath) + timestamp) : selectedPath

    // Renderers.Convert.hide()

    // ipc.send("Player", "toggle-convert", {})

    // try{

    //     if(data.convertFormat === "MP4"){
    //         await util.convertVideo(data.sourcePath, savePath, data.options)
    //     }else{
    //         await util.convertAudio(data.sourcePath, savePath, data.options)
    //     }

    //     if(shouldReplace){
    //         fs.renameSync(savePath, selectedPath)
    //     }

    //     endConvert();

    // }catch(ex:any){

    //     endConvert(ex.message)

    // }finally{

    //     openConvertDialog();
    //     ipc.send("Player", "toggle-convert", {})

    // }

}

// const endConvert = (message?:string) => {

//     if(message){
//         showErrorMessage(message)
//     }

//     ipc.send("Convert", "after-convert", {})

// }

const loadPlaylistFile = async () => {

    if(!Renderers.Playlist) return;

    const file = await dialog.open({
        title: "Select file to load",
        multiple: false,
        defaultPath: config.data.path.playlistDestDir,
        filters: [
            { name: "Playlist File", extensions: ["json"] },
        ],
    })

    if(!file || typeof file !== "string") return;

    config.data.path.playlistDestDir = path.dirname(file);

    const data = await fs.readTextFile(file)

    addToPlaylist(fromPlaylistJson(data))

}

const savePlaylistFile = async () => {

    if(!Renderers.Playlist || !playlistFiles.length) return;

    const selectedPath = await dialog.save({
        defaultPath: config.data.path.playlistDestDir,
        filters: [
            { name: "Playlist File", extensions: ["json"] },
        ],
    })

    if(!selectedPath) return

    config.data.path.playlistDestDir = selectedPath;

    const data = playlistFiles.map(file => file.fullPath)
    await fs.writeTextFile(selectedPath, JSON.stringify(data))

}

const fromPlaylistJson = (jsonData:string) => {
    try{
        return JSON.parse(jsonData)
    }catch(ex:any){
        showErrorMessage(ex);
    }

}

const renameFile = async (data:Mp.RenameRequest) => {

    const fileIndex = playlistFiles.findIndex(file => file.id == data.id)
    const file = playlistFiles[fileIndex];
    const filePath = file.fullPath;
    const newPath = await path.join(path.dirname(filePath), data.name)

    try{
        const exists = await util.exists(newPath)
        if(exists){
            throw new Error(`File name "${data.name}" exists`)
        }

        await ipc.invoke("rename", {filePath, newPath})

        const newMediaFile = util.updateFile(newPath, file);
        playlistFiles[fileIndex] = newMediaFile

        ipc.send("Playlist", "after-rename", {file:newMediaFile})

        if(fileIndex == currentIndex){
            ipc.send("Player", "after-file-load", {currentFile:newMediaFile, autoPlay:mediaPlayStatus == "playing"})
        }

    }catch(ex){
        await showErrorMessage(ex)
        ipc.send("Playlist", "after-rename", {file:file, error:true})
    }
}

const onMinimize = () => Renderers.Player?.minimize();

const onLoadRequest = (data:Mp.LoadFileRequest) => {
    if(data.isAbsolute){
        selectFile(data.index)
    }else{
        changeIndex(data.index)
    }
}

const onReload = async () => {
    // Renderers.Playlist?.reload();
    // Renderers.Player?.reload();
    await relaunch();
}

const onClosePlaylist = () => {
    config.data.playlistVisible = false;
    Renderers.Playlist?.hide()
}

const onPlaylistItemSelectionChange = (data:Mp.PlaylistItemSelectionChange) => {
    playlistSelection.selectedId = data.selection.selectedId;
    playlistSelection.selectedIds = data.selection.selectedIds
}

const onToggleShuffle = () => {
    doShuffle = !doShuffle;
    shuffleList();
}

const onToggleFullscreen = async (e:Mp.FullscreenChange) => {

    // change setDecorations to hide extra window bar
    if(e.fullscreen){
        await Renderers.Playlist?.hide();
        await Renderers.Convert?.hide();
        await Renderers.Player?.setDecorations(true)
        await Renderers.Player?.setFullscreen(true)
    }else{
        await Renderers.Player?.setDecorations(false)
        await Renderers.Player?.setFullscreen(false)
        if(config.data.playlistVisible){
            await Renderers.Playlist?.show();
        }
        await Renderers.Player?.setFocus();
    }
}

const onShortcut = (e:Mp.ShortcutEvent) => {

    if(e.renderer === "Player"){
        playerContextMenuCallback(e.menu as Mp.PlayerContextMenuType)
    }

    if(e.renderer === "Playlist"){
        playlistContextMenuCallback(e.menu as Mp.PlaylistContextMenuType)
    }
}

const onOpenContextMenu = async (e:Mp.ContextMenuEvent) => {

    await ipc.send("ContextMenu", "popup-context-menu", e)

}

const onContextMenuItemClick = (e:Mp.ContextMenuClickEvent) => {
    if(e.contextMenuName === "PlayerMenu") {
        playerContextMenuCallback(e.data.name as Mp.PlayerContextMenuType, e.data.value)
    }

    if(e.contextMenuName === "PlaylistMenu") {
        playlistContextMenuCallback(e.data.name as Mp.PlaylistContextMenuType, e.data.value)
    }

    if(e.contextMenuName === "SortMenu") {
        playlistContextMenuCallback(e.data.name as Mp.PlaylistContextMenuType, e.data.value)
    }
}

//const changeProgressBar = (data:Mp.ProgressEvent) => Renderers.Player?.setProgressBar(data.progress);

ipc.receive("player-ready", onPlayerReady)
ipc.receive("minimize", onMinimize)
ipc.receive("toggle-maximize", toggleMaximize)
ipc.receive("close", closeWindow)
ipc.receive("drop", dropFiles)
ipc.receive("load-file", onLoadRequest)
ipc.receive("play-status-change", changePlayStatus)
ipc.receive("reload", onReload)
ipc.receive("save-capture", saveCapture)
ipc.receive("close-playlist", onClosePlaylist)
ipc.receive("playlist-item-selection-change", onPlaylistItemSelectionChange)
ipc.receive("file-released", deleteFile)
ipc.receive("rename-file", renameFile);
ipc.receive("change-playlist-order", changePlaylistItemOrder)
ipc.receive("toggle-play", togglePlay)
ipc.receive("toggle-shuffle", onToggleShuffle)
ipc.receive("toggle-fullscreen", onToggleFullscreen)
ipc.receive("close-convert", hideConvertDialog)
ipc.receive("request-convert", startConvert)
//ipc.receive("request-cancel-convert", util.cancelConvert)
ipc.receive("open-convert-sourcefile-dialog", openConvertSourceFileDialog)
ipc.receive("shortcut", onShortcut)
ipc.receive("open-context-menu", onOpenContextMenu)
ipc.receive("context-menu-item-click", onContextMenuItemClick)
