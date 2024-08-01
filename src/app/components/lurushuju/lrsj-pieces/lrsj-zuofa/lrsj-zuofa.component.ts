import {ChangeDetectionStrategy, Component, computed, HostBinding, inject, input, model, signal} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatTabsModule} from "@angular/material/tabs";
import {getCopyName} from "@app/app.common";
import {CadDataService} from "@app/modules/http/services/cad-data.service";
import {InputInfo, InputInfoOption, InputInfoSelect} from "@app/modules/input/components/input.types";
import {MessageService} from "@app/modules/message/services/message.service";
import {TableComponent} from "@app/modules/table/components/table/table.component";
import {RowButtonEvent, ToolbarButtonEvent} from "@app/modules/table/components/table/table.types";
import {ObjectOf} from "@lucilor/utils";
import {cloneDeep} from "lodash";
import {LrsjStatusService} from "../../services/lrsj-status.service";
import {getSortedItems, 工艺做法, 算料数据, 输入, 选项} from "../../xinghao-data";
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
  private http = inject(CadDataService);
  private lrsjStatus = inject(LrsjStatusService);
  private message = inject(MessageService);

  @HostBinding("class") class = ["ng-page"];

  fenlei = input.required<string>();
  zuofa = model.required<工艺做法>();

  tabs = signal<ZuofaTab[]>([{name: "算料数据"}, {name: "下单选项输入配置"}]);

  constructor() {}

  async submitZuofa(fields: (keyof 工艺做法)[], 产品分类?: string, 名字?: string) {
    const xinghao = this.lrsjStatus.xinghao();
    if (!xinghao) {
      return;
    }
    const data: Partial<工艺做法> = {};
    const 型号 = xinghao.名字;
    let zuofa: 工艺做法 | undefined | null;
    if (产品分类 && 名字) {
      zuofa = xinghao.产品分类[产品分类]?.find((v) => v.名字 === 名字);
    } else {
      zuofa = this.zuofa();
      产品分类 = this.fenlei();
      名字 = zuofa.名字;
    }
    if (!zuofa || !Array.isArray(fields) || fields.length === 0) {
      return;
    }
    for (const field of fields) {
      data[field] = zuofa[field] as any;
    }
    const response = await this.http.post("shuju/api/editGongyi", {型号, 产品分类, updateDatas: {[名字]: data}}, {spinner: false});
    if (response?.code === 0 && xinghao) {
      const item = xinghao.产品分类[产品分类].find((v) => v.名字 === 名字);
      if (item) {
        Object.assign(item, data);
      }
      this.lrsjStatus.updateXinghao(xinghao);
    }
  }

  xuanxiangTable = computed(() => getXuanxiangTable(this.zuofa().选项数据));
  async getXuanxiangItem(data0?: 选项) {
    const data: 选项 = {名字: "", 可选项: [], ...data0};
    const names = this.xuanxiangTable().data.map((v) => v.名字);
    const zuofaOptionsAll = await this.lrsjStatus.getZuofaOptionsAll();
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
    switch (event.button.event) {
      case "添加":
        break;
      case "从其他做法选择":
        break;
    }
  }
  async onMenjiaoRow(event: RowButtonEvent<算料数据>, suanliaoDataName?: string, suanliaoTestName?: string) {
    const zuofa = this.zuofa();
    const {button, item: fromItem, rowIdx} = event;
    switch (button.event) {
      case "编辑":
        await this.editSuanliao(fromItem, rowIdx, suanliaoDataName, suanliaoTestName);
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
  async editSuanliao(data: 算料数据, rowIdx: number, suanliaoDataName?: string, suanliaoTestName?: string) {
    data.产品分类 = this.fenlei();
    console.log(rowIdx, suanliaoDataName, suanliaoTestName);
    await this.getMenjiaoItem();
  }
}
