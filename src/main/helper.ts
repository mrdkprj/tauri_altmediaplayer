import { createChildWindow } from "../window";
import { WindowLabel } from "../constants";
import { WebviewWindow } from "@tauri-apps/api/window";

export default class Helper{

    async createPlaylist(){
        const options = {
            url: 'src/playlist/playlist.html',
            visible:false,
            resizable:true,
            skipTaskbar:true,
            minimizable:false,
            maximizable:false,
            fullscreen:false,
            decorations:false,
            closable:true,
            focus:true,
            transparent:false,
            title:""
        }

        return WebviewWindow.getByLabel(WindowLabel.PlaylistLabel) ?? await createChildWindow(WindowLabel.PlaylistLabel as RendererName, {parentLabel:WindowLabel.PlayerLabel, parentType:"Owner"}, options)

    }

    async createConvert(){
        const options = {
            url: 'src/convert/convert.html',
            width:640,
            height:700,
            visible:false,
            resizable:true,
            skipTaskbar:true,
            minimizable:false,
            maximizable:false,
            fullscreen:false,
            decorations:false,
            closable:true,
            focus:true,
            transparent:false,
            title:""
        }

        return WebviewWindow.getByLabel(WindowLabel.ConvertLabel) ?? await createChildWindow(WindowLabel.ConvertLabel as RendererName, {parentLabel:WindowLabel.PlayerLabel, parentType:"Owner"}, options)
    }

    async createContextMenu(){

        const options = {
            url: 'src/menu/menu.html',
            visible:true,
            resizable:false,
            skipTaskbar:true,
            minimizable:false,
            maximizable:false,
            fullscreen:false,
            decorations:false,
            closable:false,
            focus:true,
            transparent:true,
            title:""
        }

        return WebviewWindow.getByLabel(WindowLabel.PlayerContextMenuLabel) ?? await createChildWindow(WindowLabel.PlayerContextMenuLabel as RendererName, {parentLabel:WindowLabel.PlaylistLabel, parentType:"Owner"}, options)
    }

    getPlayerContextMenu(config:Mp.Config):Mp.ContextMenu[]{
        return [
            {
                name:"PlaybackSpeed",
                label: "Playback Speed",
                submenu: this.playbackSpeedMenu()
            },
            {
                name:"SeekSpeed",
                label: "Seek Speed",
                submenu: this.seekSpeedMenu()
            },
            {
                name:"FitToWindow",
                label: "Fit To Window Size",
                type: "checkbox",
                checked: config.video.fitToWindow,
            },
            { name:"separator", type: 'separator' },
            {
                name:"TogglePlaylistWindow",
                label: "Playlist",
                accelerator: "Ctrl+P",
            },
            {
                name:"ToggleFullscreen",
                label: "Toggle Fullscreen",
                accelerator:"F11",
            },
            {
                name:"PictureInPicture",
                label: "Picture In Picture",
            },
            { name:"separator", type: 'separator' },
            {
                name:"Capture",
                label: "Capture",
                accelerator: "Ctrl+S",
            },
            { name:"separator", type: 'separator' },
            {
                name:"Theme",
                label: "Theme",
                submenu:this.themeMenu(config)
            },

        ]
    }

    private themeMenu(config:Mp.Config):Mp.ContextMenu[]{
        const name = "Theme"
        return [
            {
                name,
                value: "Light",
                label:"Light",
                type:"radio",
                checked: config.theme === "Light",
            },
            {
                name,
                value: "Dark",
                label:"Dark",
                type:"radio",
                checked: config.theme === "Dark",
            },
        ]
    }

    private playbackSpeedMenu():Mp.ContextMenu[]{

        const name = "PlaybackSpeed"
        return [
            {
                name,
                label:"0.25",
                type:"radio",
                value:"0.25"
            },
            {
                name,
                label:"0.5",
                type:"radio",
                value:"0.5",
            },
            {
                name,
                label:"0.75",
                type:"radio",
                value:"0.75",
            },
            {
                name,
                label:"1 - Default",
                type:"radio",
                checked:true,
                value:"1",
            },
            {
                name,
                label:"1.25",
                type:"radio",
                value:"1.25",
            },
            {
                name,
                label:"1.5",
                type:"radio",
                value:"1.5",
            },
            {
                name,
                label:"1.75",
                type:"radio",
                value:"1.75",
            },
            {
                name,
                label:"2",
                type:"radio",
                value:"2",
            },
        ]
    }

    private seekSpeedMenu():Mp.ContextMenu[]{

        const name = "SeekSpeed"
        return [
            {
                name,
                label:"0.03sec",
                type:"radio",
                value:"0.03",
            },
            {
                name,
                label:"0.05sec",
                type:"radio",
                value:"0.05",
            },
            {
                name,
                label:"0.1sec",
                type:"radio",
                value:"0.1"
            },
            {
                name,
                label:"0.5sec",
                type:"radio",
                value:"0.5",
            },
            {
                name,
                label:"1sec",
                type:"radio",
                value:"1"
            },
            {
                name,
                label:"5sec",
                type:"radio",
                value:"5"
            },
            {
                name,
                label:"10sec - Default",
                type:"radio",
                checked:true,
                value:"10"
            },
            {
                name,
                label:"20sec",
                type:"radio",
                value:"20"
            },
        ]

    }

    getPlaylistContextMenu():Mp.ContextMenu[]{

        return [
            {
                name:"Remove",
                label: "Remove",
                accelerator: "Delete",
            },
            {
                name:"Trash",
                label: "Trash",
                accelerator: "Shift+Delete",
            },
            { name:"separator", type:"separator" },
            {
                name:"CopyFileName",
                label: "Copy Name",
                accelerator: "Ctrl+C",
            },
            {
                name:"CopyFullpath",
                label: "Copy Full Path",
                accelerator: "Ctrl+Shift+C",
            },
            {
                name:"Reveal",
                label: "Reveal in File Explorer",
                accelerator: "Ctrl+R",
            },
            { name:"separator", type:"separator" },
            {
                name:"Rename",
                label: "Rename",
                accelerator: "F2",
            },
            {
                name:"Metadata",
                label: "View Metadata",
            },
            {
                name:"Convert",
                label: "Convert",
            },
            { name:"separator", type:"separator" },
            {
                name:"LoadList",
                label: "Load Playlist",
            },
            {
                name:"SaveList",
                label: "Save Playlist",
            },
            { name:"separator", type:"separator" },
            {
                name:"RemoveAll",
                label: "Clear Playlist",
            },
        ]

    }

    getPlaylistSortContextMenu(config:Mp.Config):Mp.ContextMenu[]{

        const name = "Sort"
        return [
            {
                name:"GroupBy",
                label: "Group By Directory",
                type: "checkbox",
                checked: config.sort.groupBy,
            },
            { name:"separator", type:"separator" },
            {
                name,
                value: "NameAsc",
                label: "Name(Asc)",
                type: "radio",
                checked: config.sort.order === "NameAsc",
            },
            {
                name,
                value: "NameDesc",
                label: "Name(Desc)",
                type: "radio",
                checked: config.sort.order === "NameDesc",
            },
            {
                name,
                value: "DateAsc",
                label: "Date(Asc)",
                type: "radio",
                checked: config.sort.order === "DateAsc",
            },
            {
                name,
                value: "DateDesc",
                label: "Date(Desc)",
                type: "radio",
                checked: config.sort.order === "DateDesc",
            },
        ]

    }

}