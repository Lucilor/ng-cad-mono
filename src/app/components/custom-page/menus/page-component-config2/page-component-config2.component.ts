import {CdkDrag, CdkDragEnd, CdkDragHandle} from "@angular/cdk/drag-drop";
import {NgTemplateOutlet} from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostBinding,
  inject,
  input,
  signal,
  viewChild
} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatIconModule} from "@angular/material/icon";
import {getFilepathUrl, session} from "@app/app.common";
import {CadDataService} from "@app/modules/http/services/cad-data.service";
import {InputComponent} from "@app/modules/input/components/input.component";
import {InputInfo, InputInfoNumber, InputInfoOption} from "@app/modules/input/components/input.types";
import {getElementVisiblePercentage, isTypeOf, selectFiles} from "@lucilor/utils";
import Color from "color";
import {DataType, Properties} from "csstype";
import {NgScrollbarModule} from "ngx-scrollbar";
import {getGroupStyle, getInputStyle, getNumberUnitInput, getUnifiedInputs} from "../../models/input-info-utils";
import {pageComponentInfos, PageComponentTypeAny} from "../../models/page-component-infos";
import {updateGroup} from "../../models/page-component-utils";
import {PageComponentBase} from "../../models/page-components/page-component-base";
import {PageComponentForm} from "../../models/page-components/page-component-form";
import {PageComponentImage} from "../../models/page-components/page-component-image";
import {PageComponentText} from "../../models/page-components/page-component-text";
import {trblItems} from "../../models/page.utils";
import {PageStatusService} from "../../services/page-status.service";
import {InputGroup} from "./page-component-config2.types";

