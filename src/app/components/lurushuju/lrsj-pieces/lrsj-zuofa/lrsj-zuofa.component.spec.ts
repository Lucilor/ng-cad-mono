import {ComponentFixture, TestBed} from "@angular/core/testing";
import {provideAnimations} from "@angular/platform-browser/animations";
import {provideRouter} from "@angular/router";
import {getZuofa} from "../../xinghao-data";
import {LrsjZuofaComponent} from "./lrsj-zuofa.component";

describe("LrsjZuofaComponent", () => {
  let component: LrsjZuofaComponent;
  let fixture: ComponentFixture<LrsjZuofaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LrsjZuofaComponent],
      providers: [provideAnimations(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(LrsjZuofaComponent);
    component = fixture.componentInstance;
    const ref = fixture.componentRef;
    ref.setInput("zuofa", getZuofa(null, {}));
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
