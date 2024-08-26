import {Rectangle} from "./geometry";

export const dataURLtoBlob = (dataURL: string) => {
  const arr = dataURL.split(",");
  const mime = arr[0].split(":")[1].split(";")[0];
  const bstr = window.atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], {type: mime});
};

export const getDPI = () => {
  let dpiX = 0;
  let dpiY = 0;
  const tmpNode = document.createElement("div");
  tmpNode.style.cssText = "width:1in;height:1in;position:absolute;left:0px;top:0px;z-index:99;visibility:hidden";
  document.body.appendChild(tmpNode);
  dpiX = tmpNode.offsetWidth;
  dpiY = tmpNode.offsetHeight;
  if (!(dpiX > 0) || !(dpiY > 0)) {
    console.warn("Unable to get screen dpi.Assuming dpi = 96.");
    dpiX = dpiY = 96;
  }
  tmpNode.remove();
  return [dpiX, dpiY] as [number, number];
};

export const timeout = <T>(time = 0, value?: T) => new Promise<T | undefined>((resolve) => setTimeout(() => resolve(value), time));

export const getTypeOf = (value: any) => {
  const type = typeof value;
  if (type === "object") {
    if (value === null) {
      return "null";
    }
    if (Array.isArray(value)) {
      return "array";
    }
  }
  if (type === "number" && isNaN(value)) {
    return "NaN";
  }
  return type;
};

export const isTypeOf = (value: any, type: ReturnType<typeof getTypeOf> | ReturnType<typeof getTypeOf>[]) => {
  const valueType = getTypeOf(value);
  if (Array.isArray(type)) {
    return type.includes(valueType);
  }
  return valueType === type;
};

export const getElementVisiblePercentage = (el: HTMLElement, parentEl = document.body) => {
  const rect0 = el.getBoundingClientRect();
  const parentRect0 = parentEl.getBoundingClientRect();
  const rect = new Rectangle([rect0.left, rect0.top], [rect0.right, rect0.bottom]);
  const parentRect = new Rectangle([parentRect0.left, parentRect0.top], [parentRect0.right, parentRect0.bottom]);
  const visibleArea = rect.intersects(parentRect)?.area || 0;
  const visiblePercentage = (visibleArea / rect.area) * 100;
  return visiblePercentage;
};

export const px2mm = (px: number, dpi: number) => (px * 25.4) / dpi;
export const mm2px = (mm: number, dpi: number) => (mm * dpi) / 25.4;
