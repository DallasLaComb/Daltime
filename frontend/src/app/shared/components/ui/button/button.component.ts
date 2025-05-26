import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';
@Component({
  selector: 'shift-scheduler-button',
  standalone: true,
  templateUrl: './button.component.html',
  imports: [NgClass],
})
export class ButtonComponent {
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() variant: 'primary' | 'secondary' | 'tertiary' = 'primary';
}
