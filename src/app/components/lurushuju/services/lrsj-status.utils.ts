import {XinghaoData, XinghaoGongyi, XinghaoMenchuang} from "./lrsj-status.types";

export const getXinghaoMenchuang = (raw?: Partial<XinghaoMenchuang>): XinghaoMenchuang => {
  return {
    vid: 0,
    mingzi: "",
    paixu: 0,
    ...raw,
    tingyong: !!raw?.tingyong
  };
};
export const getXinghaoGongyi = (raw?: Partial<XinghaoGongyi>): XinghaoGongyi => {
  return {
    vid: 0,
    mingzi: "",
    paixu: 0,
    menchuang: 0,
    ...raw,
    tingyong: !!raw?.tingyong
  };
};
export const getXinghaoData = (raw?: Partial<XinghaoData>): XinghaoData => {
  return {
    vid: 0,
    mingzi: "",
    menchuang: "",
    gongyi: "",
    dingdanliucheng: "",
    tingyong: false,
    paixu: -10000,
    tupian: "",
    ...raw
  };
};
