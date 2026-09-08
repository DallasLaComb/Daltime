import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManagerSchedule } from './schedule';
import { APP_TEST_PROVIDERS } from '../../../../test-setup';

describe('ManagerSchedule', () => {
  let component: ManagerSchedule;
  let fixture: ComponentFixture<ManagerSchedule>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerSchedule],
      providers: APP_TEST_PROVIDERS,
    }).compileComponents();

    fixture = TestBed.createComponent(ManagerSchedule);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
