import {NgModule} from "@angular/core";
import {ListRandom} from "@lucilor/utils";
import {NgxUiLoaderModule, SPINNER} from "ngx-ui-loader";
import {SpinnerComponent} from "./components/spinner/spinner.component";

const spinnerTypes: SPINNER[] = [
  SPINNER.ballScaleMultiple,
  SPINNER.ballSpin,
  SPINNER.ballSpinClockwise,
  SPINNER.ballSpinClockwiseFadeRotating,
  SPINNER.chasingDots,
  SPINNER.circle,
  SPINNER.cubeGrid,
  SPINNER.doubleBounce,
  SPINNER.fadingCircle,
  SPINNER.foldingCube,
  SPINNER.pulse,
  SPINNER.rectangleBounce,
  SPINNER.rectangleBounceParty,
  SPINNER.rectangleBouncePulseOut,
  SPINNER.rectangleBouncePulseOutRapid,
  SPINNER.rotatingPlane,
  SPINNER.squareJellyBox,
  SPINNER.squareLoader,
  SPINNER.threeBounce,
  SPINNER.threeStrings,
  SPINNER.wanderingCubes
];

const spinnerTypeList = new ListRandom(spinnerTypes);

@NgModule({
  imports: [
    NgxUiLoaderModule.forRoot({
      fgsColor: "#2196f3",
      bgsColor: "#2196f3",
      pbColor: "#2196f3",
      fgsType: spinnerTypeList.next(),
      bgsType: spinnerTypeList.next(),
      bgsSize: 30,
      minTime: 0
    }),
    SpinnerComponent
  ],
  exports: [SpinnerComponent]
})
export class SpinnerModule {}
