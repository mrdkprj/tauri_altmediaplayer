import * as tauriPath from '@tauri-apps/api/path';

const splitDeviceRe =
    /^([a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/]+)?([\\\/])?([\s\S]*?)$/;

// Regex to split the tail part of the above into [*, dir, basename, ext]
const splitTailRe =
    /^([\s\S]*?)((?:\.{1,2}|[^\\\/]+?|)(\.[^.\/\\]*|))(?:[\\\/]*)$/;

// Function to split a filename into [root, dir, basename, ext]
const path = (filename:string) => {
    // Separate device+slash from tail
    const result = splitDeviceRe.exec(filename) ?? ["","","",""];

    const device = (result[1] || '') + (result[2] || '')
    const tail = result[3] || '';

  // Split the tail into dir, basename and extension
    const result2 = splitTailRe.exec(tail) ?? ["","","",""];
    const dir = result2[1]
    const basename = result2[2]
    const ext = result2[3]

    return {device, dir, basename, ext};
}

export const join = async (...args:string[]) => await tauriPath.join(...args);
export const basename = (filename:string) => path(filename).basename
export const dirname = (filename:string) => {
    const result = path(filename)
    return result.device + result.dir
}
export const extname = (filename:string) => path(filename).ext
