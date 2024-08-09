import {ChangeDetectionStrategy, Component, effect, HostBinding, inject, signal, untracked, viewChild} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatDialog} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatIconModule} from "@angular/material/icon";
import {filePathUrl, getCopyName, getFilepathUrl} from "@app/app.common";
import {FloatingDialogModule} from "@app/modules/floating-dialog/floating-dialog.module";
import {CadDataService} from "@app/modules/http/services/cad-data.service";
import {ImageComponent} from "@app/modules/image/components/image/image.component";
import {InputInfo} from "@app/modules/input/components/input.types";
import {MessageService} from "@app/modules/message/services/message.service";
import {ObjectOf} from "@lucilor/utils";
import {cloneDeep} from "lodash";
import {NgScrollbar, NgScrollbarModule} from "ngx-scrollbar";
import {openSelectZuofaDialog} from "../../select-zuofa-dialog/select-zuofa-dialog.component";
import {LrsjStatusService} from "../../services/lrsj-status.service";
import {getZuofa, sortZuofas, XinghaoRaw, 工艺做法} from "../../xinghao-data";
import {LrsjPiece} from "../lrsj-piece";
import {updateMenjiaoData} from "../lrsj-suanliao-data/lrsj-suanliao-data.utils";
import {LrsjZuofaComponent} from "../lrsj-zuofa/lrsj-zuofa.component";
import {ZuofaInfo} from "./lrsj-zuofas.types";