@Component({
  selector: "app-page-component-config2",
  standalone: true,
  imports: [
    CdkDrag,
    CdkDragHandle,
    InputComponent,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    NgScrollbarModule,
    NgTemplateOutlet
  ],
  templateUrl: "./page-component-config2.component.html",
  styleUrl: "./page-component-config2.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageComponentConfig2Component {
  private http = inject(CadDataService);
  private pageStatus = inject(PageStatusService);

  @HostBinding("class") class = "ng-page";

  workSpaceEl = input.required<HTMLElement>();

  get components() {
    return this.pageStatus.components;
  }
  get activeComponent() {
    return this.pageStatus.activeComponent;
  }
  get activeComponent2() {
    return this.pageStatus.activeComponent2;
  }
  get showComponentMenu() {
    return this.pageStatus.showComponentMenu;
  }

  private _expandedGroupsKey = "expandedGroups";
  private _componentMenuStyleKey = "customPageComponentMenuStyle";
  expandedGroups = signal<string[]>(session.load(this._expandedGroupsKey) || []);
  componentMenuStyleOverride = signal<Properties | null>(null);

  componentMenuEl = viewChild<ElementRef<HTMLDivElement>>("componentMenu");

  constructor() {
    effect(() => {
      session.save(this._expandedGroupsKey, this.expandedGroups());
    });
  }

  componentMenuStyle = computed(() => {
    const component = this.activeComponent();
    const componentMenuStyleOverride = this.componentMenuStyleOverride();
    if (!component || !this.showComponentMenu()) {
      return null;
    }
    const style: Properties = {};
    const stylePrev = session.load(this._componentMenuStyleKey);
    if (isTypeOf(stylePrev, "object")) {
      Object.assign(style, stylePrev);
    }
    if (componentMenuStyleOverride) {
      Object.assign(style, componentMenuStyleOverride);
    }
    setTimeout(() => {
      this.constrainComponentMenu();
    }, 0);
    return style;
  });
  moveComponentMenuEnd(event: CdkDragEnd) {
    const style: Properties = {};
    const rect = event.source.element.nativeElement.getBoundingClientRect();
    const workSpaceRect = this.workSpaceEl().getBoundingClientRect();
    style.top = `${rect.top - workSpaceRect.top}px`;
    style.left = `${rect.left - workSpaceRect.left}px`;
    session.save(this._componentMenuStyleKey, style);
  }
  constrainComponentMenu() {
    if (!session.load(this._componentMenuStyleKey)) {
      return;
    }
    const workSpaceEl = this.workSpaceEl();
    const componentMenuEl = this.componentMenuEl()?.nativeElement;
    if (componentMenuEl && getElementVisiblePercentage(componentMenuEl, workSpaceEl) < 25) {
      session.remove(this._componentMenuStyleKey);
      this.componentMenuStyleOverride.update((v) => {
        if (v) {
          delete v.top;
          delete v.left;
        } else {
          v = {};
        }
        return v;
      });
    }
  }
  closeComponentMenu() {
    this.showComponentMenu.set(false);
  }

  componentMenuInputs = computed(() => {
    this.components();
    const component = this.activeComponent2() || this.activeComponent();
    const inputGroups: InputGroup[] = [];
    const onChange = () => {
      this.components.update((v) => [...v]);
    };
    const mergeGroups = (groups: InputGroup[]) => {
      for (const group of groups) {
        const group2 = inputGroups.find((g) => g.name === group.name);
        if (group2) {
          group2.infos.push(...group.infos);
        } else {
          inputGroups.push(group);
        }
      }
    };
    if (component instanceof PageComponentText) {
      mergeGroups(this.getTextInputs(component, onChange));
    }
    if (component instanceof PageComponentImage) {
      mergeGroups(this.getImageInputs(component, onChange));
    }
    if (component instanceof PageComponentForm) {
      mergeGroups(this.getFormInputs(component, onChange));
    }
    if (component instanceof PageComponentBase) {
      mergeGroups(this.getCommonInputs(component, onChange));
    }

    const expandedGroups = this.expandedGroups();
    for (const group of inputGroups) {
      group.expanded = expandedGroups.includes(group.name);
    }
    return inputGroups;
  });
  getTextInputs(component: PageComponentText, onChange: () => void): InputGroup<PageComponentText>[] {
    return [
      {
        name: "",
        infos: [
          {
            type: "string",
            label: "字体",
            model: {data: component, key: "fontFamily"},
            onChange
          },
          {
            ...getNumberUnitInput(false, "字号", "px"),
            model: {data: component, key: "fontSize"},
            onChange
          },
          {
            type: "color",
            label: "字体颜色",
            value: new Color(component.color),
            onChange: (val) => {
              component.color = val.string();
              onChange();
            }
          }
        ]
      }
    ];
  }
  getImageInputs(component: PageComponentImage, onChange: () => void): InputGroup<PageComponentImage>[] {
    return [
      {
        name: "",
        infos: [
          {
            type: "string",
            label: "图片链接",
            model: {data: component, key: "src"},
            onChange,
            suffixIcons: [
              {
                name: "upload_file",
                color: "primary",
                onClick: async () => {
                  const files = await selectFiles({accept: "image/*"});
                  const file = files?.[0];
                  if (!file) {
                    return;
                  }
                  const result = await this.http.uploadImage(file);
                  const src = result?.url;
                  if (src) {
                    component.src = getFilepathUrl(src, {remote: true});
                    onChange();
                  }
                }
              }
            ],
            style: getInputStyle(false)
          },
          {
            type: "group",
            label: "",
            groupStyle: getGroupStyle(),
            infos: [
              {
                type: "boolean",
                label: "保持比例",
                model: {data: component, key: "keepRatio"},
                onChange: () => {
                  component.fitSize();
                  onChange();
                },
                style: getInputStyle(true)
              },
              {
                type: "select",
                label: "适应方式",
                model: {data: component, key: "objectFit"},
                options: [
                  {label: "contain", value: "contain"},
                  {label: "cover", value: "cover"},
                  {label: "fill", value: "fill"},
                  {label: "none", value: "none"},
                  {label: "scale-down", value: "scale-down"}
                ],
                onChange,
                style: getInputStyle(true)
              }
            ]
          }
        ]
      }
    ];
  }
  getFormInputs(component: PageComponentForm, onChange: () => void): InputGroup[] {
    return [
      {
        name: "",
        infos: [
          {
            type: "string",
            label: "字体",
            model: {data: component, key: "fontFamily"},
            onChange
          },
          {
            ...getNumberUnitInput(false, "字号", "px"),
            model: {data: component, key: "fontSize"},
            onChange
          },
          {
            type: "color",
            label: "字体颜色",
            value: new Color(component.color),
            onChange: (val) => {
              component.color = val.string();
              onChange();
            }
          },
          {
            type: "group",
            label: "",
            groupStyle: getGroupStyle(),
            infos: [
              {type: "number", label: "行数", model: {data: component, key: "rows"}, onChange, style: getInputStyle(true)},
              {type: "number", label: "列数", model: {data: component, key: "cols"}, onChange, style: getInputStyle(true)}
            ]
          },
          {
            type: "group",
            label: "",
            groupStyle: getGroupStyle(),
            infos: [
              {type: "number", label: "标题宽", model: {data: component, key: "labelWidth"}, onChange, style: getInputStyle(true)},
              {type: "number", label: "内容宽", model: {data: component, key: "valueWidth"}, onChange, style: getInputStyle(true)}
            ]
          },
          {
            type: "group",
            label: "",
            groupStyle: getGroupStyle(),
            infos: [
              {
                type: "boolean",
                label: "标题换行",
                disabled: true,
                hint: "未实现",
                model: {data: component, key: "labelWrap"},
                onChange,
                style: getInputStyle(true)
              },
              {
                type: "boolean",
                label: "内容换行",
                disabled: true,
                hint: "未实现",
                model: {data: component, key: "valueWrap"},
                onChange,
                style: getInputStyle(true)
              }
            ]
          },
          {
            type: "group",
            label: "",
            groupStyle: getGroupStyle(),
            infos: [
              {type: "boolean", label: "标题分隔线", model: {data: component, key: "labelSeparator"}, onChange, style: getInputStyle(true)},
              {type: "number", label: "行高", model: {data: component, key: "rowHeight"}, onChange, style: getInputStyle(true)}
            ]
          }
        ]
      } as InputGroup<PageComponentForm>,
      {
        name: "表格边距",
        infos: [
          {
            type: "group",
            label: "标题边距",
            groupStyle: getGroupStyle(),
            infos: getUnifiedInputs(
              "表格标题边距",
              trblItems.map(({name, index}) => ({
                ...getNumberUnitInput(true, name, "px", {flex: "0 0 50%"}),
                model: {data: component.labelPadding, key: index},
                onChange
              })),
              component.labelPadding,
              onChange
            )
          },
          {
            type: "group",
            label: "内容边距",
            groupStyle: getGroupStyle(),
            infos: getUnifiedInputs(
              "表格内容边距",
              trblItems.map(({name, index}) => ({
                ...getNumberUnitInput(true, name, "px", {flex: "0 0 50%"}),
                model: {data: component.valuePadding, key: index},
                onChange
              })),
              component.valuePadding,
              onChange
            )
          }
        ]
      }
    ];
  }
  getCommonInputs(component: PageComponentTypeAny, onChange: () => void): InputGroup[] {
    const {resizable = {}} = pageComponentInfos[component.type] || {};
    const widthInput: InputInfoNumber<typeof component.size> = {
      ...getNumberUnitInput(true, "宽", "px"),
      model: {data: component.size, key: "x"},
      readonly: !resizable.x,
      onChange: () => {
        this.onComponentSizeChange(component, "x");
        onChange();
      }
    };
    if (!resizable.x) {
      widthInput.readonly = true;
      widthInput.hint = "宽度自动调整";
    }
    const heightInput: InputInfoNumber<typeof component.size> = {
      ...getNumberUnitInput(true, "高", "px"),
      model: {data: component.size, key: "y"},
      readonly: !resizable.y,
      onChange: () => {
        this.onComponentSizeChange(component, "y");
        onChange();
      }
    };
    if (!resizable.y) {
      heightInput.readonly = true;
      heightInput.hint = "高度自动调整";
    }

    const xInput: InputInfoNumber<typeof component.position> = {
      ...getNumberUnitInput(true, "X", "px"),
      model: {data: component.position, key: "x"},
      onChange
    };
    const yInput: InputInfoNumber<typeof component.position> = {
      ...getNumberUnitInput(true, "Y", "px"),
      model: {data: component.position, key: "y"},
      onChange
    };

    const borderTypes: InputInfoOption<DataType.LineStyle>[] = [
      {label: "无", value: "none"},
      {label: "实线", value: "solid"},
      {label: "虚线", value: "dashed"},
      {label: "点线", value: "dotted"}
    ];
    const borderInputs: InputInfo<PageComponentTypeAny>[] = [
      {
        type: "select",
        label: "边框样式",
        options: borderTypes,
        model: {data: component, key: "borderStyle"},
        onChange,
        style: getInputStyle(false)
      },
      {
        type: "color",
        label: "边框颜色",
        value: new Color(component.borderColor),
        onChange: (val) => {
          component.borderColor = val.string();
          onChange();
        }
      },
      getNumberUnitInput(true, "边框宽度", "px", {}, {model: {data: component, key: "borderWidth"}, onChange}),
      {
        type: "group",
        label: "框线显示",
        groupStyle: getGroupStyle(),
        infos: getUnifiedInputs(
          "框线显示",
          trblItems.map(({name, index}) => ({
            type: "boolean",
            label: name,
            model: {data: component.borderShow, key: index},
            style: getInputStyle(true, {flex: "0 0 50%"})
          })),
          component.borderShow,
          onChange
        )
      }
    ];

    return [
      {
        name: "",
        infos: [
          {
            type: "color",
            label: "背景颜色",
            value: new Color(component.background),
            onChange: (val) => {
              component.background = val.string();
              onChange();
            }
          }
        ]
      },
      {name: "边框", infos: borderInputs},
      {
        name: "尺寸与位置",
        infos: [
          {type: "group", label: "尺寸", groupStyle: getGroupStyle(), infos: [widthInput, heightInput]},
          {type: "group", label: "位置", groupStyle: getGroupStyle(), infos: [xInput, yInput]},
          {...getNumberUnitInput(true, "旋转", "°"), model: {data: component.rotation, key: "deg"}, onChange}
        ]
      }
    ];
  }
  onComponentSizeChange(component: PageComponentTypeAny, axis: "x" | "y") {
    if (component instanceof PageComponentImage) {
      if (component.keepRatio) {
        const ratio = component.naturalRatio;
        if (axis === "x") {
          component.size.y = component.size.x / ratio;
        } else {
          component.size.x = component.size.y * ratio;
        }
      }
    }
    updateGroup(this.components(), component);
  }

  onExpandedChange(group: ReturnType<typeof this.componentMenuInputs>[number], expanded: boolean) {
    this.expandedGroups.update((v) => {
      if (expanded) {
        return [...v, group.name];
      } else {
        return v.filter((name) => name !== group.name);
      }
    });
  }
}
