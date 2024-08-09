import {ComponentFixture, TestBed} from "@angular/core/testing";
import {provideAnimations} from "@angular/platform-browser/animations";
import {provideRouter} from "@angular/router";
import {LurushujuNavComponent} from "./lurushuju-nav.component";

describe("LurushujuNavComponent", () => {
  let component: LurushujuNavComponent;
  let fixture: ComponentFixture<LurushujuNavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LurushujuNavComponent],
      providers: [provideAnimations(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(LurushujuNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
