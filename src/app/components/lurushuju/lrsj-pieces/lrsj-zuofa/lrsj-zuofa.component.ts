import {ChangeDetectionStrategy, Component, computed, HostBinding, inject, input, model, output, signal} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatDialog} from "@angular/material/dialog";
import {MatTabsModule} from "@angular/material/tabs";
import {getCopyName} from "@app/app.common";
import {CadDataService} from "@app/modules/http/services/cad-data.service";
import {InputInfo, InputInfoOption, InputInfoSelect} from "@app/modules/input/components/input.types";
import {MessageService} from "@app/modules/message/services/message.service";
import {TableComponent} from "@app/modules/table/components/table/table.component";
import {RowButtonEvent, ToolbarButtonEvent} from "@app/modules/table/components/table/table.types";
import {ObjectOf} from "@lucilor/utils";
import {cloneDeep} from "lodash";
import {openSelectZuofaDialog} from "../../select-zuofa-dialog/select-zuofa-dialog.component";
import {LrsjStatusService} from "../../services/lrsj-status.service";
import {getSortedItems, get算料数据, menjiaoCadTypes, SuanliaoDataParams, 工艺做法, 算料数据, 输入, 选项} from "../../xinghao-data";
import {
  copySuanliaoData,
  getMenfengInputs,
  getMenjiaoOptionInputInfo,
  updateMenjiaoData
} from "../lrsj-suanliao-data/lrsj-suanliao-data.utils";
import {ShuruTableData, XuanxiangTableData, ZuofaTab} from "./lrsj-zuofa.types";
import {getMenjiaoTable, getShuruTable, getXuanxiangTable} from "./lrsj-zuofa.utils";

