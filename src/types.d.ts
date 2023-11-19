import ffmpeg from "fluent-ffmpeg"
import type { WebviewWindow } from "@tauri-apps/api/window"
import type { Event } from '@tauri-apps/api/event'

declare global {

    type RendererName = "Player" | "Playlist" | "Convert" | "ContextMenu";
    type ContextMenuName = "PlayerMenu" | "PlaylistMenu" | "SortMenu";
    type Renderer = {[key in RendererName] : WebviewWindow | null}
    type Menus = {[key in RendererName] : WebviewWindow | null}
    type MainEvent<T extends keyof RendererChannelEventMap> = {
        target:RendererName;
        data:RendererChannelEventMap[T];
    }
    type RendererEvent<T extends keyof MainChannelEventMap> = {
        source:RendererName;
        data:MainChannelEventMap[T];
    }

    type TauriCommand<Req,Res> = {
        Request:Req,
        Response:Res,
    }

    type TauriCommandMap = {
        "init": TauriCommand<init, string[]>;
        "close": TauriCommand<undefined, undefined>;
        "rename":TauriCommand<Mp.TauriRenamePayload, undefined>;
        "clickthru":TauriCommand<Mp.TauriClickthruPayload, undefined>;
        "stat": TauriCommand<Mp.TauriStatPayload, Mp.TauriStatResponse>;
        "get_media_metadata": TauriCommand<Mp.TauriMetadataPayload, Mp.TauriMetadataResponse>;
        "cancel_convert": TauriCommand<undefined, nuundefinedll>;
        "convert_audio": TauriCommand<Mp.TauriConvertAudioPayload, undefined>;
        "convert_video": TauriCommand<Mp.TauriConvertVideoPayload, undefined>;
    }

    type MainChannelEventMap = {
        "ready":Mp.Event;
        "second-instance": Mp.SecondInstanceEvent;
        "context-menu-ready": Mp.ContextMenuReadyEvent;
        "context-menu-item-click":Mp.ContextMenuClickEvent;
        "minimize": Mp.Event;
        "toggle-maximize": Mp.Event;
        "close": Mp.CloseRequest;
        "shortcut": Mp.ShortcutEvent;
        "drop": Mp.DropRequest;
        "load-file": Mp.LoadFileRequest;
        "progress": Mp.ProgressEvent;
        "open-context-menu":Mp.ContextMenuEvent;
        "play-status-change": Mp.ChangePlayStatusRequest;
        "reload": Mp.Event;
        "save-capture": Mp.CaptureEvent;
        "close-playlist": Mp.Event;
        "file-released": Mp.ReleaseFileRequest;
        "change-playlist-order": Mp.ChangePlaylistOrderRequet;
        "toggle-play": Mp.Event;
        "toggle-shuffle": Mp.Event;
        "toggle-fullscreen": Mp.FullscreenChange;
        "close-convert": Mp.Event;
        "request-convert": Mp.ConvertRequest;
        "open-convert-sourcefile-dialog": Mp.OpenFileDialogRequest;
        "request-cancel-convert": Mp.Event;
        "rename-file": Mp.RenameRequest;
        "playlist-item-selection-change": Mp.PlaylistItemSelectionChange;
        "error": Mp.ErrorEvent;
    }

    type RendererChannelEventMap = {
        "after-ready": Mp.ReadyEvent;
        "after-file-load": Mp.FileLoadEvent;
        "after-toggle-play": Mp.Event;
        "after-toggle-fullscreen": Mp.Event;
        "after-change-display-mode": Mp.ConfigChangeEvent;
        "after-capture-media": Mp.Event;
        "after-restart": Mp.Event;
        "after-release-file": Mp.ReleaseFileRequest;
        "log": Mp.Logging;
        "after-toggle-maximize": Mp.ConfigChangeEvent;
        "after-toggle-convert": Mp.Event;
        "after-change-playback-speed": Mp.ChangePlaybackSpeedRequest;
        "after-change-seek-speed": Mp.ChangeSeekSpeedRequest;
        "after-playlist-change": Mp.PlaylistChangeEvent;
        "after-remove-playlist": Mp.RemovePlaylistItemResult;
        "after-clear-playlist": Mp.Event;
        "after-sort-type-change": Mp.SortType;
        "after-start-rename":Mp.Event;
        "after-rename": Mp.RenameResult;
        "after-sourcefile-select": Mp.FileSelectResult;
        "after-open-convert": Mp.OpenConvertDialogEvent;
        "after-convert": Mp.Event;
        "after-picture-in-picture":Mp.Event;
        "build-menu": Mp.ContextMenuBuildRequest;
        "popup-context-menu": Mp.ContextMenuEvent;
        "after-change-theme": Mp.ChangeThemeEvent;
    }

    const PLAYER_WINDOW_WEBPACK_ENTRY: string;
    const PLAYER_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
    const PLAYLIST_WINDOW_WEBPACK_ENTRY: string;
    const PLAYLIST_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
    const CONVERT_WINDOW_WEBPACK_ENTRY: string;
    const CONVERT_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
    const TEST_WINDOW_WEBPACK_ENTRY: string;

    namespace Mp {

        type Theme = "Dark" | "Light";
        type ConvertFormat = "MP4" | "MP3"
        type ThumbButtonType = "Play" | "Pause" | "Previous" | "Next"
        type ContextMenuSeparator = "separator"
        type PlayerContextMenuType = "PlaybackSpeed" | "SeekSpeed" | "TogglePlaylistWindow" | "FitToWindow" | "ToggleFullscreen" | "Theme" | "Capture" | "PictureInPicture"
        type PlaylistContextMenuType = "Remove" | "RemoveAll" | "Trash" | "CopyFileName" | "CopyFullpath" | "Reveal" | "Metadata" | "Convert" | "Sort" | "Rename" | "LoadList" | "SaveList" | "GroupBy"
        type PlaybackSpeed = "0.25" | "0.5" | "0.75" | "1" | "1.25" | "1.5" | "1.75" | "2";
        type SeekSpeed = "0.03" | "0.05" | "0.1" | "0.5" | "1" | "5" | "10" | "20";
        type SortOrder = "NameAsc" | "NameDesc" | "DateAsc" | "DateDesc"
        type FileDialogType = "Read" | "Write";

        type MenuName = PlayerContextMenuType | PlaylistContextMenuType | ContextMenuSeparator;
        type SubMenuName = PlaybackSpeed | SeekSpeed | SortOrder | Theme | FileDialogType

        type VideoFrameSize = "SizeNone" | "360p" | "480p" | "720p" | "1080p";
        type VideoRotation = "RotationNone" | "90Clockwise" | "90CounterClockwise"
        type AudioBitrate = "BitrateNone" | "128" | "160" | "192" | "320"

        type PlayStatus = "playing" | "paused" | "stopped"

        type MenuType = "text" | "radio" | "checkbox" | "separator"

        type ContextMenuSize = {
            innerHeight:number;
            outerHeight:number;
            innerWidth:number;
            outerWidth:number;
        };

        type ContextMenuBuildOption = {
            name:ContextMenuName;
            menus:Mp.ContextMenu[];
        };

        type ContextMenuBuildRequest = {
            options:Mp.ContextMenuBuildOption[];
        }

        type ContextMenuReadyEvent = {
            windowLabel:string;
        }

        type ContextMenuEvent = {
            target:ContextMenuName;
            x:number;
            y:number;
        }

        type ContextMenu = {
            name:Mp.MenuName;
            label?:string;
            value?:Mp.SubMenuName;
            type?:Mp.MenuType;
            checked?:boolean;
            accelerator?:string;
            submenu?:Mp.ContextMenu[];
        }

        type MenuItemClickEvent = {
            contextMenuName:ContextMenuName;
            name:Mp.MenuName;
            value?:Mp.ContextMenuOptions;
        }

        type ContextMenuClickEvent = {
            contextMenuName:ContextMenuName;
            data:MenuItemClickEvent;
        }

        type SecondInstanceEvent = {
            args:string[];
        }

        type ReadyEvent = {
            config:Config;
        }

        type ShortcutEvent = {
            renderer:RendererName;
            menu: PlayerContextMenuType | PlaylistContextMenuType;
        }

        type Size = {
            width:number;
            height:number;
        }

        type Position = {
            x:number;
            y:number;
        }

        type Bounds = {
            size:Mp.Size;
            position:Mp.Position;
        }

        type SortType = {
            order:SortOrder;
            groupBy:boolean;
        }

        type Config = {
            bounds: Bounds;
            playlistBounds:Bounds;
            theme: Mp.Theme;
            isMaximized:boolean;
            playlistVisible:boolean;
            sort:Mp.SortType;
            video:{
                fitToWindow:boolean;
                playbackSpeed:number;
                seekSpeed:number;
            };
            audio:{
                volume:number;
                ampLevel:number;
                mute:boolean;
            };
            path:{
                captureDestDir:string;
                convertDestDir:string;
                playlistDestDir:string;
            }
        }

        type MediaFile = {
            id:string;
            fullPath:string;
            dir:string;
            src:string;
            name:string;
            date:number;
            extension:string;
        }

        type MediaState = {
            mute: boolean;
            fitToWindow: boolean;
            videoDuration: number;
            videoVolume: number;
            ampLevel: number;
            gainNode: GainNode | undefined;
            playbackSpeed:number;
            seekSpeed:number;
        }

        interface FfprobeData extends ffmpeg.FfprobeData {
            volume?:MediaVolume
        }

        type DropFileEvent = {
            files:string[]
        }

        type MediaVolume = {
            n_samples:string;
            mean_volume:string;
            max_volume:string;
        }

        type Slider = {
            slider:HTMLElement;
            track:HTMLElement;
            thumb:HTMLElement;
            rect:DOMRect;
            trackValue?:any;
            handler: (progress:number) => void;
        }

        type SliderState = {
            sliding:boolean;
            startX:number;
            slider:Slider | undefined;
        }

        type PlaylistItemSelection = {
            selectedId:string;
            selectedIds:string[];
        }

        type PlaylistDragState = {
            dragging: boolean;
            startElement:HTMLElement | undefined;
            targetElement:HTMLElement | undefined;
            startIndex: number;
            working:boolean;
        }

        type RenameData = {
            fileId:string;
            oldName:string;
            newName:string;
        }

        type ConvertOptions = {
            frameSize:VideoFrameSize;
            audioBitrate:AudioBitrate;
            rotation:VideoRotation;
            audioVolume:string;
            maxAudioVolume:boolean;
        }

        type FullscreenChange = {
            fullscreen:boolean;
        }

        type ChangeThemeEvent = {
            theme: Mp.Theme;
        }

        type ChangePlaybackSpeedRequest = {
            playbackSpeed:number;
        }

        type ChangeSeekSpeedRequest = {
            seekSpeed:number;
        }

        type DropRequest = {
            files:string[];
            renderer:RendererName;
        }

        type PlaylistChangeEvent = {
            files:MediaFile[];
            clearPlaylist:boolean;
        }

        type ProgressEvent = {
            progress:number;
        }

        type LoadFileRequest = {
            index:number;
            isAbsolute:boolean;
        }

        type ChangePlayStatusRequest = {
            status:PlayStatus;
        }

        type FileLoadEvent = {
            currentFile:MediaFile;
            autoPlay:boolean;
        }

        type ReplaceFileRequest = {
            file:MediaFile;
        }

        type CaptureEvent = {
            data:string;
            timestamp:number;
        }

        type CloseRequest = {
            mediaState:MediaState
        }

        type PlaylistItemSelectionChange = {
            selection:PlaylistItemSelection
        }

        type ChangePlaylistOrderRequet = {
            start:number;
            end:number;
            currentIndex:number;
        }

        type RemovePlaylistItemRequest = {
            selectedIds:string[]
        }

        type TrashPlaylistItemRequest = {
            selectedIds:string[]
        }

        type RemovePlaylistItemResult = {
            removedFileIds:string[]
        }

        type ReleaseFileRequest = {
            fileIds:string[];
        }

        type CopyRequest = {
            fullpath:boolean;
        }

        type TauriRenamePayload = {
            filePath:string;
            newPath:string;
        }

        type TauriClickthruPayload = {
            ignore:boolean;
            id:string;
        }

        type TauriStatPayload = {
            fullPath:string;
        }

        type TauriStatResponse = {
            size:number,
            atime:number,
            mtime:number,
            ctime:number,
        }

        type TauriMetadataPayload = {
            fullPath:string;
        }

        type TauriMetadataResponse = {
            metadata:string;
            volume:string;
        }

        type TauriConvertAudioPayload = {
            sourcePath:string;
            destPath:string;
            audioOptions:{
                audio_bitrate:string;
                audio_volume:string;
            }
        }

        type TauriConvertVideoPayload = {
            sourcePath:string;
            destPath:string;
            videoOptions:{
                audio_bitrate:string;
                audio_volume:string;
                size:string;
                rotation:string;
            }
        }

        type RenameRequest = {
            id:string;
            name:string
        }

        type RenameResult = {
            file:MediaFile;
            error?:boolean;
        }

        type OpenConvertDialogEvent = {
            file:MediaFile;
        }

        type ConvertRequest = {
            sourcePath:string;
            convertFormat:ConvertFormat;
            options:ConvertOptions;
        }

        type FileSelectResult = {
            file:MediaFile;
        }

        type ConfigChangeEvent = {
            config:Config;
        }

        type OpenFileDialogRequest = {
            fullPath:string;
        }

        type ErrorEvent = {
            message:string;
        }

        type Event = {
            args?:any;
        }

        type Logging = {
            log:any;
        }

    }

}

export {}