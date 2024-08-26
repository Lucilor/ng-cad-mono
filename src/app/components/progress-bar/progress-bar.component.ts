import {Component, input, signal} from "@angular/core";
import {ListRandom} from "@lucilor/utils";

export type ProgressBarStatus = "hidden" | "progress" | "success" | "error" | "warning";

@Component({
  selector: "app-progress-bar",
  templateUrl: "./progress-bar.component.html",
  styleUrls: ["./progress-bar.component.scss"],
  standalone: true,
  imports: []
})
export class ProgressBarComponent {
  progress = input.required<number>();
  status = input.required<ProgressBarStatus>();
  msg = input.required<string>();

  clickTextsRandom = new ListRandom([
    "(〃'▽'〃)",
    "(*^▽^*)",
    "(｡･ω･｡)",
    "✿(。◕ᴗ◕。)✿",
    "(^_−)☆",
    " (｡♥ᴗ♥｡) ",
    "๑乛◡乛๑",
    "ヽ(･ω･´ﾒ)",
    "(｡•ˇ‸ˇ•｡)",
    "o(ﾟДﾟ)っ！",
    "(❁´ω`❁)",
    "｡◕ᴗ◕｡",
    "(•ᴗ•)",
    "(づ●─●)づ",
    "ლ(❛◡❛✿)ლ",
    "ヽ(^ω^)ﾉ ",
    "(*❦ω❦)",
    "(๑•ω•๑)",
    "(o°ω°o)",
    "❥(ゝω・✿ฺ)",
    "✧(＾＿－✿ ",
    "★(－ｏ⌒) ",
    "(・ω<)",
    "๑Ő௰Ő๑)",
    "Σσ(・Д・；)",
    "o((⊙﹏⊙))o",
    "(￣ェ￣;)"
  ]);
  clickText = signal<string>("");
  onPointerDown() {
    this.clickText.set(this.clickTextsRandom.next());
  }
  onPointerUp() {
    this.clickText.set("");
  }
}
