import { Component, Input } from '@angular/core';

@Component({
  selector: 'shift-scheduler-button',
  standalone: true,
  templateUrl: './button.component.html',
})
export class ButtonComponent {
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
}
