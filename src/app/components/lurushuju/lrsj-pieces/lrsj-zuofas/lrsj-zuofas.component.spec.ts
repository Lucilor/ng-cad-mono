import {ComponentFixture, TestBed} from "@angular/core/testing";
import {provideAnimations} from "@angular/platform-browser/animations";
import {provideRouter} from "@angular/router";
import {LrsjZuofasComponent} from "./lrsj-zuofas.component";

describe("LrsjGongyisComponent", () => {
  let component: LrsjZuofasComponent;
  let fixture: ComponentFixture<LrsjZuofasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LrsjZuofasComponent],
      providers: [provideAnimations(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(LrsjZuofasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
