export interface DownloadOptions {
  filename?: string;
  noNewTab?: boolean;
}

export const downloadByString = (content: string, options?: DownloadOptions) => {
  downloadByBlob(new Blob([content]), options);
};

export const downloadByBlob = (blob: Blob, options?: DownloadOptions) => {
  const url = URL.createObjectURL(blob);
  downloadByUrl(url, options);
  URL.revokeObjectURL(url);
};

export const downloadByUrl = (url: string, options?: DownloadOptions) => {
  const {filename, noNewTab} = options || {};
  const link = document.createElement("a");
  link.download = filename || "";
  link.style.display = "none";
  link.href = url;
  if (!noNewTab) {
    link.target = "_blank";
  }
  link.click();
};

export type FileSizeUnit = "B" | "KB" | "MB" | "GB" | "TB" | "PB" | "EB" | "ZB" | "YB";

const fileSizeArray: FileSizeUnit[] = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

export interface FileSizeOptions {
  inputUnit?: FileSizeUnit;
  outputUnit?: FileSizeUnit;
  fractionDigits?: number;
  stringGetter?: (size: string, unit: string) => string;
}

export const getFileSize = (raw: number, options: FileSizeOptions = {}) => {
  const {inputUnit, outputUnit} = options;
  const fractionDigits = options.fractionDigits ?? 2;
  let stringGetter = options.stringGetter;
  if (typeof stringGetter !== "function") {
    stringGetter = (size: string, unit: string) => `${size} ${unit}`;
  }
  let size: number;
  let unit: FileSizeUnit;
  if (outputUnit) {
    const inputIndex = inputUnit ? fileSizeArray.indexOf(inputUnit) : 0;
    const outputIndex = fileSizeArray.indexOf(outputUnit);
    size = raw * Math.pow(1024, inputIndex - outputIndex);
    unit = outputUnit;
  } else {
    let index = inputUnit ? fileSizeArray.indexOf(inputUnit) : 0;
    while (raw >= 1024 && index < fileSizeArray.length - 1) {
      raw /= 1024;
      index++;
    }
    size = raw;
    unit = fileSizeArray[index];
  }
  return stringGetter(size.toFixed(fractionDigits), unit);
};

export const selectFiles = (opts?: {multiple?: boolean; accept?: string}) => {
  return new Promise<FileList | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = opts?.multiple ?? false;
    input.accept = opts?.accept ?? "";
    input.addEventListener("change", () => {
      resolve(input.files);
    });
    input.click();
  });
};
