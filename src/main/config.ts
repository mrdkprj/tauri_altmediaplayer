import * as fs from "@tauri-apps/api/fs"
import Util from "./util";
import * as path from '@tauri-apps/api/path';

const CONFIG_FILE_NAME = "altmediaplayer.config.json"

const defaultConfig :Mp.Config = {
    bounds: {
        size:{
            width:1200, height:800
        },
        position:{
            x:0, y:0
        }
    },
    playlistBounds: {
        size:{
            width:400, height:700
        },
        position:{
            x:0, y:0
        }
    },
    isMaximized: false,
    playlistVisible:true,
    theme:"Dark",
    sort:{
        order:"NameAsc",
        groupBy:false,
    },
    video:{
        playbackSpeed:1,
        seekSpeed:10,
        fitToWindow: true,
    },
    audio:{
        volume: 0.5,
        ampLevel: 0.1,
        mute:false,
    },
    path:{
        captureDestDir:"",
        convertDestDir:"",
        playlistDestDir:"",
    }
}

export default class Config{

    data:Mp.Config;

    private file:string;
    private util = new Util();

    constructor(){
        this.data = defaultConfig;
    }

    async build(){
        const appDataDir = await path.appDataDir();
        const directory = await path.join(appDataDir, "temp");

        await this.util.exists(directory, true);

        this.file = await path.join(directory, CONFIG_FILE_NAME)

        await this.init();
    }

    private async init(){

        const fileExists = await this.util.exists(this.file, false);

        if(fileExists){

            const rawData = await fs.readTextFile(this.file);
            this.data = this.createConfig(JSON.parse(rawData))

        }else{

            await fs.writeTextFile(this.file, JSON.stringify(this.data));

        }
    }

    private createConfig(rawConfig:any):Mp.Config{

        const config = {...defaultConfig} as any;

        Object.keys(rawConfig).forEach(key => {

            if(!(key in config)) return;

            const value = rawConfig[key];

            if(typeof value === "object"){

                Object.keys(value).forEach(valueKey => {
                    if(valueKey in config[key]){
                        config[key][valueKey] = value[valueKey]
                    }
                })
            }else{
                config[key] = value;
            }
        })

        return config;
    }

    async save(){
        await fs.writeTextFile(this.file, JSON.stringify(this.data));
    }

}