@Component({
  selector: "app-lrsj-zuofa",
  standalone: true,
  imports: [MatTabsModule, TableComponent],
  templateUrl: "./lrsj-zuofa.component.html",
  styleUrl: "./lrsj-zuofa.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LrsjZuofaComponent {
  private dialog = inject(MatDialog);
  private http = inject(CadDataService);
  private lrsjStatus = inject(LrsjStatusService);
  private message = inject(MessageService);

  @HostBinding("class") class = ["ng-page"];

  fenleiName = input.required<string>();
  zuofa = model.required<工艺做法>();
  gotoSuanliaoData = output<算料数据>();

  tabs = signal<ZuofaTab[]>([{name: "算料数据"}, {name: "下单选项输入配置"}]);

  constructor() {}

  async submitZuofa(fields: (keyof 工艺做法)[]) {
    const fenlei = this.fenleiName();
    const zuofa = this.zuofa();
    this.lrsjStatus.submitZuofa(fenlei, zuofa, fields);
  }

  xuanxiangTable = computed(() => getXuanxiangTable(this.zuofa().选项数据));
  async getXuanxiangItem(data0?: 选项) {
    const data: 选项 = {名字: "", 可选项: [], ...data0};
    const names = this.xuanxiangTable().data.map((v) => v.名字);
    const zuofaOptionsAll = await this.lrsjStatus.getZuofaOptions();
    const form: InputInfo<typeof data>[] = [
      {
        type: "select",
        label: "名字",
        model: {data, key: "名字"},
        disabled: !!data0,
        options: Object.keys(zuofaOptionsAll).map<InputInfoOption>((v) => {
          return {value: v, disabled: names.includes(v)};
        }),
        validators: Validators.required,
        onChange: () => {
          const info = form[1] as InputInfoSelect;
          if (Array.isArray(info.value)) {
            info.value.length = 0;
          }
          if (info.optionsDialog) {
            info.optionsDialog.optionKey = data.名字;
          }
        }
      },
      {
        type: "select",
        label: "可选项",
        value: data.可选项.map((v) => v.mingzi),
        options: [],
        multiple: true,
        validators: Validators.required,
        optionsDialog: {
          optionKey: data.名字,
          openInNewTab: true,
          defaultValue: {value: data.可选项.find((v) => v.morenzhi)?.mingzi, required: true},
          onChange: (val) => {
            data.可选项 = val.options.map((v) => {
              const item: 选项["可选项"][number] = {...v};
              if (item.mingzi === val.defaultValue) {
                item.morenzhi = true;
              }
              return item;
            });
          }
        }
      }
    ];
    const result = await this.message.form(form);
    return result ? data : null;
  }
  async updateXuanxiang() {
    const zuofa = this.zuofa();
    this.zuofa.set({...zuofa});
    await this.submitZuofa(["选项数据"]);
  }
  async onXuanxiangToolbar(event: ToolbarButtonEvent) {
    switch (event.button.event) {
      case "添加":
        {
          const item = await this.getXuanxiangItem();
          if (item) {
            const zuofa = this.zuofa();
            zuofa.选项数据.push(item);
            await this.updateXuanxiang();
          }
        }
        break;
    }
  }
  async onXuanxiangRow(event: RowButtonEvent<XuanxiangTableData>) {
    const zuofa = this.zuofa();
    const {button, item, rowIdx} = event;
    switch (button.event) {
      case "编辑":
        {
          const item2 = zuofa.选项数据[rowIdx];
          const item3 = await this.getXuanxiangItem(item2);
          if (item3) {
            zuofa.选项数据[rowIdx] = item3;
            await this.updateXuanxiang();
          }
        }
        break;
      case "清空数据":
        if (await this.message.confirm(`确定清空【${item.名字}】的数据吗？`)) {
          const item2 = zuofa.选项数据[rowIdx];
          item2.可选项 = [];
          await this.updateXuanxiang();
        }
        break;
    }
  }

  shuruTable = computed(() => {
    return getShuruTable(getSortedItems(this.zuofa().输入数据));
  });
  async getShuruItem(data0?: 输入) {
    const data: 输入 = {名字: "", 默认值: "", 取值范围: "", 可以修改: true, ...data0};
    const zuofa = this.zuofa();
    const form: InputInfo<typeof data>[] = [
      {
        type: "string",
        label: "名字",
        model: {data, key: "名字"},
        validators: [
          Validators.required,
          (control) => {
            const value = control.value;
            if ((!data0 || data0.名字 !== value) && zuofa.输入数据.some((v) => v.名字 === value)) {
              return {名字已存在: true};
            }
            return null;
          }
        ]
      },
      {
        type: "string",
        label: "默认值",
        model: {data, key: "默认值"},
        validators: Validators.required
      },
      {
        type: "string",
        label: "取值范围",
        model: {data, key: "取值范围"},
        validators: [
          Validators.required,
          (control) => {
            const value = control.value;
            if (!/^\d+(.\d+)?-\d+(.\d+)?$/.test(value)) {
              return {取值范围不符合格式: true};
            }
            return null;
          }
        ]
      },
      {type: "boolean", label: "可以修改", model: {data, key: "可以修改"}},
      {type: "number", label: "排序", model: {data, key: "排序"}}
    ];
    return await this.message.form<typeof data, typeof data>(form);
  }
  async updateShuru() {
    const zuofa = this.zuofa();
    this.zuofa.set({...zuofa});
    await this.submitZuofa(["输入数据"]);
  }
  async onShuruToolbar(event: ToolbarButtonEvent) {
    const zuofa = this.zuofa();
    switch (event.button.event) {
      case "添加":
        {
          const item = await this.getShuruItem();
          if (item) {
            zuofa.输入数据.push(item);
            await this.updateShuru();
          }
        }
        break;
    }
  }
  async onShuruRow(event: RowButtonEvent<ShuruTableData>) {
    const zuofa = this.zuofa();
    const {button, item} = event;
    switch (button.event) {
      case "编辑":
        {
          const item2 = zuofa.输入数据[item.originalIndex];
          const item3 = await this.getShuruItem(item2);
          if (item3) {
            zuofa.输入数据[item.originalIndex] = item3;
            await this.updateShuru();
          }
        }
        break;
      case "删除":
        if (await this.message.confirm(`确定删除【${item.名字}】吗？`)) {
          zuofa.输入数据.splice(item.originalIndex, 1);
          await this.updateShuru();
        }
        break;
    }
  }

  menjiaoTable = computed(() => getMenjiaoTable(this.zuofa().算料数据));
  async updateMenjiao() {
    const zuofa = this.zuofa();
    this.zuofa.set({...zuofa});
    await this.submitZuofa(["算料数据"]);
  }
  getMenjiaoId() {
    const zuofa = this.zuofa();
    const numVids = zuofa.算料数据.map((v) => Number(v.vid)).filter((v) => !isNaN(v)) || [];
    if (numVids.length > 0) {
      const numMax = Math.max(...numVids);
      return String(numMax + 1);
    } else {
      return "1";
    }
  }
  async getMenjiaoItem() {}
  async onMenjiaoToolbar(event: ToolbarButtonEvent) {
    const zuofa = this.zuofa();
    switch (event.button.event) {
      case "添加":
        {
          const data = get算料数据();
          const keys: (keyof 算料数据)[] = ["门铰", "门扇厚度", "锁边", "铰边"];
          const menjiaoOptions = await this.lrsjStatus.getMenjiaoOptions();
          const form: InputInfo[] = [
            {
              type: "string",
              label: "",
              model: {data, key: "名字"},
              validators: (control) => {
                const value = control.value;
                if (!value) {
                  return {"请输入【门铰锁边铰边】的名字，下单要选": true};
                }
                return null;
              }
            },
            ...keys.map((k) => getMenjiaoOptionInputInfo(data, k, 1, menjiaoOptions)),
            getMenfengInputs(data)
          ];
          const result = await this.message.form(form);
          if (result) {
            updateMenjiaoData(data);
            const index = zuofa.算料数据.push(data);
            await this.updateMenjiao();
            this.lrsjStatus.gotoSuanliaoData(this.fenleiName(), zuofa.名字, index);
          }
        }
        break;
      case "从其他做法选择":
        {
          const xinghaoName = this.lrsjStatus.xinghao()?.名字 || "";
          const result = await openSelectZuofaDialog(this.dialog, {
            data: {
              xinghaoOptions: await this.lrsjStatus.getXinghaoOptions(),
              menjiaoOptions: await this.lrsjStatus.getMenjiaoOptions(),
              excludeXinghaos: [xinghaoName],
              excludeZuofas: [zuofa.名字],
              key: "算料数据",
              multiple: true,
              fenlei: this.fenleiName()
            }
          });
          if (result && result.items.length > 0) {
            const names = zuofa.算料数据.map((v) => v.名字);
            for (const item of result.items) {
              const fromItem = item.data as 算料数据;
              const toItem = cloneDeep(fromItem);
              toItem.vid = this.getMenjiaoId();
              toItem.名字 = getCopyName(names, toItem.名字);
              updateMenjiaoData(toItem);
              zuofa.算料数据.push(toItem);
              names.push(toItem.名字);
              for (const key1 of menjiaoCadTypes) {
                const fromData = fromItem[key1];
                const toData = toItem[key1];
                const [包边方向, 开启] = key1.split("+");
                const fromParams: SuanliaoDataParams = {
                  选项: {
                    型号: item.型号,
                    产品分类: item.产品分类,
                    工艺做法: item.工艺做法 || "",
                    包边方向,
                    开启,
                    门铰锁边铰边: fromItem.名字
                  }
                };
                const toParams: SuanliaoDataParams = {
                  选项: {
                    型号: xinghaoName,
                    产品分类: this.fenleiName(),
                    工艺做法: zuofa.名字,
                    包边方向,
                    开启,
                    门铰锁边铰边: toItem.名字
                  }
                };
                await copySuanliaoData(this.http, fromData, toData, fromParams, toParams);
              }
            }
            await this.updateMenjiao();
          }
        }
        break;
    }
  }
  async onMenjiaoRow(event: RowButtonEvent<算料数据>) {
    const zuofa = this.zuofa();
    const {button, item: fromItem, rowIdx} = event;
    switch (button.event) {
      case "编辑":
        this.lrsjStatus.gotoSuanliaoData(this.fenleiName(), zuofa.名字, rowIdx);
        break;
      case "编辑排序":
        {
          const data = cloneDeep(fromItem);
          const result = await this.message.form<ObjectOf<any>, 算料数据>([
            {type: "boolean", label: "停用", model: {data, key: "停用"}},
            {type: "number", label: "排序", model: {data, key: "排序"}},
            {
              type: "boolean",
              label: "默认值",
              model: {data, key: "默认值"}
            }
          ]);
          if (result) {
            if (result.默认值) {
              for (const item of zuofa.算料数据) {
                item.默认值 = false;
              }
            }
            Object.assign(fromItem, result);
            await this.updateMenjiao();
          }
        }
        break;
      case "复制":
        if (await this.message.confirm(`确定复制【${fromItem.名字}】吗？`)) {
          const toItem = cloneDeep(fromItem);
          toItem.vid = this.getMenjiaoId();
          const names = zuofa.算料数据.map((v) => v.名字);
          toItem.名字 = getCopyName(names, toItem.名字);
          // updateMenjiaoData(toItem);
          // for (const key1 of menjiaoCadTypes) {
          //   const fromData = fromItem[key1];
          //   const toData = toItem[key1];
          //   const [包边方向, 开启] = key1.split("+");
          //   const fromParams: SuanliaoDataParams = {
          //     选项: {
          //       型号: this.xinghaoName,
          //       产品分类: this.fenleiName,
          //       工艺做法: zuofaName,
          //       包边方向,
          //       开启,
          //       门铰锁边铰边: fromItem.名字
          //     }
          //   };
          //   const toParams: SuanliaoDataParams = {
          //     选项: {
          //       型号: this.xinghaoName,
          //       产品分类: this.fenleiName,
          //       工艺做法: zuofaName,
          //       包边方向,
          //       开启,
          //       门铰锁边铰边: toItem.名字
          //     }
          //   };
          //   await copySuanliaoData(this.http, fromData, toData, fromParams, toParams);
          // }
          zuofa.算料数据.push(toItem);
          await this.updateMenjiao();
        }
        break;
      case "删除":
        if (await this.message.confirm(`确定删除【${fromItem.名字}】吗？`)) {
          zuofa.算料数据.splice(rowIdx, 1);
          await this.updateMenjiao();
        }
        break;
    }
  }
}
