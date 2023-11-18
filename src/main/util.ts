import * as fs from "@tauri-apps/api/fs"
import * as path from "../path";
import { convertFileSrc } from "@tauri-apps/api/tauri";
import {IPCBase} from "../ipc";
import { Resolutions, Rotations } from "../constants";

const ipc = new IPCBase();

export const EmptyFile:Mp.MediaFile = {
    id:"",
    fullPath:"",
    src:"",
    name:"",
    date: 0,
    extension:"",
    dir:"",
}

export default class Util{

    busy = false;

    extractFilesFromArgv(_target?:string[]){

        // if(target){
        //     return target.slice(1, target.length)
        // }

        // if(process.argv[1] == ".") return [];

        // return process.argv.slice(1, process.argv.length)
        return [];

    }

    async exists(target:string | undefined | null, createIfNotFound = false){

        if(!target) return false;

        const result = await fs.exists(target)

        if(result == false && createIfNotFound){
            await fs.createDir(target, {recursive:true});
        }

        return result;

    }

    async toFile(fullPath:string):Promise<Mp.MediaFile>{

        const statInfo = await ipc.invoke("stat", {fullPath});

        return {
            id: crypto.randomUUID(),
            fullPath,
            dir: path.dirname(fullPath),
            src: convertFileSrc(fullPath),
            name:decodeURIComponent(encodeURIComponent(path.basename(fullPath))),
            date:statInfo.mtime,
            extension: path.extname(fullPath),
        }
    }

    updateFile(fullPath:string, currentFile:Mp.MediaFile):Mp.MediaFile{

        return {
            id: currentFile.id,
            fullPath,
            dir: path.dirname(fullPath),
            src: convertFileSrc(fullPath),
            name:decodeURIComponent(encodeURIComponent( path.basename(fullPath))),
            date:currentFile.date,
            extension:currentFile.extension,
        }
    }

    shuffle(targets:any[]){

        const result = [];
        let size = 0;
        let randomIndex = 0;

        while (targets.length > 0) {
            size = targets.length;
            randomIndex = Math.floor(Math.random() * size);

            result.push(targets[randomIndex]);
            targets.splice(randomIndex, 1);
        }

        return result;
    }

    private localCompareName(a:Mp.MediaFile, b:Mp.MediaFile){
        return a.name.replace(path.extname(a.name),"").localeCompare(b.name.replace(path.extname(a.name),""))
    }

    sort(files:Mp.MediaFile[], sortOrder:Mp.SortOrder){

        if(!files.length) return;

        switch(sortOrder){
            case "NameAsc":
                return files.sort((a,b) => this.localCompareName(a,b))
            case "NameDesc":
                return files.sort((a,b) => this.localCompareName(b,a))
            case "DateAsc":
                return files.sort((a,b) => a.date - b.date || this.localCompareName(a,b))
            case "DateDesc":
                return files.sort((a,b) => b.date - a.date || this.localCompareName(a,b))
        }

    }

    groupBy<T>(items:T[], key:keyof T){

        return items.reduce<{ [groupKey:string] : T[]}>((acc, current) => {
              (acc[current[key] as unknown as string] = acc[current[key] as unknown as string] || []).push(current);
              return acc;
        }, {});

    }

    sortByGroup(files:Mp.MediaFile[], sortOrder:Mp.SortOrder){

        if(!files.length) return;

        const groups = this.groupBy(files, "dir")

        const result = Object.values(groups).map(group => this.sort(group, sortOrder)).flat() as Mp.MediaFile[];
        files.length = 0;
        files.push(...result)

    }

    async getMediaMetadata(fullPath:string){
        const result = await ipc.invoke("get_media_metadata", {fullPath})
        const metadata = JSON.parse(result.metadata);
        metadata.volume = this.extractVolumeInfo(result.volume)
        return metadata;
    }

    private extractVolumeInfo(std:string):Mp.MediaVolume{
        const n_samples = std.match(/n_samples:\s?([0-9]*)\s?/)?.at(1) ?? ""
        const mean_volume = std.match(/mean_volume:\s?([^ ]*)\s?dB/)?.at(1) ?? ""
        const max_volume = std.match(/max_volume:\s?([^ ]*)\s?dB/)?.at(1) ?? ""
        return {
            n_samples,
            mean_volume,
            max_volume
        }
    }

    async getMaxVolume(fullPath:string):Promise<string>{
        const result = await ipc.invoke("get_media_metadata", {fullPath})
        const volume = this.extractVolumeInfo(result.volume);
        return volume.max_volume;
    }

    async cancelConvert(){
        await ipc.invoke("cancel_convert", undefined);
        this.busy = false;
    }

    async convertAudio(sourcePath:string, destPath:string, options:Mp.ConvertOptions){

        if(this.busy) throw new Error("Process busy")

        this.busy = true;

        const metadata = await this.getMediaMetadata(sourcePath);

        const bit_rate = metadata.streams[1].bit_rate;

        if(!bit_rate && options.audioBitrate === "BitrateNone"){
            throw new Error("No audio bitrate detected")
        }

        const audio_bitrate = options.audioBitrate !== "BitrateNone" ? `${options.audioBitrate}k` : `${Math.ceil(parseInt(bit_rate)/1000)}k`
        let audio_volume = options.audioVolume !== "1" ? `${options.audioVolume}dB` : ""

        if(options.maxAudioVolume){
            const maxVolumeText = await this.getMaxVolume(sourcePath);
            const maxVolume = parseFloat(maxVolumeText);
            if(maxVolume >= 0){
                throw new Error("No max_volume")
            }
            audio_volume = `${maxVolume * -1}dB`
        }

        try{
            await ipc.invoke("convert_audio", {sourcePath, destPath, audioOptions:{audio_bitrate, audio_volume }})
        }catch(ex:any){
            throw new Error(ex);
        }finally{
            this.busy = false;
        }

    }

    async convertVideo(sourcePath:string, destPath:string, options:Mp.ConvertOptions){

        if(this.busy) throw new Error("Process busy")

        this.busy = true;

        const metadata = await this.getMediaMetadata(sourcePath);

        const size = Resolutions[options.frameSize] ? Resolutions[options.frameSize] : await this.getSize(metadata)
        const rotation = Rotations[options.rotation] ? Rotations[options.rotation] : "";

        const bit_rate = metadata.streams[1].bit_rate;
        if(!bit_rate && options.audioBitrate === "BitrateNone"){
            throw new Error("No audio bitrate detected")
        }

        const audio_bitrate = options.audioBitrate !== "BitrateNone" ? `${options.audioBitrate}k` : `${Math.ceil(parseInt(bit_rate)/1000)}k`
        let audio_volume = options.audioVolume !== "1" ? `${options.audioVolume}dB` : ""

        if(options.maxAudioVolume){
            const maxVolumeText = await this.getMaxVolume(sourcePath);
            const maxVolume = parseFloat(maxVolumeText);
            if(maxVolume >= 0){
                throw new Error("No max_volume")
            }
            audio_volume = `${maxVolume * -1}dB`
        }

        try{
            await ipc.invoke("convert_video", {sourcePath, destPath, videoOptions:{audio_bitrate, audio_volume, size, rotation}})
        }catch(ex:any){
            throw new Error(ex);
        }finally{
            this.busy = false;
        }

    }

    private async getSize(metadata:any){

        const rotation = metadata.streams[0].rotation

        if(rotation === "-90" || rotation === "90"){
            return `w=${metadata.streams[0].height}:h=${metadata.streams[0].width}`
        }

        return `w=${metadata.streams[0].width}:h=${metadata.streams[0].height}`
    }


}
