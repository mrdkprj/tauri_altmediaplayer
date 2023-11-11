import { invoke } from "@tauri-apps/api/tauri";
import { WindowManager, WebviewWindow } from '@tauri-apps/api/window'

type childOption = {
    parentLabel:string;
    parentType:"Owner"|"Parent";
}

export class Window extends WindowManager {

    constructor(label: string, childOption:childOption, options: any) {
        super(label);

        if(childOption.parentType === "Owner"){
            invoke("create_modal", {
                parentLabel:childOption.parentLabel,
                options: {
                ...options,
                label,
                },
            })
            .then(async () => this.emit("tauri://created"))
            .catch(async (e: string) => this.emit("tauri://error", e));
        }else{
            invoke("create_child", {
                parentLabel:childOption.parentLabel,
                options: {
                ...options,
                label,
                },
            })
            .then(async () => this.emit("tauri://created"))
            .catch(async (e: string) => this.emit("tauri://error", e));
        }

    }
}

export const createChildWindow = async (label: RendererName, childOption:childOption, options: any) => {

    await invoke("create_modal", {
        parentLabel:childOption.parentLabel,
        options: {
        ...options,
        label,
        },
    })

    return WebviewWindow.getByLabel(label)
}