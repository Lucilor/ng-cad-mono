import {Component, forwardRef, OnDestroy, OnInit} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {validColors} from "@app/cad/utils";
import {environment} from "@env";
import {CadMtext, CadStylizer} from "@lucilor/cad-viewer";
import {Point} from "@lucilor/utils";
import {Subscribed} from "@mixins/subscribed.mixin";
import {InputInfo} from "@modules/input/components/input.types";
import {AppStatusService} from "@services/app-status.service";
import Color from "color";
import {debounce} from "lodash";
import {InputComponent} from "../../../../input/components/input.component";

@Component({
  selector: "app-cad-mtext",
  templateUrl: "./cad-mtext.component.html",
  styleUrls: ["./cad-mtext.component.scss"],
  standalone: true,
  imports: [MatButtonModule, forwardRef(() => InputComponent)]
})
export class CadMtextComponent extends Subscribed() implements OnInit, OnDestroy {
  selected: CadMtext[] = [];
  currAnchor = new Point();
  private _colorText = "";
  colorValue = "";
  colorBg = "";
  inputInfos: InputInfo[] = [];
  get colorText() {
    return this._colorText;
  }
  set colorText(value) {
    this._colorText = value.toUpperCase();
    try {
      const c = new Color(value);
      if (c.isLight()) {
        this.colorBg = "black";
      } else {
        this.colorBg = "white";
      }
      this.colorValue = value;
    } catch {
      this.colorValue = "black";
      this.colorBg = "white";
    }
  }

  constructor(private status: AppStatusService) {
    super();
  }

  ngOnInit() {
    this._updateSelected();
    const cad = this.status.cad;
    cad.on("entitiesselect", this._updateSelected);
    cad.on("entitiesunselect", this._updateSelected);
    cad.on("entitiesadd", this._updateSelected);
    cad.on("entitiesremove", this._updateSelected);
    this.subscribe(this.status.openCad$, () => {
      this._updateSelected();
    });
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    const cad = this.status.cad;
    cad.off("entitiesselect", this._updateSelected);
    cad.off("entitiesunselect", this._updateSelected);
    cad.off("entitiesadd", this._updateSelected);
    cad.off("entitiesremove", this._updateSelected);
  }

  private _updateInputInfos() {
    const disabled = this.selected.length < 1;
    this.inputInfos = [
      {
        type: "string",
        label: "内容",
        textarea: {autosize: {minRows: 1}},
        disabled,
        value: this.getInfo("text"),
        onInput: debounce((val) => {
          this.setInfo("text", val);
        }, 500),
        onChange: (val) => {
          this.setInfo("text", val);
        }
      },
      {
        type: "string",
        label: "字体大小",
        disabled,
        value: this.getFontSize(),
        onInput: (val) => {
          this.setFontSize(val);
        }
      },
      {
        type: "color",
        label: "颜色",
        disabled,
        value: new Color(this.getColor() || "white"),
        options: validColors.map((v) => new Color(v)),
        optionsOnly: true,
        onChange: (val) => {
          this.setColor(val.hex());
        }
      },
      {
        type: "coordinate",
        label: "锚点",
        disabled,
        value: this.getAnchor(),
        onChange: (val) => {
          this.setAnchor(val.anchor);
        }
      }
    ];
    if (environment.production) {
      this.inputInfos.push({
        type: "boolean",
        label: "竖排",
        disabled,
        value: this.getIsVertical("vertical"),
        onChange: (val) => {
          this.setIsVertical("vertical", val);
        }
      });
    } else {
      this.inputInfos.push(
        {
          type: "boolean",
          label: "竖排",
          disabled,
          value: this.getIsVertical("vertical"),
          onChange: (val) => {
            this.setIsVertical("vertical", val);
          }
        },
        {
          type: "boolean",
          label: "竖排",
          disabled,
          value: this.getIsVertical("vertical2"),
          onChange: (val) => {
            this.setIsVertical("vertical2", val);
          }
        }
      );
    }
  }

  private _updateSelected = () => {
    this.selected = this.status.cad.selected().mtext;
    this.colorText = this.getColor();
    this._updateInputInfos();
  };

  getInfo(field: string) {
    const selected = this.selected;
    if (selected.length === 1) {
      return (selected[0] as any)[field];
    }
    if (selected.length) {
      const texts = Array.from(new Set(selected.map((v: any) => v[field])));
      if (texts.length === 1) {
        return texts[0];
      }
      return "多个值";
    }
    return "";
  }

  setInfo(field: string, value: string) {
    this.selected.forEach((e: any) => {
      e[field] = value;
    });
    this.status.cad.render(this.selected);
  }

  getColor() {
    const selected = this.selected;
    let color = "";
    if (selected.length === 1) {
      color = selected[0].getColor().hex();
    } else if (selected.length) {
      const texts = Array.from(new Set(selected.map((v) => v.getColor().hex())));
      if (texts.length === 1) {
        color = texts[0];
      } else {
        return "多个值";
      }
    }
    return color;
  }

  setColor(value: string) {
    this.selected.forEach((e) => e.setColor(value));
    this.status.cad.render(this.selected);
    this.colorText = value;
  }

  getFontSize() {
    const selected = this.selected;
    let size: number | undefined;
    const config = this.status.cad.getConfig();
    if (selected.length === 1) {
      size = CadStylizer.get(selected[0], config).fontStyle.size;
    } else if (selected.length) {
      const texts = Array.from(new Set(selected.map((v) => CadStylizer.get(v, config).fontStyle.size)));
      if (texts.length === 1) {
        size = texts[0];
      } else {
        return "多个值";
      }
    }
    if (typeof size !== "number" || isNaN(size)) {
      return "";
    }
    return size.toString();
  }

  setFontSize(value: string) {
    let valueNum = Number(value);
    if (isNaN(valueNum) || valueNum < 0) {
      valueNum = 0;
    }
    this.selected.forEach((e) => (e.fontStyle.size = valueNum));
    this.status.cad.render(this.selected);
  }

  addMtext() {
    const cad = this.status.cad;
    const mtext = new CadMtext();
    const {cx, cy} = cad.draw.viewbox();
    mtext.insert.set(cx, cy);
    mtext.anchor.set(0, 0);
    mtext.text = "新建文本";
    mtext.selected = true;
    this.status.cad.add(mtext);
  }

  async cloneMtexts() {
    this.selected.forEach((mtext) => {
      const newText = mtext.clone(true);
      this.status.cad.add(newText);
    });
  }

  getAnchor() {
    const selected = this.selected;
    const anchor = new Point();
    if (selected.length === 1) {
      anchor.copy(selected[0].anchor);
    }
    this.currAnchor.copy(anchor);
    return anchor.toArray();
  }

  setAnchor([x, y]: [number, number]) {
    this.selected.forEach((e) => e.anchor.set(x, y));
    this.status.cad.render(this.selected);
  }

  getIsVertical(key: "vertical" | "vertical2") {
    const selected = this.selected;
    if (selected.length === 1) {
      return !!selected[0].fontStyle[key];
    } else if (selected.length > 1) {
      const values = Array.from(new Set(selected.map((v) => v.fontStyle[key])));
      if (values.length === 1) {
        return !!values[0];
      }
      return null;
    }
    return null;
  }

  setIsVertical(key: "vertical" | "vertical2", value: boolean) {
    this.selected.forEach((e) => {
      if (value) {
        e.fontStyle[key] = true;
      } else {
        delete e.fontStyle[key];
      }
    });
    this.status.cad.render(this.selected);
  }
}
