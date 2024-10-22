import {Validators} from "@angular/forms";
import {TableRenderInfo} from "@modules/table/components/table/table.types";
import {MenfengpeizhiItem} from "./menfeng-peizhi.types";

export const getMenfengPeizhiTableInfo = (items: MenfengpeizhiItem[]) => {
  const info: TableRenderInfo<MenfengpeizhiItem> = {
    data: items,
    editMode: true,
    filterable: {fields: ["menjiao", "suobian", "chanpinfenlei", "xinghaoyouxian"]},
    columns: [
      {type: "string", field: "menjiao", name: "门铰", width: "150px"},
      {type: "string", field: "suobian", name: "锁边", width: "150px"},
      {type: "string", field: "chanpinfenlei", name: "产品分类", width: "150px"},
      {type: "string", field: "xinghaoyouxian", name: "型号优先", width: "150px", editable: true},
      {type: "number", field: "suobianmenfeng", name: "锁边门缝", width: "100px", editable: true, validators: Validators.required},
      {type: "number", field: "jiaobianmenfeng", name: "铰边门缝", width: "100px", editable: true, validators: Validators.required},
      {type: "number", field: "dingbumenfeng", name: "顶部门缝", width: "100px", editable: true, validators: Validators.required},
      {type: "number", field: "dibumenfeng", name: "底部门缝", width: "100px", editable: true, validators: Validators.required},
      {
        type: "number",
        field: "vid",
        name: "总门缝",
        width: "100px",
        getString: (item) => {
          const arr = [item.suobianmenfeng, item.jiaobianmenfeng, item.dingbumenfeng, item.dibumenfeng];
          const n = arr.reduce<number>((a, b) => (a || 0) + (b || 0), 0);
          return n.toString();
        }
      }
    ]
  };
  return info;
};