import {animate, style, transition, trigger} from "@angular/animations";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  ElementRef,
  HostBinding,
  inject,
  input,
  output,
  signal,
  viewChild
} from "@angular/core";
import {timeout} from "@lucilor/utils";
import {Property} from "csstype";
import {ImageEvent} from "./image.component.types";

const imgEmpty = "assets/images/empty.jpg";
const imgLoading = "assets/images/loading.gif";

@Component({
  selector: "app-image",
  templateUrl: "./image.component.html",
  styleUrls: ["./image.component.scss"],
  animations: [
    trigger("toggle", [
      transition(":enter", [
        style({transform: "scale(0)", opacity: 0}),
        animate("0.3s", style({transform: "scale(1.2)", opacity: 1})),
        animate("0.1s", style({transform: "scale(1)"}))
      ]),
      transition(":leave", [
        style({transform: "scale(1)", opacity: 1}),
        animate("0.1s", style({transform: "scale(1.2)"})),
        animate("0.3s", style({transform: "scale(0)", opacity: 0}))
      ])
    ])
  ],
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageComponent {
  private cd = inject(ChangeDetectorRef);
  private elRef = inject<ElementRef<HTMLElement>>(ElementRef);

  @HostBinding("class") class: string[] = [];

  src = input.required<string | undefined>();
  bigPicSrc = input<string>();
  prefix = input<string>();
  control = input<boolean>();
  loadingSrc = input<string>(imgLoading);
  emptySrc = input<string>(imgEmpty);
  objectFit = input<Property.ObjectFit>("contain");
  imgLoad = output<ImageEvent>();
  imgError = output<ImageEvent>();
  imgEnd = output<ImageEvent>();

  loading = signal(false);
  error = signal(false);
  bigPicVisible = signal(false);
  bigPicClass = signal(["big-pic"]);

  bigPicDiv = viewChild<ElementRef<HTMLDivElement>>("bigPicDiv");

  constructor() {
    effect(() => {
      if (this.loading()) {
        if (!this.class.includes("loading")) {
          this.class = [...this.class, "loading"];
        }
      } else {
        if (this.class.includes("loading")) {
          this.class = this.class.filter((c) => c !== "loading");
        }
      }
    });
    effect(() => {
      if (this.error()) {
        if (!this.class.includes("error")) {
          this.class = [...this.class, "error"];
        }
      } else {
        if (this.class.includes("error")) {
          this.class = this.class.filter((c) => c !== "error");
        }
      }
    });
    effect(
      () => {
        if (this.currSrc()) {
          this.loading.set(true);
          this.error.set(false);
        } else {
          this.loading.set(false);
          this.error.set(false);
        }
        this.cd.markForCheck();
      },
      {allowSignalWrites: true}
    );
  }

  currSrc = computed(() => {
    const src = this.src();
    const prefix = this.prefix();
    return this.getUrl(src, prefix);
  });
  currBigPicSrc = computed(() => {
    const bigPicSrc = this.bigPicSrc();
    const prefix = this.prefix();
    return this.getUrl(bigPicSrc, prefix);
  });

  getUrl(url: string | undefined, prefix: string | undefined) {
    if (!url) {
      return "";
    }
    if (prefix && !/^(\/)|(http)/.test(url)) {
      return prefix + url;
    }
    return url;
  }

  onLoad(event: Event) {
    this.loading.set(false);
    this.imgLoad.emit({event});
    this.imgEnd.emit({event});
  }

  onError(event: Event) {
    this.loading.set(false);
    this.error.set(true);
    this.imgError.emit({event});
    this.imgEnd.emit({event});
  }

  async showBigPic() {
    const bigPicSrc = this.bigPicSrc();
    const bigPicDiv = this.bigPicDiv();
    if (bigPicSrc && bigPicDiv) {
      const el = bigPicDiv.nativeElement;
      document.body.append(el);
      this.bigPicClass.set([...Array.from(this.elRef.nativeElement.classList), "big-pic"]);
      await timeout();
      this.bigPicVisible.set(true);
    }
  }

  async hideBigPic() {
    const bigPicSrc = this.bigPicSrc();
    const bigPicDiv = this.bigPicDiv();
    if (bigPicSrc && bigPicDiv) {
      this.bigPicVisible.set(false);
      await timeout(400);
      const el = bigPicDiv.nativeElement;
      this.elRef.nativeElement.append(el);
    }
  }

  private _getDomMatrix(el: HTMLElement) {
    return new DOMMatrix(getComputedStyle(el).transform);
  }

  onWheel(event: WheelEvent) {
    if (!this.control()) {
      return;
    }
    event.stopPropagation();
    const img = event.target as HTMLImageElement;
    const matrix = this._getDomMatrix(img);
    const scale = event.deltaY < 0 ? 1.1 : 0.9;
    const {left, top, width, height} = img.getBoundingClientRect();
    const offsetX = ((event.clientX - left) / width) * 100;
    const offsetY = ((event.clientY - top) / height) * 100;
    matrix.scaleSelf(scale);
    img.style.transform = matrix.toString();
    img.style.transformOrigin = `${offsetX}% ${offsetY}%`;
  }

  onPointerDown(event: PointerEvent) {
    if (!this.control()) {
      return;
    }
    event.stopPropagation();
    const img = event.target as HTMLImageElement;
    img.setAttribute("x", event.clientX.toString());
    img.setAttribute("y", event.clientY.toString());
    const lastX = 0;
    const lastY = 0;
    const matrix = this._getDomMatrix(img);
    matrix.translateSelf(event.clientX - lastX, event.clientY - lastY);
  }

  onPointerMove(event: PointerEvent) {
    if (!this.control()) {
      return;
    }
    event.stopPropagation();
    const img = event.target as HTMLImageElement;
    if (!img.hasAttribute("x") || !img.hasAttribute("y")) {
      return;
    }
    const x = parseFloat(img.getAttribute("x") || "0");
    const y = parseFloat(img.getAttribute("y") || "0");
    const matrix = this._getDomMatrix(img);
    matrix.translateSelf(event.clientX - x, event.clientY - y);
    img.style.transform = matrix.toString();
    img.setAttribute("x", event.clientX.toString());
    img.setAttribute("y", event.clientY.toString());
  }

  onPointerUp(event: PointerEvent) {
    if (!this.control()) {
      return;
    }
    event.stopPropagation();
    const img = event.target as HTMLImageElement;
    img.removeAttribute("x");
    img.removeAttribute("y");
  }
}