@Component({
  selector: "app-lrsj-zuofas",
  standalone: true,
  imports: [FloatingDialogModule, ImageComponent, LrsjZuofaComponent, MatButtonModule, MatDividerModule, MatIconModule, NgScrollbarModule],
  templateUrl: "./lrsj-zuofas.component.html",
  styleUrl: "./lrsj-zuofas.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LrsjZuofasComponent extends LrsjPiece {
  private dialog = inject(MatDialog);
  private http = inject(CadDataService);
  private lrsjStatus = inject(LrsjStatusService);
  private message = inject(MessageService);

  @HostBinding("class") class = "ng-page";

  xinghao = this.lrsjStatus.xinghao;
  editMode = this.lrsjStatus.editMode;

  zuofaInfos = signal<ZuofaInfo[]>([]);
  zuofaInfosEff = effect(
    () => {
      const pieceInfo = this.lrsjStatus.pieceInfos().zuofas;
      if (!pieceInfo.show) {
        this.zuofaInfos.set([]);
      }
    },
    {allowSignalWrites: true}
  );

  scrollbar = viewChild.required<NgScrollbar>("scrollbar");

  getFilepathUrl(url: string) {
    return getFilepathUrl(url);
  }

  async addZuofa(fenleiName: string) {
    const xinghao = this.xinghao();
    if (!xinghao) {
      return;
    }
    const names = xinghao.产品分类[fenleiName].map((gongyi) => gongyi.名字);
    const 名字 = await this.message.prompt({
      type: "string",
      label: "",
      validators: (control) => {
        const value = control.value;
        if (!value) {
          return {"请输入工艺做法名字，下单时需要选择": true};
        }
        if (names.includes(value)) {
          return {名字已存在: true};
        }
        return null;
      }
    });
    if (!名字) {
      return;
    }
    const 型号 = xinghao.名字;
    const xinghaoRaw = await this.http.getData<XinghaoRaw>("shuju/api/addGongyi", {名字, 型号, fenleiName});
    await this.lrsjStatus.updateXinghaoFenlei(xinghaoRaw?.产品分类);
    this.openZuofa(fenleiName, 名字);
  }
  async removeZuofa(fenleiName: string, zuofa: 工艺做法) {
    const xinghao = this.xinghao();
    if (!xinghao || !(await this.message.confirm("确定删除选中的工艺做法吗？"))) {
      return;
    }
    const 型号 = xinghao.名字;
    const xinghaoRaw = await this.http.getData<XinghaoRaw>("shuju/api/removeGongyi", {名字: zuofa.名字, 型号, 产品分类: fenleiName});
    await this.lrsjStatus.updateXinghaoFenlei(xinghaoRaw?.产品分类);
  }
  async copyZuofa(fenleiName: string, zuofa: 工艺做法) {
    const xinghao = this.xinghao();
    if (!xinghao) {
      return;
    }
    const zuofaName = zuofa.名字;
    const names = xinghao.产品分类[fenleiName].map((v) => v.名字);
    let 复制名字 = await this.message.prompt({
      type: "string",
      label: "复制工艺做法",
      hint: "若留空则自动生成名字",
      validators: (control) => {
        const value = control.value;
        if (names.includes(value)) {
          return {名字已存在: true};
        }
        if (value === zuofaName) {
          return {不能与原名字相同: true};
        }
        return null;
      }
    });
    if (复制名字 === null) {
      return;
    }
    if (!复制名字) {
      复制名字 = getCopyName(names, zuofaName);
    }
    const 型号 = xinghao.名字;
    const xinghaoRaw = await this.http.getData<XinghaoRaw>("shuju/api/copyGongyi", {名字: zuofaName, 复制名字, 型号, fenleiName});
    await this.lrsjStatus.updateXinghaoFenlei(xinghaoRaw?.产品分类);
  }
  async editZuofa(fenleiName: string, zuofa: 工艺做法) {
    const xinghao = this.xinghao();
    if (!xinghao) {
      return;
    }
    const zuofas = xinghao.产品分类[fenleiName];
    const zuofaNew = cloneDeep(zuofa);
    const form: InputInfo<Partial<工艺做法>>[] = [
      {type: "string", label: "名字", model: {data: zuofaNew, key: "名字"}, validators: Validators.required},
      {
        type: "image",
        label: "图片",
        value: zuofaNew.图片,
        prefix: filePathUrl,
        clearable: true,
        onChange: async (val, info) => {
          if (val) {
            const result = await this.http.uploadImage(val);
            if (result?.url) {
              info.value = result.url;
              zuofaNew.图片 = result.url;
            }
          } else {
            info.value = "";
            zuofaNew.图片 = "";
          }
        }
      },
      {type: "boolean", label: "停用", model: {data: zuofaNew, key: "停用"}},
      {type: "number", label: "排序", model: {data: zuofaNew, key: "排序"}},
      {type: "boolean", label: "录入完成", model: {data: zuofaNew, key: "录入完成"}},
      {type: "boolean", label: "默认值", model: {data: zuofaNew, key: "默认值"}}
    ];
    const result = await this.message.form(form);
    if (result) {
      const updateDatas: ObjectOf<typeof result> = {[zuofa.名字]: result};
      if (result.默认值) {
        for (const zuofa of zuofas) {
          if (zuofa.名字 !== zuofaNew.名字) {
            zuofa.默认值 = false;
            updateDatas[zuofa.名字] = {默认值: false};
          }
        }
      }
      const 型号 = xinghao.名字;
      const success = await this.http.post<boolean>("shuju/api/editGongyi", {型号, 产品分类: fenleiName, updateDatas});
      if (success) {
        const mingziOld = zuofa.名字;
        const mingziNew = zuofaNew.名字;
        if (mingziOld !== mingziNew) {
          const params = {xinghao: 型号, fenlei: fenleiName, mingziOld, mingziNew};
          await this.http.getData("shuju/api/onGongyiNameChange", params);
        }
        const paixu1 = zuofa.排序;
        const paixu2 = zuofaNew.排序;
        Object.assign(zuofa, result);
        if (paixu1 !== paixu2) {
          sortZuofas(zuofas);
          await this.lrsjStatus.setXinghao({产品分类: xinghao.产品分类}, true);
        }
        this.lrsjStatus.refreshXinghao(false);
      }
    }
  }
  async openZuofa(fenleiName: string, zuofa: 工艺做法) {
    const zuofaName = zuofa.名字;
    zuofa = getZuofa(zuofa, await this.lrsjStatus.getZuofaOptions());
    const infos = this.zuofaInfos().slice();
    const i = infos.findIndex((v) => v.fenleiName === fenleiName && v.zuofa.名字 === zuofaName);
    if (i < 0) {
      infos.push({fenleiName, zuofa, position: signal({x: 0, y: 0})});
    }
    this.zuofaInfos.set(infos);
  }
  closeZuofa(i: number) {
    const infos = this.zuofaInfos().filter((_, j) => j !== i);
    this.zuofaInfos.set(infos);
  }

  onFocusFenleiZuofa(i: number, j?: number) {
    const scrollbar = this.scrollbar();
    let el: Element | null;
    if (typeof j === "number") {
      el = scrollbar.viewport.nativeElement.querySelector(`[data-ij="${i},${j}"]`);
      const xinghao = this.xinghao();
      if (xinghao) {
        const fenleiName = xinghao.显示产品分类[i];
        const zuofa = xinghao.产品分类[fenleiName][j];
        this.openZuofa(fenleiName, zuofa);
      }
    } else {
      el = scrollbar.viewport.nativeElement.querySelector(`[data-i="${i}"]`);
    }
    if (el) {
      scrollbar.scrollToElement(el);
    }
  }
  onFocusFenleiZuofaEff = effect(() => {
    const focusFenleiZuofa = this.lrsjStatus.focusFenleiZuofa();
    if (!focusFenleiZuofa) {
      return;
    }
    const {i, j} = focusFenleiZuofa;
    untracked(() => this.onFocusFenleiZuofa(i, j));
  });
  scrollToFenlei(i: number) {
    this.lrsjStatus.focusFenleiZuofa.set({i});
  }
  scrollToZuofa(i: number, j: number) {
    this.lrsjStatus.focusFenleiZuofa.set({i, j});
  }

  async copyZuofaFromOthers() {
    const xinghao = this.lrsjStatus.xinghao();
    if (!xinghao) {
      return;
    }
    const xinghaoOptions = await this.lrsjStatus.getXinghaoOptions();
    const result = await openSelectZuofaDialog(this.dialog, {
      data: {xinghaoOptions, multiple: true}
    });
    if (!result) {
      return;
    }
    const targetFenlei = await this.message.prompt<string>({
      type: "select",
      label: "复制到哪个分类",
      options: xinghao.显示产品分类,
      hint: "若留空则复制到对应分类"
    });
    if (typeof targetFenlei !== "string") {
      return;
    }
    let successCount = 0;
    const 型号2 = xinghao.名字;
    const gongyiNames: ObjectOf<string[]> = {};
    for (const item of result.items) {
      const {型号, 产品分类, 名字} = item;
      const 产品分类2 = targetFenlei || 产品分类;
      if (!gongyiNames[产品分类2]) {
        gongyiNames[产品分类2] = xinghao.产品分类[产品分类2].map((v) => v.名字);
      }
      const 复制名字 = getCopyName(gongyiNames[产品分类2], item.名字);
      const success = await this.http.getData<boolean>("shuju/api/copyGongyi", {名字, 复制名字, 型号, 型号2, 产品分类, 产品分类2});
      if (success) {
        gongyiNames[产品分类2].push(复制名字);
        successCount++;
      }
    }
    if (successCount > 0) {
      const xinghao2 = await this.lrsjStatus.refreshXinghao(true);
      const data = xinghao2?.产品分类[targetFenlei]?.at(-1);
      if (data) {
        for (const menjiaoData of data.算料数据) {
          updateMenjiaoData(menjiaoData);
        }
        await this.lrsjStatus.submitZuofa(targetFenlei, data, ["算料数据"]);
      }
    }
  }
}
