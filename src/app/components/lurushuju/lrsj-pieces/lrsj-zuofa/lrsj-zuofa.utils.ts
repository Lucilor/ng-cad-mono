import {getArrayString} from "@app/app.common";
import {TableRenderInfo} from "@app/modules/table/components/table/table.types";
import {ObjectOf} from "@lucilor/utils";
import {MenjiaoData, ShuruTableData, XuanxiangTableData} from "./lrsj-zuofa.types";

export const getXuanxiangTable = (data: XuanxiangTableData[]): TableRenderInfo<XuanxiangTableData> => {
  return {
    title: "选项数据",
    noCheckBox: true,
    columns: [
      {type: "string", field: "名字"},
      {
        type: "string",
        field: "可选项",
        getString: (item) => {
          return item.可选项.map((v) => v.mingzi).join("*");
        }
      },
      {
        type: "button",
        field: "操作",
        buttons: [
          {event: "编辑", color: "primary"},
          {event: "清空数据", color: "primary"}
        ]
      }
    ],
    data,
    toolbarButtons: {extra: [], inlineTitle: true}
  };
};

export const getShuruTable = (data: ShuruTableData[]): TableRenderInfo<ShuruTableData> => {
  return {
    title: "输入数据",
    noCheckBox: true,
    columns: [
      {type: "string", field: "名字"},
      {type: "string", field: "默认值"},
      {type: "string", field: "取值范围"},
      {type: "boolean", field: "可以修改"},
      {
        type: "button",
        field: "操作",
        buttons: [
          {event: "编辑", color: "primary"},
          {event: "删除", color: "primary"}
        ]
      }
    ],
    data,
    toolbarButtons: {extra: [{event: "添加", color: "primary"}], inlineTitle: true}
  };
};

export const getMenjiaoTable = (data: MenjiaoData[]): TableRenderInfo<MenjiaoData> => {
  return {
    noCheckBox: true,
    columns: [
      {type: "string", field: "名字", width: "180px", name: "门铰锁边铰边"},
      {type: "string", field: "开启", width: "100px"},
      {type: "string", field: "门铰", width: "100px", getString: (value) => getArrayString(value.门铰, "，")},
      {type: "string", field: "门扇厚度", width: "80px", getString: (value) => getArrayString(value.门扇厚度, "，")},
      {type: "string", field: "锁边", width: "120px"},
      {type: "string", field: "铰边", width: "120px"},
      {
        type: "string",
        field: "门缝配置",
        width: "250px",
        getString: (value) => {
          const data = value.门缝配置;
          if (!data) {
            return "";
          }
          const map: ObjectOf<string> = {
            锁边门缝: "锁边",
            铰边门缝: "铰边",
            顶部门缝: "上",
            底部门缝: "下"
          };
          const strs = Object.entries(data)
            .map(([k, v]) => {
              if (k.includes("内间隙") && v === 0) {
                return "";
              }
              return `${map[k] || k}${v}`;
            })
            .filter((v) => v);
          return strs.join("，");
        }
      },
      {type: "boolean", field: "停用", width: "60px"},
      {type: "number", field: "排序", width: "60px"},
      {type: "boolean", field: "默认值", width: "60px"},
      {
        type: "button",
        field: "操作",
        width: "150px",
        stickyEnd: true,
        buttons: [
          {event: "编辑", color: "primary"},
          {event: "编辑排序", color: "primary"},
          {event: "复制", color: "primary"},
          {event: "删除", color: "primary"}
        ]
      }
    ],
    data,
    toolbarButtons: {
      extra: [
        {event: "添加", color: "primary"},
        {event: "从其他做法选择", title: "从其他做法选择门铰锁边铰边", color: "primary"}
      ],
      inlineTitle: true
    }
  };
};
